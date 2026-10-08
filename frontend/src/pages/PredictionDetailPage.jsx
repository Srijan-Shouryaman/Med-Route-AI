import { useEffect, useState } from "react";
import { Activity, ArrowLeft, ArrowRight } from "lucide-react";
import { Link, useParams } from "react-router";
import Card from "../components/ui/Card.jsx";
import FeedbackState from "../components/ui/FeedbackState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { getPrediction, getWorkflowErrorMessage } from "../services/workflowApi.js";
import { loadFailureKind } from "../utils/formatters.js";

function entries(value) {
  if (Array.isArray(value)) return value.map((item, index) => [item?.department ?? item?.label ?? `Class ${index + 1}`, item?.probability ?? item?.score ?? item]);
  if (value && typeof value === "object") return Object.entries(value);
  if (typeof value === "string") {
    try { return entries(JSON.parse(value)); } catch { return []; }
  }
  return [];
}

function scoreLabel(value) {
  if (value == null) return "—";
  const score = Number(value);
  if (!Number.isFinite(score)) return typeof value === "string" ? value : JSON.stringify(value);
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(score <= 1 ? score * 100 : score)}%`;
}

export default function PredictionDetailPage() {
  const { predictionId } = useParams();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ status: "loading", prediction: null, error: null });

  useEffect(() => {
    let active = true;
    if (!/^\d+$/.test(predictionId ?? "") || Number(predictionId) <= 0) {
      setState({ status: "not-found", prediction: null, error: null });
      return () => { active = false; };
    }
    setState({ status: "loading", prediction: null, error: null });
    getPrediction(predictionId)
      .then((prediction) => { if (active) setState({ status: "success", prediction, error: null }); })
      .catch((error) => { if (active) setState({ status: error?.status === 404 ? "not-found" : loadFailureKind(error), prediction: null, error }); });
    return () => { active = false; };
  }, [predictionId, revision]);

  if (state.status !== "success") {
    const notFound = state.status === "not-found";
    return <><PageHeader eyebrow="AI workspace" title="Prediction detail" /><Card className="workflow-detail-card"><FeedbackState type={state.status === "loading" ? "loading" : notFound ? "empty" : state.status} title={state.status === "loading" ? "Loading prediction..." : notFound ? "Prediction not found." : state.status === "unauthorized" ? "Prediction detail is unavailable for this account." : state.status === "network" ? "Could not connect to prediction history." : "Unable to load this prediction."} description={state.status === "loading" ? undefined : notFound ? "Check the prediction ID and try again." : getWorkflowErrorMessage(state.error, "Please try again in a moment.")} /><div className="patient-detail-error-actions">{!notFound && state.status !== "loading" ? <button className="patient-secondary-button" type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button> : null}<Link className="patient-secondary-button" to="/predictions"><ArrowLeft size={15} aria-hidden="true" /> Prediction history</Link></div></Card></>;
  }

  const prediction = state.prediction;
  const probabilityValues = entries(prediction.decision_function_scores);
  return (
    <>
      <PageHeader eyebrow="AI workspace" title={`Prediction #${prediction.prediction_id}`} description={`Case ${prediction.case_id} · ${prediction.department_name || prediction.predicted_department_id}`} actions={<Link className="patient-back-link" to="/predictions"><ArrowLeft size={15} aria-hidden="true" /> Prediction history</Link>} />
      <Card className="workflow-detail-card">
        <div className="workflow-section-heading"><span className="workflow-section-icon is-indigo"><Activity size={18} aria-hidden="true" /></span><div><p className="card-eyebrow">Prediction record</p><h2>{prediction.department_name || prediction.predicted_department_id || "Department unavailable"}</h2></div></div>
        <dl className="workflow-detail-grid">
          <div className="workflow-detail-value"><dt>Prediction ID</dt><dd>#{prediction.prediction_id}</dd></div>
          <div className="workflow-detail-value"><dt>Case ID</dt><dd>{prediction.case_id}</dd></div>
          <div className="workflow-detail-value"><dt>Predicted department</dt><dd>{prediction.department_name || prediction.predicted_department_id || "—"}</dd></div>
          <div className="workflow-detail-value"><dt>Confidence score</dt><dd>{scoreLabel(prediction.confidence_score)}</dd></div>
          <div className="workflow-detail-value"><dt>Confidence level</dt><dd>{prediction.confidence_level_label || "—"}</dd></div>
          <div className="workflow-detail-value"><dt>Model version</dt><dd>{prediction.model_version || "—"}</dd></div>
        </dl>
        {probabilityValues.length ? <div className="workflow-probabilities"><strong>Class probabilities / scores</strong>{probabilityValues.map(([name, value]) => <span className="workflow-probability-row" key={name}><span>{name}<b>{scoreLabel(value)}</b></span></span>)}</div> : <FeedbackState type="empty" title="No class probabilities or scores were returned." compact />}
        <div className="report-result-actions"><Link className="patient-secondary-button" to={`/cases/${encodeURIComponent(prediction.case_id)}`}>View case <ArrowRight size={14} aria-hidden="true" /></Link><Link className="patient-primary-button" to={`/recommendations?caseId=${encodeURIComponent(prediction.case_id)}`}>Continue to recommendations <ArrowRight size={14} aria-hidden="true" /></Link></div>
      </Card>
    </>
  );
}
