from fastapi import APIRouter, File, UploadFile

router = APIRouter(prefix="/policies", tags=["policies"])


@router.post("/upload")
async def upload_policy(file: UploadFile = File(...)) -> dict[str, str]:
    return {
        "filename": file.filename or "unknown",
        "status": "accepted",
        "message": "Policy upload is scaffolded. Storage, chunking, and embeddings are the next step.",
    }

