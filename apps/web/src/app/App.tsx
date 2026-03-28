import { useEffect, useState } from "react";
import { AdjudicationPage } from "../features/adjudication/components/AdjudicationPage";
import { ClaimsHubPage } from "../features/claims/components/ClaimsHubPage";
import { IntakePolicyPage } from "../features/intake/components/IntakePolicyPage";
import { OverviewPage } from "../features/overview/components/OverviewPage";
import { PolicyManagerPage } from "../features/policy/components/PolicyManagerPage";
import { ProvidersPage } from "../features/providers/components/ProvidersPage";
import { ReportsPage } from "../features/reports/components/ReportsPage";
import { AppShell } from "../shared/layout/AppShell";
import {
  fetchClaimById,
  fetchClaims,
  fetchDemoClaim,
  processClaim,
  submitReview,
  uploadX12Claim,
  type ClaimDetailResponse,
  type ClaimRecordSummary,
  type ClaimReviewRequest,
  type ClaimSubmission,
  type ClaimsFilter,
} from "../shared/api/claims";
import {
  fetchProviders,
  createProvider,
  type Provider,
  type ProviderCreateRequest,
} from "../shared/api/providers";
import { fetchPolicies, uploadPolicy, type PolicyListItem } from "../shared/api/policies";

const fallbackClaim: ClaimSubmission = {
  claim_id: "CLM-20260327-0001",
  claim_type: "professional_outpatient",
  form_type: "CMS-1500",
  payer_name: "Apex Health Plan",
  plan_name: "Commercial PPO 500",
  member_id: "M-4421907",
  member_name: "Elena Martinez",
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
      units: 1,
      charge_amount: 150,
    },
  ],
  amount: 150,
  date_of_service: "2026-03-01",
};

type ViewId = "dashboard" | "claims" | "intake" | "policy" | "providers" | "reports" | "detail";

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const [demoClaim, setDemoClaim] = useState<ClaimSubmission | null>(null);
  const [claimDraft, setClaimDraft] = useState(JSON.stringify(fallbackClaim, null, 2));
  const [result, setResult] = useState<ClaimDetailResponse | null>(null);
  const [claims, setClaims] = useState<ClaimRecordSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [claimsFilter, setClaimsFilter] = useState<ClaimsFilter>({ limit: 20, offset: 0 });

  // Providers state
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isProvidersLoading, setIsProvidersLoading] = useState(false);

  // Policies state
  const [policies, setPolicies] = useState<PolicyListItem[]>([]);
  const [isPoliciesLoading, setIsPoliciesLoading] = useState(false);

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
      const data = await fetchPolicies("apex-health-plan");
      setPolicies(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsPoliciesLoading(false);
    }
  }

  async function handleUploadPolicy(file: File, payerName: string, classification: string) {
    await uploadPolicy(file, payerName, classification);
    await loadPolicies();
  }

  return (
    <AppShell activeView={activeView} setActiveView={setActiveView}>
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
          claimDraft={claimDraft}
          demoClaim={demoClaim}
          isLoading={isLoading}
          onLoadDemo={() => void handleLoadDemo()}
          onProcessClaim={() => void handleProcessClaim()}
          onUploadX12={handleUploadX12}
          setClaimDraft={setClaimDraft}
        />
      )}
      {activeView === "policy" && (
        <PolicyManagerPage
          isPoliciesLoading={isPoliciesLoading}
          onUploadPolicy={handleUploadPolicy}
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
      {activeView === "reports" && <ReportsPage claims={claims} />}
      {activeView === "detail" && (
        <AdjudicationPage
          onBackToClaims={() => setActiveView("claims")}
          onSelectClaim={handleSelectClaim}
          onSubmitReview={handleSubmitReview}
          result={result}
        />
      )}
    </AppShell>
  );
}
