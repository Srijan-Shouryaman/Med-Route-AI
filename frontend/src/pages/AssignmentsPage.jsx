import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Search, UsersRound } from "lucide-react";
import { Link, useLocation } from "react-router";
import Card from "../components/ui/Card.jsx";
import FeedbackState from "../components/ui/FeedbackState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import WorkflowCaseIdForm from "../components/WorkflowCaseIdForm.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { hasRoleAccess } from "../config/navigation.js";
import { approveCaseAssignment, getAssignmentHistory, getCaseAssignment, getCasePrediction, getCaseRecord, getCaseRecommendations, getTeams, getWorkflowErrorMessage, overrideCaseAssignment } from "../services/workflowApi.js";
import { loadFailureKind } from "../utils/formatters.js";

function isEligibleOverrideTeam(team, departmentId, aiTeamId) {
  if (String(team.department_id) !== String(departmentId) || String(team.team_id) === String(aiTeamId)) return false;
  if (String(team.status ?? "").toLowerCase() === "inactive") return false;
  if (["unavailable", "on leave"].includes(String(team.availability ?? "").toLowerCase())) return false;
  const activeCases = Number(team.active_cases);
  const maximumCapacity = Number(team.maximum_capacity);
  return Number.isFinite(activeCases) && Number.isFinite(maximumCapacity) && activeCases < maximumCapacity;
}

function scoreLabel(value) {
  if (value == null) return "—";
  const score = Number(value);
  return Number.isFinite(score) ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(score) : typeof value === "string" ? value : JSON.stringify(value);
}

function failure(error, fallback) {
  return { kind: loadFailureKind(error), message: getWorkflowErrorMessage(error, fallback) };
}

function AssignmentSummary({ assignment, teams }) {
  const aiTeam = teams.find((team) => String(team.team_id) === String(assignment.ai_recommended_team_id));
  const finalTeam = teams.find((team) => String(team.team_id) === String(assignment.final_assigned_team_id));
  return (
    <div className="workflow-assignment-summary">
      <div className="workflow-result-heading">
        <span className="workflow-confidence-icon is-high"><Check size={18} aria-hidden="true" /></span>
        <div><p className="card-eyebrow">Assignment #{assignment.assignment_id}</p><h3>{assignment.human_decision || "Assignment recorded"}</h3></div>
      </div>
      <dl className="workflow-compact-grid">
        <div><dt>Case ID</dt><dd>{assignment.case_id}</dd></div>
        <div><dt>AI recommended team</dt><dd>{assignment.ai_recommended_team_name || aiTeam?.team_name || assignment.ai_recommended_team_id || "—"}</dd></div>
        <div><dt>Recommendation score</dt><dd>{scoreLabel(assignment.ai_recommendation_score)}</dd></div>
        <div><dt>Final assigned team</dt><dd>{assignment.final_assigned_team_name || finalTeam?.team_name || assignment.final_assigned_team_id || "—"}</dd></div>
        <div><dt>Decision</dt><dd>{assignment.human_decision || "—"}</dd></div>
        <div><dt>Approved by</dt><dd>{assignment.approving_user || "—"}</dd></div>
        {assignment.override_reason ? <div className="workflow-value-wide"><dt>Override reason</dt><dd>{assignment.override_reason}</dd></div> : null}
      </dl>
      <Link className="patient-primary-button workflow-related-action" to={`/cases/${encodeURIComponent(assignment.case_id)}`}>View case <ArrowRight size={14} aria-hidden="true" /></Link>
    </div>
  );
}

export default function AssignmentsPage() {
  const location = useLocation();
  const { user } = useAuth();
  const [caseId, setCaseId] = useState(() => new URLSearchParams(location.search).get("caseId") ?? "");
  const [state, setState] = useState({ kind: "idle", caseRecord: null, prediction: null, recommendations: [], assignment: null, teams: [], teamLoadError: "" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [history, setHistory] = useState({ status: "loading", rows: [] });
  const [historySearch, setHistorySearch] = useState("");
  const canReview = hasRoleAccess(user, ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DEPARTMENT_HEAD", "DOCTOR"]);
  const approvingUser = String(user?.full_name || user?.email || "").trim();

  useEffect(() => {
    const queryCaseId = new URLSearchParams(location.search).get("caseId");
    if (queryCaseId != null) setCaseId(queryCaseId);
  }, [location.search]);

  useEffect(() => {
    let active = true;
    getAssignmentHistory()
      .then((rows) => { if (active) setHistory({ status: "success", rows }); })
      .catch((error) => { if (active) setHistory({ status: loadFailureKind(error), rows: [] }); });
    return () => { active = false; };
  }, []);

  async function loadCase(value = caseId) {
    const cleanId = value.trim();
    if (!cleanId || busy) return;
    setBusy(true);
    setActionError("");
    setOverrideOpen(false);
    setState({ kind: "loading", caseRecord: null, prediction: null, recommendations: [], assignment: null, teams: [], teamLoadError: "" });
    try {
      const caseRecord = await getCaseRecord(cleanId);
      const [predictionResult, recommendationsResult, assignmentResult, teamsResult] = await Promise.allSettled([
        getCasePrediction(cleanId), getCaseRecommendations(cleanId), getCaseAssignment(cleanId), getTeams(),
      ]);
      const firstNon404Failure = [predictionResult, recommendationsResult, assignmentResult]
        .find((result) => result.status === "rejected" && result.reason?.status !== 404);
      if (firstNon404Failure) throw firstNon404Failure.reason;
      const prediction = predictionResult.status === "fulfilled" ? predictionResult.value : null;
      const recommendations = recommendationsResult.status === "fulfilled" ? recommendationsResult.value : [];
      const assignment = assignmentResult.status === "fulfilled" ? assignmentResult.value : null;
      const teams = teamsResult.status === "fulfilled" ? teamsResult.value : [];
      const teamLoadError = teamsResult.status === "rejected" ? getWorkflowErrorMessage(teamsResult.reason, "Eligible teams could not be loaded.") : "";
      setState({ kind: assignment ? "assigned" : "loaded", caseRecord, prediction, recommendations, assignment, teams, teamLoadError });
    } catch (error) {
      setState({ kind: error?.status === 404 ? "not-found" : "error", error: failure(error, "Unable to load human review details. Please try again."), caseRecord: null, prediction: null, recommendations: [], assignment: null, teams: [], teamLoadError: "" });
    } finally {
      setBusy(false);
    }
  }

  const topRecommendation = state.recommendations[0] ?? null;
  const eligibleTeams = state.prediction && topRecommendation
    ? state.teams.filter((team) => isEligibleOverrideTeam(team, state.prediction.predicted_department_id, topRecommendation.team_id))
    : [];
  const readyForReview = state.caseRecord && state.prediction && topRecommendation
    && ["pending human review", "recommended"].includes(String(state.caseRecord.status ?? "").toLowerCase())
    && !state.assignment;

  async function refreshAfterAssignment(assignment) {
    const [caseResult, assignmentResult] = await Promise.allSettled([getCaseRecord(caseId.trim()), getCaseAssignment(caseId.trim())]);
    const latestCase = caseResult.status === "fulfilled" ? caseResult.value : state.caseRecord;
    const latestAssignment = assignmentResult.status === "fulfilled" ? assignmentResult.value : assignment;
    setState({ ...state, kind: "assigned", caseRecord: latestCase, assignment: latestAssignment });
    getAssignmentHistory().then((rows) => setHistory({ status: "success", rows })).catch(() => {});
  }

  async function approve() {
    if (!canReview || !readyForReview || !approvingUser) return;
    const teamName = topRecommendation.team_name || topRecommendation.team_id;
    if (!window.confirm(`Approve the AI recommendation for ${caseId.trim()} and assign it to ${teamName}?`)) return;
    setBusy(true);
    setActionError("");
    try {
      const assignment = await approveCaseAssignment(caseId.trim(), approvingUser);
      await refreshAfterAssignment(assignment);
    } catch (error) {
      setActionError(getWorkflowErrorMessage(error, "Unable to approve this assignment. Please review the case status and try again."));
    } finally {
      setBusy(false);
    }
  }

  async function override() {
    if (!canReview || !readyForReview || !selectedTeamId || !overrideReason.trim() || !approvingUser) return;
    const selectedTeam = eligibleTeams.find((team) => String(team.team_id) === String(selectedTeamId));
    if (!selectedTeam || !window.confirm(`Assign ${caseId.trim()} to ${selectedTeam.team_name} instead of the AI recommended team?`)) return;
    setBusy(true);
    setActionError("");
    try {
      const assignment = await overrideCaseAssignment(caseId.trim(), { teamId: selectedTeamId, reason: overrideReason.trim(), approvingUser });
      setOverrideOpen(false);
      setOverrideReason("");
      await refreshAfterAssignment(assignment);
    } catch (error) {
      setActionError(getWorkflowErrorMessage(error, "Unable to override this assignment. Check team eligibility and try again."));
    } finally {
      setBusy(false);
    }
  }

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase();
    return history.rows.filter((row) => [row.assignment_id, row.case_id, row.ai_recommended_team_id, row.ai_recommended_team_name, row.final_assigned_team_id, row.final_assigned_team_name, row.human_decision]
      .some((value) => String(value ?? "").toLocaleLowerCase().includes(query)));
  }, [history.rows, historySearch]);

  return (
    <>
      <PageHeader eyebrow="AI Workspace" title="Assignments" description="Review assignment history or load a case for human review." />
      <Card className="workflow-action-card assignments-action-card">
        <div className="assignments-action-layout">
          <div className="workflow-section-heading assignments-action-heading"><div><h2>Load a case for review</h2><p className="assignments-action-description">Load the case's prediction, recommendations, and existing assignment for review.</p></div></div>
          <div className="assignments-action-controls"><WorkflowCaseIdForm value={caseId} onChange={setCaseId} onSubmit={() => loadCase()} busy={busy} submitLabel="Load / Review" placeholder="Enter case ID, e.g. C0102" /></div>
        </div>
        {state.kind === "loading" ? <FeedbackState type="loading" title="Loading case review details..." compact /> : null}
        {state.kind === "not-found" ? <FeedbackState type="empty" title="Case not found." description="Check the case ID and try again." compact /> : null}
        {state.kind === "error" ? <div className="workflow-action-feedback"><FeedbackState type={state.error?.kind ?? "error"} title={state.error?.kind === "unauthorized" ? "Assignment access is unavailable." : state.error?.kind === "network" ? "Could not connect to human review." : "Unable to load assignment details."} description={state.error?.message} compact /><button className="patient-secondary-button" type="button" disabled={busy} onClick={() => loadCase()}>Retry</button></div> : null}
        {state.kind === "loaded" && !state.prediction ? (
          <div className="workflow-dependency-note"><FeedbackState type="empty" title="A prediction is required before team recommendations and assignment review." compact /><Link className="patient-primary-button" to={`/predictions?caseId=${encodeURIComponent(caseId.trim())}`}>Go to prediction <ArrowRight size={14} aria-hidden="true" /></Link></div>
        ) : null}
        {state.kind === "loaded" && state.prediction && !state.recommendations.length ? (
          <div className="workflow-dependency-note"><FeedbackState type="empty" title="No team recommendations exist for this case." description="Generate recommendations before human review." compact /><Link className="patient-primary-button" to={`/recommendations?caseId=${encodeURIComponent(caseId.trim())}`}>Go to recommendations <ArrowRight size={14} aria-hidden="true" /></Link></div>
        ) : null}
        {state.kind === "loaded" && state.caseRecord && state.prediction && state.recommendations.length && !readyForReview ? (
          <div className="workflow-dependency-note"><FeedbackState type="empty" title={`Human review is unavailable while the case status is “${state.caseRecord.status || "Unknown"}”.`} description="Assignment decisions can be made while a case is awaiting human review." compact /></div>
        ) : null}
        {readyForReview ? (
          <div className="workflow-review-panel">
            <div className="workflow-review-highlight">
              <span className="workflow-section-icon is-indigo"><UsersRound size={18} aria-hidden="true" /></span>
              <div><p className="card-eyebrow">AI recommended team</p><h3>{topRecommendation.team_name || topRecommendation.team_id || "Team unavailable"}</h3><p>{topRecommendation.team_id || "ID unavailable"}{topRecommendation.specialization ? ` · ${topRecommendation.specialization}` : ""}</p></div>
              <strong>{scoreLabel(topRecommendation.recommendation_score)}</strong>
            </div>
            {!canReview ? <p className="workflow-permission-note">Your role can view review details but cannot approve or override assignments.</p> : (
              <div className="workflow-review-actions">
                <button className={`patient-primary-button review-action-button ${overrideOpen ? "is-unselected" : "is-selected"}`} type="button" aria-pressed={!overrideOpen} disabled={busy} onClick={() => { if (overrideOpen) { setOverrideOpen(false); setActionError(""); return; } approve(); }}><Check size={15} aria-hidden="true" /> Approve AI recommendation</button>
                <button className={`patient-secondary-button review-action-button ${overrideOpen ? "is-selected" : "is-unselected"}`} type="button" aria-pressed={overrideOpen} disabled={busy || !eligibleTeams.length} onClick={() => { setOverrideOpen((open) => !open); setActionError(""); }}><UsersRound size={15} aria-hidden="true" /> Override assignment</button>
              </div>
            )}
            {canReview && state.teamLoadError ? <p className="workflow-permission-note">{state.teamLoadError} Override is unavailable until the eligible team list loads; the recommendation can still be approved.</p> : null}
            {canReview && !state.teamLoadError && !eligibleTeams.length ? <p className="workflow-permission-note">No eligible alternative team is available in the predicted department. The recommendation can still be approved if the case is ready.</p> : null}
            {overrideOpen && canReview ? (
              <div className="workflow-override-form">
                <label className="patient-field"><span>Select eligible final team <b>*</b></span><select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)} required><option value="">Choose a team</option>{eligibleTeams.map((team) => <option key={team.team_id} value={team.team_id}>{team.team_name} · {team.team_id} · {team.availability} · {team.active_cases}/{team.maximum_capacity} cases</option>)}</select></label>
                <label className="patient-field"><span>Override reason <b>*</b></span><textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} rows={3} maxLength={1000} required placeholder="Explain why a different eligible team is preferred." /></label>
                <div className="workflow-review-actions"><button className="patient-secondary-button" type="button" disabled={busy} onClick={() => { setOverrideOpen(false); setOverrideReason(""); setSelectedTeamId(""); }}>Cancel</button><button className="patient-primary-button" type="button" disabled={busy || !selectedTeamId || !overrideReason.trim()} onClick={override}>Confirm override</button></div>
              </div>
            ) : null}
          </div>
        ) : null}
        {actionError ? <div className="patient-form-error" role="alert">{actionError}</div> : null}
        {state.kind === "assigned" && state.assignment ? <AssignmentSummary assignment={state.assignment} teams={state.teams} /> : null}
        {state.caseRecord ? <div className="workflow-current-status"><span>Current case status</span><StatusBadge status={state.caseRecord.status}>{state.caseRecord.status || "Unknown"}</StatusBadge><Link to={`/cases/${encodeURIComponent(state.caseRecord.case_id)}`}>View case <ArrowRight size={13} aria-hidden="true" /></Link></div> : null}
      </Card>

      <Card className="workflow-list-card">
        <div className="workflow-list-toolbar"><div><p className="card-eyebrow">Assignment history</p><h2>Recorded assignments</h2></div><label className="patient-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search assignment history</span><input type="search" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Search assignment, case, or team" /></label></div>
        {history.status === "loading" ? <FeedbackState type="loading" title="Loading assignment history..." compact />
          : history.status !== "success" ? <FeedbackState type={history.status} title="Assignment history is unavailable." compact />
            : filteredHistory.length === 0 ? <FeedbackState type="empty" title={history.rows.length ? "No matching assignments." : "No assignments have been recorded."} compact />
              : <div className="patient-table-scroll"><table className="patient-table workflow-history-table"><thead><tr><th>Assignment</th><th>Case</th><th>AI team</th><th>Final team</th><th>Decision</th><th>Open</th></tr></thead><tbody>{filteredHistory.map((row) => <tr key={row.assignment_id}><td><Link className="patient-reference" to={`/assignments/${row.assignment_id}`}>#{row.assignment_id}</Link></td><td><Link className="patient-reference" to={`/cases/${encodeURIComponent(row.case_id)}`}>{row.case_id}</Link></td><td>{row.ai_recommended_team_name || row.ai_recommended_team_id || "—"}</td><td>{row.final_assigned_team_name || row.final_assigned_team_id || "—"}</td><td>{row.human_decision || "—"}</td><td><Link className="patient-view-link" to={`/assignments/${row.assignment_id}`}>View assignment <ArrowRight size={13} aria-hidden="true" /></Link></td></tr>)}</tbody></table></div>}
        {history.status === "success" && history.rows.length ? <p className="patient-table-footnote">Showing {filteredHistory.length} of {history.rows.length} assignments</p> : null}
      </Card>
    </>
  );
}
