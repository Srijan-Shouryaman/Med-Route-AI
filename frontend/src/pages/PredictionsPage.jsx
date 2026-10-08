import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Search } from "lucide-react";
import { Link, useLocation } from "react-router";
import Card from "../components/ui/Card.jsx";
import FeedbackState from "../components/ui/FeedbackState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import WorkflowCaseIdForm from "../components/WorkflowCaseIdForm.jsx";
import { useAuth } from "../auth/AuthContext.jsx";
import { hasRoleAccess } from "../config/navigation.js";
import { createCasePrediction, getCasePrediction, getCaseRecord, getPredictionHistory, getWorkflowErrorMessage } from "../services/workflowApi.js";
import { loadFailureKind } from "../utils/formatters.js";

function scoreLabel(value) {
  if (value == null) return "—";
  const score = Number(value);
  if (!Number.isFinite(score)) return typeof value === "string" ? value : JSON.stringify(value);
  const percent = score <= 1 ? score * 100 : score;
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(percent)}%`;
}

function getProbabilityEntries(value) {
  if (Array.isArray(value)) return value.map((item, index) => [item?.department ?? item?.label ?? `Class ${index + 1}`, item?.probability ?? item?.score ?? item]);
  if (value && typeof value === "object") return Object.entries(value);
  if (typeof value === "string") {
    try { return getProbabilityEntries(JSON.parse(value)); } catch { return []; }
  }
  return [];
}

function errorState(error) {
  return { kind: loadFailureKind(error), message: getWorkflowErrorMessage(error, "Unable to load the prediction. Please try again.") };
}

export default function PredictionsPage() {
  const location = useLocation();
  const { user } = useAuth();
  const [caseId, setCaseId] = useState(() => new URLSearchParams(location.search).get("caseId") ?? "");
  const [state, setState] = useState({ kind: "idle", caseRecord: null, prediction: null });
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
    getPredictionHistory()
      .then((rows) => { if (active) setHistory({ status: "success", rows }); })
      .catch((error) => { if (active) setHistory({ status: loadFailureKind(error), rows: [] }); });
    return () => { active = false; };
  }, []);

  async function loadPrediction(value = caseId) {
    const cleanId = value.trim();
    if (!cleanId) return;
    setBusy(true);
    setState({ kind: "loading", caseRecord: null, prediction: null });
    try {
      const caseRecord = await getCaseRecord(cleanId);
      try {
        const prediction = await getCasePrediction(cleanId);
        setState({ kind: "success", caseRecord, prediction });
      } catch (error) {
        if (error?.status === 404) setState({ kind: "missing", caseRecord, prediction: null });
        else setState({ kind: "error", error: errorState(error), caseRecord, prediction: null });
      }
    } catch (error) {
      setState({ kind: error?.status === 404 ? "not-found" : "error", error: errorState(error), caseRecord: null, prediction: null });
    } finally {
      setBusy(false);
    }
  }

  async function generatePrediction() {
    if (!canGenerate || !caseId.trim()) return;
    setBusy(true);
    try {
      const prediction = await createCasePrediction(caseId.trim());
      const caseRecord = await getCaseRecord(caseId.trim()).catch(() => state.caseRecord);
      setState({ kind: "success", caseRecord, prediction });
      getPredictionHistory().then((rows) => setHistory({ status: "success", rows })).catch(() => {});
    } catch (error) {
      if (error?.status === 409) {
        try {
          const [caseRecord, prediction] = await Promise.all([getCaseRecord(caseId.trim()), getCasePrediction(caseId.trim())]);
          setState({ kind: "success", caseRecord, prediction });
          return;
        } catch {
          // Preserve the original conflict message if this was not a duplicate request.
        }
      }
      setState({ kind: "error", error: errorState(error), caseRecord: state.caseRecord, prediction: null });
    } finally {
      setBusy(false);
    }
  }

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase();
    return history.rows.filter((row) => [row.case_id, row.department_name, row.predicted_department, row.confidence_level_label]
      .some((value) => String(value ?? "").toLocaleLowerCase().includes(query)));
  }, [history.rows, historySearch]);

  const prediction = state.prediction;
  const probabilities = getProbabilityEntries(prediction?.class_probabilities ?? prediction?.decision_function_scores);
  const confidence = Number(prediction?.confidence_score);
  const confidenceLevel = String(prediction?.confidence_level || prediction?.confidence_level_label || "").toLowerCase();
  const confidenceClass = confidenceLevel.includes("high") ? "is-high"
    : confidenceLevel.includes("medium") ? "is-medium"
      : confidenceLevel.includes("low") ? "is-low"
        : !Number.isFinite(confidence) ? ""
          : confidence >= (confidence <= 1 ? 0.7 : 70) ? "is-high"
            : confidence >= (confidence <= 1 ? 0.45 : 45) ? "is-medium" : "is-low";

  return (
    <>
      <PageHeader eyebrow="AI workspace" title="Predictions" description="Load or generate the department prediction for any case ID." />
      <Card className="workflow-action-card">
        <div className="workflow-section-heading">
          <span className="workflow-section-icon is-indigo"><Activity size={18} aria-hidden="true" /></span>
          <div><p className="card-eyebrow">Case prediction</p><h2>Enter a case ID</h2></div>
        </div>
        <WorkflowCaseIdForm value={caseId} onChange={setCaseId} onSubmit={() => loadPrediction()} busy={busy} />
        {state.kind === "idle" ? <FeedbackState type="empty" title="Choose a case to begin." description="Predictions can be loaded or generated independently by Case ID." compact /> : null}
        {state.kind === "loading" ? <FeedbackState type="loading" title="Loading case prediction..." compact /> : null}
        {state.kind === "not-found" ? <FeedbackState type="empty" title="Case not found." description="Check the case ID and try again." compact /> : null}
        {state.kind === "missing" ? (
          <div className="workflow-dependency-note">
            <FeedbackState type="empty" title="No prediction exists for this case yet." description="Generate a prediction to continue the workflow." compact />
            {canGenerate ? <button className="patient-primary-button" type="button" disabled={busy} onClick={generatePrediction}>Generate prediction</button> : <p className="workflow-permission-note">Your role can view predictions but cannot generate them.</p>}
          </div>
        ) : null}
        {state.kind === "error" ? (
          <div className="workflow-action-feedback">
            <FeedbackState type={state.error?.kind ?? "error"} title={state.error?.kind === "unauthorized" ? "Prediction access is unavailable." : state.error?.kind === "network" ? "Could not connect to predictions." : "Unable to load this prediction."} description={state.error?.message} compact />
            {state.error?.kind !== "unauthorized" ? <button className="patient-secondary-button" type="button" disabled={busy} onClick={() => loadPrediction()}>Retry</button> : null}
          </div>
        ) : null}
        {state.kind === "success" && prediction ? (
          <div className="workflow-prediction-result">
            <div className="workflow-result-heading">
              <span className={`workflow-confidence-icon ${confidenceClass}`}><Activity size={18} aria-hidden="true" /></span>
              <div><p className="card-eyebrow">Prediction result · {prediction.case_id || caseId}</p><h3>{prediction.predicted_department || prediction.department_name || prediction.predicted_department_id || "Department unavailable"}</h3></div>
              <StatusBadge status={String(prediction.confidence_level || prediction.confidence_level_label || "").toLowerCase()}>{prediction.confidence_level || prediction.confidence_level_label || "Confidence unavailable"}</StatusBadge>
            </div>
            <div className="workflow-confidence-summary"><span>Confidence</span><strong className={confidenceClass}>{scoreLabel(prediction.confidence_score)}</strong></div>
            {probabilities.length ? (
              <div className="workflow-probabilities"><strong>Class probabilities / scores</strong>{probabilities.map(([name, value]) => {
                const number = Number(value);
                const bar = Number.isFinite(number) ? Math.max(0, Math.min(100, number <= 1 ? number * 100 : number)) : 0;
                return <span key={name} className="workflow-probability-row"><span>{name}<b>{scoreLabel(value)}</b></span><i><em style={{ width: `${bar}%` }} /></i></span>;
              })}</div>
            ) : null}
            {prediction.model_version ? <p className="workflow-model-version">Model version: {prediction.model_version}</p> : null}
            <div className="report-result-actions">
              <Link className="patient-secondary-button" to={`/cases/${encodeURIComponent(prediction.case_id || caseId)}`}>View case <ArrowRight size={14} aria-hidden="true" /></Link>
              <Link className="patient-primary-button" to={`/recommendations?caseId=${encodeURIComponent(prediction.case_id || caseId)}`}>Continue to recommendations <ArrowRight size={14} aria-hidden="true" /></Link>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="workflow-list-card">
        <div className="workflow-list-toolbar">
          <div><p className="card-eyebrow">Prediction history</p><h2>Recorded predictions</h2></div>
          <label className="patient-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Search prediction history</span><input type="search" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Search case or department" /></label>
        </div>
        {history.status === "loading" ? <FeedbackState type="loading" title="Loading prediction history..." compact />
          : history.status !== "success" ? <FeedbackState type={history.status} title="Prediction history is unavailable." description="Use the Case ID field above to load a prediction." compact />
            : filteredHistory.length === 0 ? <FeedbackState type="empty" title={history.rows.length ? "No matching predictions." : "No predictions have been recorded."} compact />
              : <div className="patient-table-scroll"><table className="patient-table workflow-history-table"><thead><tr><th>Prediction</th><th>Case</th><th>Department</th><th>Confidence</th><th>Level</th><th>Model</th><th>Open</th></tr></thead><tbody>{filteredHistory.map((row) => <tr key={row.prediction_id}><td><Link className="patient-reference" to={`/predictions/${row.prediction_id}`}>#{row.prediction_id}</Link></td><td><Link className="patient-reference" to={`/predictions?caseId=${encodeURIComponent(row.case_id)}`}>{row.case_id}</Link></td><td>{row.department_name || row.predicted_department || row.predicted_department_id || "—"}</td><td>{scoreLabel(row.confidence_score)}</td><td>{row.confidence_level_label || row.confidence_level || "—"}</td><td>{row.model_version || "—"}</td><td><Link className="patient-view-link" to={`/cases/${encodeURIComponent(row.case_id)}`}>View case <ArrowRight size={13} aria-hidden="true" /></Link></td></tr>)}</tbody></table></div>}
        {history.status === "success" && history.rows.length ? <p className="patient-table-footnote">Showing {filteredHistory.length} of {history.rows.length} predictions</p> : null}
      </Card>
    </>
  );
}
