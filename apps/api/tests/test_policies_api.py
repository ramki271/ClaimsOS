from fastapi.testclient import TestClient

from app.domain.policies.models import PolicyDocumentRecord, PolicyListItem, PolicyUploadResponse
from app.domain.policies.repository import get_policies_repository
from app.domain.providers.repository import get_providers_repository
from app.main import app


client = TestClient(app)


class FakePoliciesRepository:
    def __init__(self) -> None:
        self.documents: list[PolicyDocumentRecord] = []
        self.chunks: dict[str, list[dict]] = {}

    def create_document(self, *, tenant_id, document_key, filename, title, classification, raw_text, metadata):
        existing = next((doc for doc in self.documents if doc.tenant_id == tenant_id and doc.document_key == document_key), None)
        if existing:
            existing.filename = filename
            existing.title = title
            existing.classification = classification
            existing.raw_text = raw_text
            existing.metadata = metadata
            existing.status = "indexed"
            return existing

        doc = PolicyDocumentRecord(
            id=f"doc-{len(self.documents)+1}",
            tenant_id=tenant_id,
            document_key=document_key,
            filename=filename,
            title=title,
            classification=classification,
            raw_text=raw_text,
            metadata=metadata,
            status="indexed",
        )
        self.documents.append(doc)
        return doc

    def replace_chunks(self, *, document_id, tenant_id, chunks):
        self.chunks[document_id] = [chunk.model_dump() for chunk in chunks]
        for doc in self.documents:
            if doc.id == document_id:
                doc.chunk_count = len(chunks)
        return len(chunks)

    def list_documents(self, *, tenant_id=None, limit=100):
        docs = self.documents
        if tenant_id:
            docs = [doc for doc in docs if doc.tenant_id == tenant_id]
        return [
            PolicyListItem(
                id=doc.id or "",
                filename=doc.filename,
                title=doc.title,
                classification=doc.classification,
                status=doc.status,
                chunk_count=doc.chunk_count,
                created_at=doc.created_at,
            )
            for doc in docs[:limit]
        ]

    def retrieve_chunks(self, *, tenant_id, limit=25):
        rows = []
        for doc in self.documents:
            if doc.tenant_id != tenant_id:
                continue
            for chunk in self.chunks.get(doc.id or "", []):
                rows.append(
                    {
                        **chunk,
                        "policy_documents": {
                            "document_key": doc.document_key,
                            "title": doc.title,
                            "classification": doc.classification,
                        },
                    }
                )
        return rows[:limit]


class FakeProvidersRepository:
    def __init__(self) -> None:
        self.tenants = {}

    def ensure_tenant(self, *, payer_name):
        tenant_key = payer_name.lower().replace(" ", "-")
        tenant = self.tenants.get(tenant_key)
        if tenant is None:
            tenant = type("TenantObj", (), {"id": tenant_key, "tenant_key": tenant_key, "name": payer_name})()
            self.tenants[tenant_key] = tenant
        return tenant

    def get_tenant_by_key(self, tenant_key):
        return self.tenants.get(tenant_key)


fake_policies_repository = FakePoliciesRepository()
fake_providers_repository = FakeProvidersRepository()
app.dependency_overrides[get_policies_repository] = lambda: fake_policies_repository
app.dependency_overrides[get_providers_repository] = lambda: fake_providers_repository


def test_upload_policy_indexes_document() -> None:
    response = client.post(
        "/api/policies/upload",
        data={"payer_name": "Apex Health Plan", "classification": "POLICY_CORE"},
        files={"file": ("office-visit-policy.txt", b"Office visits with CPT 99213 are covered for place of service 11.", "text/plain")},
    )
    body = response.json()

    assert response.status_code == 200
    assert body["status"] == "indexed"
    assert body["chunks_created"] >= 1
    assert body["document"]["classification"] == "POLICY_CORE"


def test_list_policies_returns_uploaded_documents() -> None:
    response = client.get("/api/policies", params={"tenant_key": "apex-health-plan"})
    body = response.json()

    assert response.status_code == 200
    assert len(body) >= 1
    assert body[0]["filename"] == "office-visit-policy.txt"


def test_upload_policy_rejects_unsupported_file_type() -> None:
    response = client.post(
        "/api/policies/upload",
        data={"payer_name": "Apex Health Plan"},
        files={"file": ("policy.pdf", b"%PDF-1.7 fake pdf", "application/pdf")},
    )

    assert response.status_code == 400
    assert "unsupported" in response.json()["detail"].lower()
