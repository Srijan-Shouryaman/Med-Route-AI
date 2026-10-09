import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
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

function factorEntries(value) {
  let factors = value;
  if (typeof factors === "string") {
    try { factors = JSON.parse(factors); } catch { return []; }
  }
  return factors && typeof factors === "object" && !Array.isArray(factors) ? Object.entries(factors) : [];
}

function normalizedScore(value) {
  if (value == null || value === "") return null;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 100 ? score : null;
}

function factorLevel(score) {
  if (score < 40) return "Low";
  if (score < 70) return "Medium";
  return "High";
}

function isEnabled(value) {
  return value === true || value === 1 || String(value).toLowerCase() === "true";
}

function recommendationFactorRatings(item, caseRecord) {
  const breakdown = Object.fromEntries(factorEntries(item.score_breakdown ?? item.contributing_factors));
  const definitions = [
    // The current case endpoint does not return requested_specialization. A
    // specialization score of 80 is the backend's neutral default when it is
    // missing, so only interpret this factor when the request is available.
    ...(caseRecord?.requested_specialization ? [{ key: "specialization", label: "Specialization match" }] : []),
    { key: "experience", label: "Experience" },
    { key: "availability", label: "Availability" },
    // This persisted value is a workload suitability score, not workload magnitude.
    { key: "workload", label: "Workload fit" },
    { key: "historical", label: "Historical performance" },
    ...(isEnabled(caseRecord?.is_emergency) ? [{ key: "emergency", label: "Emergency suitability" }] : []),
  ];

  return definitions.flatMap((definition) => {
    const score = normalizedScore(breakdown[definition.key]);
    return score == null ? [] : [{ ...definition, score, level: factorLevel(score) }];
  });
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
    if (!cleanId || busy) return;
    setBusy(true);
    setState({ kind: "loading", caseRecord: null, prediction: null, recommendations: [], noEligibleTeam: false });
    try {
      const caseRecord = await getCaseRecord(cleanId);
      const [predictionResult, recommendationsResult] = await Promise.allSettled([getCasePrediction(cleanId), getRecommendationsForCase(cleanId)]);
      if (recommendationsResult.status === "rejected" && recommendationsResult.reason?.status !== 404) throw recommendationsResult.reason;
      const prediction = predictionResult.status === "fulfilled" ? predictionResult.value : null;
      const recommendations = recommendationsResult.status === "fulfilled" ? recommendationsResult.value : [];
      const noEligibleTeam = String(caseRecord.status ?? "").toLowerCase() === "flagged - no eligible team";
      if (recommendations.length) {
        setState({ kind: "success", source: "existing", caseRecord, prediction, recommendations, noEligibleTeam: false });
        return;
      }
      if (predictionResult.status === "rejected" && predictionResult.reason?.status !== 404) throw predictionResult.reason;
      if (noEligibleTeam) {
        setState({ kind: "ready", caseRecord, prediction, recommendations: [], noEligibleTeam: true });
        return;
      }
      if (!prediction) {
        setState({ kind: "dependency", caseRecord, prediction: null, recommendations: [], noEligibleTeam: false });
        return;
      }
      if (!canGenerate) {
        setState({ kind: "ready", caseRecord, prediction, recommendations: [], noEligibleTeam: false });
        return;
      }

      const result = await createCaseRecommendations(cleanId);
      const generatedNoEligibleTeam = result.manual_assignment_required === true || String(result.status ?? "").toLowerCase() === "flagged - no eligible team";
      let generatedRecommendations = Array.isArray(result.recommendations) ? result.recommendations : [];
      if (generatedRecommendations.length) {
        try { generatedRecommendations = await getRecommendationsForCase(cleanId); } catch { /* Keep the real POST response if the follow-up read is unavailable. */ }
      }
      setState({
        kind: generatedRecommendations.length ? "success" : "ready",
        source: "generated",
        caseRecord,
        prediction,
        recommendations: generatedRecommendations,
        noEligibleTeam: generatedNoEligibleTeam,
      });
      if (generatedRecommendations.length) {
        getRecommendationHistory().then((rows) => setHistory({ status: "success", rows })).catch(() => {});
      }
    } catch (error) {
      if (error?.status === 409) {
        try {
          const [caseRecord, predictionResult, recommendations] = await Promise.all([
            getCaseRecord(cleanId),
            getCasePrediction(cleanId).catch(() => null),
            getRecommendationsForCase(cleanId),
          ]);
          if (recommendations.length) {
            setState({ kind: "success", source: "existing", caseRecord, prediction: predictionResult, recommendations, noEligibleTeam: false });
            getRecommendationHistory().then((rows) => setHistory({ status: "success", rows })).catch(() => {});
            return;
          }
        } catch {
          // Preserve the original conflict or prerequisite message if no recommendations were created.
        }
      }
      setState({ kind: error?.status === 404 ? "not-found" : "error", error: failure(error, "Unable to load or generate recommendations. Please try again."), caseRecord: null, prediction: null, recommendations: [], noEligibleTeam: false });
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
      <PageHeader title="Recommendations" />
      <Card className="workflow-action-card recommendations-action-card">
        <div className="recommendations-action-layout">
          <div className="recommendations-action-intro">
            <h2>Generate Recommendations</h2>
            <p>Load existing team recommendations or generate them if none exist for the case.</p>
          </div>
          <div className="recommendations-action-controls">
            <WorkflowCaseIdForm value={caseId} onChange={setCaseId} onSubmit={() => loadRecommendations()} busy={busy} submitLabel="Load / Generate" placeholder="Enter case ID, e.g. C0102" />
          </div>
        </div>
        {state.kind === "loading" ? <FeedbackState type="loading" title="Loading or generating recommendations..." compact /> : null}
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
              : state.source === "generated"
                ? <FeedbackState type="empty" title="No recommendations were returned for this case." description="There are no team recommendation records to display." compact />
                : <FeedbackState type="empty" title="Prediction is available. Recommendations have not been generated." compact />}
            {!canGenerate && !state.noEligibleTeam ? <p className="workflow-permission-note">Your role can view recommendations but cannot generate them.</p> : null}
          </div>
        ) : null}
        {state.kind === "error" ? <div className="workflow-action-feedback"><FeedbackState type={state.error?.kind ?? "error"} title={state.error?.kind === "unauthorized" ? "Recommendation access is unavailable." : state.error?.kind === "network" ? "Could not connect to recommendations." : "Unable to load or generate recommendations."} description={state.error?.message} compact /><button className="patient-secondary-button" type="button" disabled={busy} onClick={() => loadRecommendations()}>Retry</button></div> : null}
        {state.kind === "success" ? (
          <div className="workflow-recommendation-result">
            <p className="card-eyebrow">{state.source === "generated" ? "Generated team recommendations" : "Loaded team recommendations"} · {state.caseRecord?.case_id || caseId}</p>
            {state.recommendations.length ? (
              <ol className="workflow-ranked-list workflow-ranked-list-large">
                {state.recommendations.map((item) => {
                  const factors = recommendationFactorRatings(item, state.caseRecord);
                  const overallScore = normalizedScore(item.recommendation_score);
                  const firstRanked = Number(item.rank) === 1;
                  return (
                    <li className={`recommendation-visual-card${firstRanked ? " is-top-ranked" : ""}`} key={item.recommendation_id ?? `${item.case_id}-${item.rank}-${item.team_id}`}>
                      <span className={`workflow-rank recommendation-rank${firstRanked ? " is-top-ranked" : ""}`} aria-label={`Rank ${item.rank ?? "unavailable"}`}>{item.rank ?? "—"}</span>
                      <div className="recommendation-visual-content">
                        <div className="recommendation-visual-heading">
                          <div className="recommendation-team-details">
                            <strong>{item.team_name || item.team_id || "Team unavailable"}</strong>
                            <small>{item.team_id || "Team ID unavailable"}{item.specialization ? ` · ${item.specialization}` : ""}</small>
                          </div>
                          <div className="recommendation-overall-score">
                            <span>Overall score</span>
                            <b>{overallScore == null ? "Unavailable" : <>{scoreLabel(item.recommendation_score)}<small> / 100</small></>}</b>
                          </div>
                        </div>
                        {overallScore == null
                          ? <p className="recommendation-score-unavailable">Score indicator unavailable</p>
                          : <div className="recommendation-score-meter" role="meter" aria-label="Overall recommendation score" aria-valuemin="0" aria-valuemax="100" aria-valuenow={overallScore}><span style={{ width: `${overallScore}%` }} /></div>}
                        {factors.length ? (
                          <div className="recommendation-factor-list" aria-label="Contributing factor ratings">
                            {factors.map((factor) => <span className={`recommendation-factor-badge is-${factor.level.toLowerCase()}`} key={factor.key}>{factor.label}<b>{factor.level}</b></span>)}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : <FeedbackState type="empty" title="No eligible team was returned." description="The backend indicates this case requires manual assignment." compact />}
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
