import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search, Stethoscope } from "lucide-react";
import { Link, useLocation } from "react-router";
import Card from "../components/ui/Card.jsx";
import FeedbackState from "../components/ui/FeedbackState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import WorkflowCaseIdForm from "../components/WorkflowCaseIdForm.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { hasRoleAccess } from "../config/navigation.js";
import { createCaseRecommendations, getCasePrediction, getCaseRecord, getRecommendationsForCase, getRecommendationHistory, getWorkflowErrorMessage } from "../services/workflowApi.js";
import { loadFailureKind } from "../utils/formatters.js";

function scoreLabel(value) {
  if (value == null) return "—";
  const score = Number(value);
  return Number.isFinite(score) ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(score) : typeof value === "string" ? value : JSON.stringify(value);
}

function failure(error, fallback) {
  return { kind: loadFailureKind(error), message: getWorkflowErrorMessage(error, fallback) };
}

export default function RecommendationsPage() {
  const location = useLocation();
  const { user } = useAuth();
  const [caseId, setCaseId] = useState(() => new URLSearchParams(location.search).get("caseId") ?? "");
  const [state, setState] = useState({ kind: "idle", caseRecord: null, prediction: null, recommendations: [], noEligibleTeam: false });
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState({ status: "loading", rows: [] });
  const [historySearch, setHistorySearch] = useState("");
  const canGenerate = hasRoleAccess(user, ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DEPARTMENT_HEAD"]);

  useEffect(() => {
    const queryCaseId = new URLSearchParams(location.search).get("caseId");
    if (queryCaseId != null) setCaseId(queryCaseId);
  }, [location.search]);

  useEffect(() => {
    let active = true;
    getRecommendationHistory()
      .then((rows) => { if (active) setHistory({ status: "success", rows }); })
      .catch((error) => { if (active) setHistory({ status: loadFailureKind(error), rows: [] }); });
    return () => { active = false; };
  }, []);

  async function loadRecommendations(value = caseId) {
    const cleanId = value.trim();
    if (!cleanId) return;
    setBusy(true);
    setState({ kind: "loading", caseRecord: null, prediction: null, recommendations: [], noEligibleTeam: false });
    try {
      const caseRecord = await getCaseRecord(cleanId);
      const [predictionResult, recommendationsResult] = await Promise.allSettled([getCasePrediction(cleanId), getRecommendationsForCase(cleanId)]);
      if (predictionResult.status === "rejected" && predictionResult.reason?.status !== 404) throw predictionResult.reason;
      if (recommendationsResult.status === "rejected" && recommendationsResult.reason?.status !== 404) throw recommendationsResult.reason;
      const prediction = predictionResult.status === "fulfilled" ? predictionResult.value : null;
      const recommendations = recommendationsResult.status === "fulfilled" ? recommendationsResult.value : [];
      const noEligibleTeam = String(caseRecord.status ?? "").toLowerCase() === "flagged - no eligible team";
      setState({ kind: recommendations.length ? "success" : prediction ? "ready" : "dependency", caseRecord, prediction, recommendations, noEligibleTeam });
    } catch (error) {
      setState({ kind: error?.status === 404 ? "not-found" : "error", error: failure(error, "Unable to load recommendations. Please try again."), caseRecord: null, prediction: null, recommendations: [], noEligibleTeam: false });
    } finally {
      setBusy(false);
    }
  }

  async function generateRecommendations() {
    if (!canGenerate || !caseId.trim() || !state.prediction || state.recommendations.length) return;
    setBusy(true);
    try {
      const result = await createCaseRecommendations(caseId.trim());
      const noEligibleTeam = result.manual_assignment_required === true || String(result.status ?? "").toLowerCase() === "flagged - no eligible team";
      let recommendations = Array.isArray(result.recommendations) ? result.recommendations : [];
      if (recommendations.length) {
        try { recommendations = await getRecommendationsForCase(caseId.trim()); } catch { /* Keep the real POST response if the follow-up read is unavailable. */ }
      }
      setState({ ...state, kind: recommendations.length ? "success" : "ready", recommendations, noEligibleTeam });
      getRecommendationHistory().then((rows) => setHistory({ status: "success", rows })).catch(() => {});
    } catch (error) {
      if (error?.status === 409) {
        try {
          await loadRecommendations(caseId);
          return;
        } catch {
          // Keep the original dependency or conflict response below.
        }
      }
      setState({ ...state, kind: "error", error: failure(error, "Unable to generate recommendations. Please try again.") });
    } finally {
      setBusy(false);
    }
  }

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase();
    return history.rows.filter((row) => [row.case_id, row.team_id, row.team_name, row.specialization]
      .some((value) => String(value ?? "").toLocaleLowerCase().includes(query)));
  }, [history.rows, historySearch]);

  return (
    <>
      <PageHeader eyebrow="AI workspace" title="Recommendations" description="Review ranked team recommendations for a case. Recommendations remain advisory until human review." />
      <Card className="workflow-action-card">
        <div className="workflow-section-heading"><span className="workflow-section-icon is-indigo"><Stethoscope size={18} aria-hidden="true" /></span><div><p className="card-eyebrow">Team recommendations</p><h2>Enter a case ID</h2></div></div>
        <WorkflowCaseIdForm value={caseId} onChange={setCaseId} onSubmit={() => loadRecommendations()} busy={busy} />
        {state.kind === "idle" ? <FeedbackState type="empty" title="Choose a case to begin." description="Load existing recommendations or check whether the case is ready for team matching." compact /> : null}
        {state.kind === "loading" ? <FeedbackState type="loading" title="Loading case recommendations..." compact /> : null}
        {state.kind === "not-found" ? <FeedbackState type="empty" title="Case not found." description="Check the case ID and try again." compact /> : null}
        {state.kind === "dependency" ? (
          <div className="workflow-dependency-note">
            <FeedbackState type="empty" title="Prediction is required before recommendations can be generated." description="Generate or load a prediction for this case, then return here." compact />
            <Link className="patient-primary-button" to={`/predictions?caseId=${encodeURIComponent(caseId.trim())}`}>Go to prediction <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
        ) : null}
        {state.kind === "ready" ? (
          <div className="workflow-dependency-note">
            {state.noEligibleTeam
              ? <FeedbackState type="unauthorized" title="No eligible team was returned for this case." description="The backend flagged this case for manual assignment. Review case details before proceeding." compact />
              : <FeedbackState type="empty" title="Prediction is available. Recommendations have not been generated." description="Generate recommendations using the current case prediction." compact />}
            {canGenerate && !state.noEligibleTeam ? <button className="patient-primary-button" type="button" disabled={busy} onClick={generateRecommendations}>Generate recommendations</button> : null}
            {!canGenerate ? <p className="workflow-permission-note">Your role can view recommendations but cannot generate them.</p> : null}
          </div>
        ) : null}
        {state.kind === "error" ? <div className="workflow-action-feedback"><FeedbackState type={state.error?.kind ?? "error"} title={state.error?.kind === "unauthorized" ? "Recommendation access is unavailable." : state.error?.kind === "network" ? "Could not connect to recommendations." : "Unable to load recommendations."} description={state.error?.message} compact /><button className="patient-secondary-button" type="button" disabled={busy} onClick={() => loadRecommendations()}>Retry</button></div> : null}
        {state.kind === "success" ? (
          <div className="workflow-recommendation-result">
            <p className="card-eyebrow">Ranked recommendations · {state.caseRecord?.case_id || caseId}</p>
            {state.recommendations.length ? (
              <ol className="workflow-ranked-list workflow-ranked-list-large">
                {state.recommendations.map((item) => (
                  <li key={item.recommendation_id ?? `${item.case_id}-${item.rank}-${item.team_id}`}>
                    <span className="workflow-rank">{item.rank ?? "—"}</span>
                    <span><strong>{item.team_name || item.team_id || "Team unavailable"}</strong><small>{item.team_id || "Team ID unavailable"}{item.specialization ? ` · ${item.specialization}` : ""}</small></span>
                    <b>{scoreLabel(item.recommendation_score)}</b>
                  </li>
                ))}
              </ol>
            ) : <FeedbackState type="empty" title="No eligible team was returned." description="The backend indicates this case requires manual assignment." compact />}
            <p className="workflow-advisory-note">Recommendations are advisory. A human reviewer must approve or override the assignment.</p>
            <div className="report-result-actions">
              <Link className="patient-secondary-button" to={`/cases/${encodeURIComponent(state.caseRecord?.case_id || caseId)}`}>View case <ArrowRight size={14} aria-hidden="true" /></Link>
              <Link className="patient-primary-button" to={`/assignments?caseId=${encodeURIComponent(state.caseRecord?.case_id || caseId)}`}>Continue to human review <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="workflow-list-card">
        <div className="workflow-list-toolbar"><div><p className="card-eyebrow">Recommendation history</p><h2>Recorded team matches</h2></div><label className="patient-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search recommendation history</span><input type="search" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Search case, team, or specialty" /></label></div>
        {history.status === "loading" ? <FeedbackState type="loading" title="Loading recommendation history..." compact />
          : history.status !== "success" ? <FeedbackState type={history.status} title="Recommendation history is unavailable." description="Use the Case ID field above to load case recommendations." compact />
            : filteredHistory.length === 0 ? <FeedbackState type="empty" title={history.rows.length ? "No matching recommendations." : "No recommendations have been recorded."} compact />
              : <div className="patient-table-scroll"><table className="patient-table workflow-history-table"><thead><tr><th>Case</th><th>Rank</th><th>Team</th><th>Specialization</th><th>Score</th><th>Open</th></tr></thead><tbody>{filteredHistory.map((row) => <tr key={row.recommendation_id ?? `${row.case_id}-${row.rank}-${row.team_id}`}><td><Link className="patient-reference" to={`/recommendations?caseId=${encodeURIComponent(row.case_id)}`}>{row.case_id}</Link></td><td>{row.rank ?? "—"}</td><td>{row.team_name || row.team_id || "—"}</td><td>{row.specialization || "—"}</td><td>{scoreLabel(row.recommendation_score)}</td><td><Link className="patient-view-link" to={`/cases/${encodeURIComponent(row.case_id)}`}>View case <ArrowRight size={13} aria-hidden="true" /></Link></td></tr>)}</tbody></table></div>}
        {history.status === "success" && history.rows.length ? <p className="patient-table-footnote">Showing {filteredHistory.length} of {history.rows.length} recommendation records</p> : null}
      </Card>
    </>
  );
}
