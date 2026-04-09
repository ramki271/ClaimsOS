import { useEffect, useState } from "react";
import { AgentChatWidget } from "../features/agent/components/AgentChatWidget";
import { AdjudicationPage } from "../features/adjudication/components/AdjudicationPage";
import { LoginPage } from "../features/auth/components/LoginPage";
import { KnowledgeStudioPage } from "../features/knowledge/components/KnowledgeStudioPage";
import { ClaimsHubPage } from "../features/claims/components/ClaimsHubPage";
import { IntakePolicyPage } from "../features/intake/components/IntakePolicyPage";
import { MembersPage } from "../features/members/components/MembersPage";
import { OverviewPage } from "../features/overview/components/OverviewPage";
import { PolicyManagerPage } from "../features/policy/components/PolicyManagerPage";
import { ProvidersPage } from "../features/providers/components/ProvidersPage";
import { ReportsPage } from "../features/reports/components/ReportsPage";
import { AppShell } from "../shared/layout/AppShell";
import {
  fetchClaimById,
  fetchClaims,
  fetchDemoClaim,
  intakeClaimDocument,
  processClaim,
  submitReview,
  uploadX12Batch,
  uploadX12Claim,
  type ClaimDetailResponse,
  type ClaimDocumentIntakeResponse,
  type ClaimRecordSummary,
  type ClaimReviewRequest,
  type ClaimSubmission,
  type ClaimsFilter,
  type X12BatchUploadResponse,
} from "../shared/api/claims";
import {
  fetchProviders,
  createProvider,
  type Provider,
  type ProviderCreateRequest,
} from "../shared/api/providers";
import {
  fetchMembers,
  fetchMemberById,
  type MemberListItem,
  type MemberDetailResponse,
} from "../shared/api/members";
import {
  fetchPolicies,
  fetchPolicyMetrics,
  uploadPolicy,
  type PolicyListItem,
  type PolicyMetricsResponse,
  type PolicyUploadResponse,
} from "../shared/api/policies";

const fallbackClaim: ClaimSubmission = {
  claim_id: "CLM-20260327-0001",
  claim_type: "professional_outpatient",
  form_type: "CMS-1500",
  payer_name: "Apex Health Plan",
  plan_name: "Commercial PPO 500",
  member_id: "M-4421907",
  member_name: "Elena Martinez",
  subscriber_relationship: "self",
  patient_id: "PAT-1007",
  provider_id: "PRV-4092",
  provider_name: "Front Range Family Medicine",
  place_of_service: "11",
  diagnosis_codes: ["E11.9", "I10"],
  procedure_codes: ["99213"],
  service_lines: [
    {
      line_number: 1,
      procedure_code: "99213",
      modifiers: [],
      diagnosis_pointers: [1, 2],
      units: 1,
      charge_amount: 150,
    },
  ],
  amount: 150,
  date_of_service: "2026-03-01",
};

type ViewId = "dashboard" | "claims" | "intake" | "policy" | "providers" | "members" | "reports" | "detail" | "knowledge";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const [demoClaim, setDemoClaim] = useState<ClaimSubmission | null>(null);
  const [claimDraft, setClaimDraft] = useState(JSON.stringify(fallbackClaim, null, 2));
  const [result, setResult] = useState<ClaimDetailResponse | null>(null);
  const [batchUploadResult, setBatchUploadResult] = useState<X12BatchUploadResponse | null>(null);
  const [claims, setClaims] = useState<ClaimRecordSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [claimsFilter, setClaimsFilter] = useState<ClaimsFilter>({ limit: 20, offset: 0 });

  // Members state
  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberDetailResponse | null>(null);

  // Providers state
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isProvidersLoading, setIsProvidersLoading] = useState(false);

  // Policies state
  const [policies, setPolicies] = useState<PolicyListItem[]>([]);
  const [isPoliciesLoading, setIsPoliciesLoading] = useState(false);
  const [lastPolicyUpload, setLastPolicyUpload] = useState<PolicyUploadResponse | null>(null);
  const [policyMetrics, setPolicyMetrics] = useState<PolicyMetricsResponse | null>(null);

  useEffect(() => {
    void handleLoadDemo();
  }, []);

  useEffect(() => {
    void loadClaims(claimsFilter);
  }, [claimsFilter]);

  useEffect(() => {
    if (activeView === "providers") {
      void loadProviders();
    }
    if (activeView === "policy") {
      void loadPolicies();
    }
    if (activeView === "members") {
      void loadMembers();
    }
  }, [activeView]);

  async function handleLoadDemo() {
    try {
      const claim = await fetchDemoClaim();
      setDemoClaim(claim);
      setClaimDraft(JSON.stringify(claim, null, 2));
    } catch {
      setDemoClaim(fallbackClaim);
      setClaimDraft(JSON.stringify(fallbackClaim, null, 2));
    }
  }

  async function loadClaims(filter: ClaimsFilter) {
    try {
      const records = await fetchClaims(filter);
      setClaims(records);
      if (!selectedClaimId && records.length) {
        setSelectedClaimId(records[0].claim_id);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function loadMembers() {
    setIsMembersLoading(true);
    try {
      const data = await fetchMembers("apex-health-plan");
      setMembers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsMembersLoading(false);
    }
  }

  async function handleSelectMember(memberId: string) {
    try {
      const data = await fetchMemberById(memberId);
      setSelectedMember(data);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadProviders() {
    setIsProvidersLoading(true);
    try {
      const data = await fetchProviders("apex-health-plan");
      setProviders(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsProvidersLoading(false);
    }
  }

  async function handleSelectClaim(claimId: string) {
    try {
      setSelectedClaimId(claimId);
      const response = await fetchClaimById(claimId);
      setResult(response);
      setActiveView("detail");
    } catch (error) {
      console.error(error);
    }
  }

  async function handleProcessClaim() {
    setIsLoading(true);
    try {
      const parsed = JSON.parse(claimDraft) as ClaimSubmission;
      const response = await processClaim(parsed);
      setResult(response);
      setBatchUploadResult(null);
      setSelectedClaimId(response.claim.claim_id);
      await loadClaims(claimsFilter);
      setActiveView("detail");
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUploadX12(file: File) {
    setIsLoading(true);
    try {
      const response = await uploadX12Claim(file);
      setResult(response);
      setBatchUploadResult(null);
      setSelectedClaimId(response.claim.claim_id);
      await loadClaims(claimsFilter);
      setActiveView("detail");
    } catch (error) {
      // Re-throw so IntakePage can display the parser error message
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUploadX12Batch(file: File) {
    setIsLoading(true);
    try {
      const response = await uploadX12Batch(file);
      setBatchUploadResult(response);
      const firstProcessed = response.results.find((item) => item.status === "processed" && item.result);
      if (firstProcessed?.result) {
        setResult(firstProcessed.result);
        setSelectedClaimId(firstProcessed.result.claim.claim_id);
      }
      await loadClaims(claimsFilter);
      setActiveView("intake");
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmitDraft(claim: ClaimSubmission) {
    setIsLoading(true);
    try {
      const response = await processClaim(claim);
      setResult(response);
      setBatchUploadResult(null);
      setSelectedClaimId(response.claim.claim_id);
      await loadClaims(claimsFilter);
      setActiveView("detail");
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function handleIntakeDocument(
    file: File,
    autoProcess: boolean,
    payerNameHint?: string,
  ): Promise<ClaimDocumentIntakeResponse> {
    const response = await intakeClaimDocument(file, { autoProcess, payerNameHint });
    if (autoProcess && response.processed_result) {
      setResult(response.processed_result);
      setSelectedClaimId(response.processed_result.claim.claim_id);
      await loadClaims(claimsFilter);
      setActiveView("detail");
    }
    return response;
  }

  async function handleSubmitReview(claimId: string, review: ClaimReviewRequest) {
    const response = await submitReview(claimId, review);
    setResult(response);
    await loadClaims(claimsFilter);
  }

  async function handleCreateProvider(provider: ProviderCreateRequest) {
    await createProvider(provider);
    await loadProviders();
  }

  async function loadPolicies() {
    setIsPoliciesLoading(true);
    try {
      const [data, metrics] = await Promise.all([
        fetchPolicies("apex-health-plan"),
        fetchPolicyMetrics("apex-health-plan"),
      ]);
      setPolicies(data);
      setPolicyMetrics(metrics);
    } catch (error) {
      console.error(error);
    } finally {
      setIsPoliciesLoading(false);
    }
  }

  async function handleUploadPolicy(file: File, payerName: string, classification: string) {
    const result = await uploadPolicy(file, payerName, classification);
    setLastPolicyUpload(result);
    await loadPolicies();
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <>
    <AppShell activeView={activeView} setActiveView={setActiveView} onLogout={() => { setIsAuthenticated(false); setActiveView("dashboard"); }}>
      {activeView === "dashboard" && (
        <OverviewPage claims={claims} onSelectClaim={handleSelectClaim} />
      )}
      {activeView === "claims" && (
        <ClaimsHubPage
          claims={claims}
          filter={claimsFilter}
          onFilterChange={setClaimsFilter}
          onOpenClaim={handleSelectClaim}
          selectedClaimId={selectedClaimId}
        />
      )}
      {activeView === "intake" && (
        <IntakePolicyPage
          batchUploadResult={batchUploadResult}
          claimDraft={claimDraft}
          demoClaim={demoClaim}
          isLoading={isLoading}
          onIntakeDocument={handleIntakeDocument}
          onSubmitDraft={(claim) => handleSubmitDraft(claim)}
          onLoadDemo={() => void handleLoadDemo()}
          onProcessClaim={() => void handleProcessClaim()}
          onUploadX12Batch={handleUploadX12Batch}
          onUploadX12={handleUploadX12}
          onViewProcessedClaim={(claimId) => void handleSelectClaim(claimId)}
          setClaimDraft={setClaimDraft}
        />
      )}
      {activeView === "policy" && (
        <PolicyManagerPage
          isPoliciesLoading={isPoliciesLoading}
          lastPolicyUpload={lastPolicyUpload}
          metrics={policyMetrics}
          onUploadPolicy={handleUploadPolicy}
          onOpenKnowledgeStudio={() => setActiveView("knowledge")}
          policies={policies}
        />
      )}
      {activeView === "providers" && (
        <ProvidersPage
          isLoading={isProvidersLoading}
          onCreateProvider={handleCreateProvider}
          providers={providers}
        />
      )}
      {activeView === "members" && (
        <MembersPage
          isLoading={isMembersLoading}
          members={members}
          onOpenClaim={handleSelectClaim}
          onSelectMember={handleSelectMember}
          selectedMember={selectedMember}
        />
      )}
      {activeView === "reports" && <ReportsPage claims={claims} />}
      {activeView === "knowledge" && <KnowledgeStudioPage />}
      {activeView === "detail" && (
        <AdjudicationPage
          onBackToClaims={() => setActiveView("claims")}
          onSelectClaim={handleSelectClaim}
          onSubmitReview={handleSubmitReview}
          result={result}
        />
      )}
    </AppShell>
      <AgentChatWidget activeView={activeView} claimId={selectedClaimId} onOpenClaim={handleSelectClaim} />
    </>
  );
}
