import { useEffect, useState } from "react";
import { Activity, ArrowLeft, ArrowRight, Check, ClipboardList, FileText, UserRound } from "lucide-react";
import { Link, useParams } from "react-router";
import Card from "../components/ui/Card.jsx";
import FeedbackState from "../components/ui/FeedbackState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import { getPatientByReference } from "../services/patientApi.js";
import { getCaseAssignment, getCasePrediction, getCaseRecommendations, getCaseRecord, getReports } from "../services/workflowApi.js";
import { formatDate, loadFailureKind } from "../utils/formatters.js";

const progressedStatuses = new Set(["pending human review", "assigned", "in progress", "resolved"]);

function scoreLabel(value, percentFromFraction = false) {
  if (value == null) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return typeof value === "string" ? value : JSON.stringify(value);
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(percentFromFraction && number <= 1 ? number * 100 : number)}%`;
}

function probabilityEntries(value) {
  if (Array.isArray(value)) return value.map((entry, index) => [entry?.department ?? entry?.label ?? `Class ${index + 1}`, entry?.probability ?? entry?.score ?? entry]);
  if (value && typeof value === "object") return Object.entries(value);
  if (typeof value === "string") {
    try {
      return probabilityEntries(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

function Timeline({ caseRecord, report, prediction, recommendations, assignment }) {
  const status = String(caseRecord.status ?? "").toLowerCase();
  const hasReport = Boolean(report);
  const hasPrediction = Boolean(prediction);
  const hasRecommendations = recommendations.length > 0 || progressedStatuses.has(status);
  const hasAssignment = Boolean(assignment);
  const humanReviewCompleted = hasAssignment || ["assigned", "in progress", "resolved"].includes(status);
  const noEligibleTeam = status === "flagged - no eligible team";
  const stages = [
    { label: "Report uploaded", detail: report?.original_filename || (hasReport ? `Report #${report.report_id}` : "No linked report was returned."), done: hasReport, current: false },
    { label: "Prediction", detail: prediction?.predicted_department || prediction?.department_name || (hasPrediction ? "Prediction recorded" : "Not generated"), done: hasPrediction, current: !hasPrediction && status === "pending prediction" },
    { label: "Recommendations", detail: recommendations.length ? `${recommendations.length} ranked team${recommendations.length === 1 ? "" : "s"}` : noEligibleTeam ? "No eligible team was returned" : hasRecommendations ? "Recommendation stage completed" : "Not generated", done: hasRecommendations, current: status === "pending human review" || noEligibleTeam },
    { label: "Human review", detail: assignment?.human_decision || (humanReviewCompleted ? "Case status confirms review completed" : status === "pending human review" ? "Awaiting a decision" : "No decision recorded"), done: humanReviewCompleted, current: status === "pending human review" && !hasAssignment },
    { label: "Assignment", detail: assignment ? `${assignment.final_assigned_team_name || assignment.final_assigned_team_id || "Team assigned"}` : status === "assigned" ? "Assigned according to case status" : "Not assigned", done: hasAssignment || ["assigned", "in progress", "resolved"].includes(status), current: false },
    { label: "In Progress", detail: ["in progress", "resolved"].includes(status) ? "Current case status confirms this stage" : "Not started", done: ["in progress", "resolved"].includes(status), current: status === "in progress" },
    { label: "Resolved", detail: status === "resolved" ? "Case status is Resolved" : "Not resolved", done: status === "resolved", current: false },
  ];

  return (
    <ol className="case-timeline">
      {stages.map((stage) => (
        <li className={`case-timeline-stage${stage.done ? " is-done" : ""}${stage.current ? " is-current" : ""}`} key={stage.label}>
          <span className="case-timeline-marker">{stage.done ? <Check size={13} aria-hidden="true" /> : null}</span>
          <span className="case-timeline-copy"><strong>{stage.label}</strong><small>{stage.detail}</small></span>
          <span className="case-timeline-state">{stage.done ? "Complete" : stage.current ? "Current" : "Pending"}</span>
        </li>
      ))}
    </ol>
  );
}

export default function CaseDetailPage() {
  const { caseId } = useParams();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ status: "loading", caseRecord: null, report: null, patient: null, prediction: null, recommendations: [], assignment: null, relatedErrors: [] });

  useEffect(() => {
    let active = true;
    setState({ status: "loading", caseRecord: null, report: null, patient: null, prediction: null, recommendations: [], assignment: null, relatedErrors: [] });
    async function load() {
      const caseRecord = await getCaseRecord(caseId);
      const [reportsResult, patientResult, predictionResult, recommendationsResult, assignmentResult] = await Promise.allSettled([
        getReports(),
        caseRecord.patient_ref_id ? getPatientByReference(caseRecord.patient_ref_id) : Promise.resolve(null),
        getCasePrediction(caseId),
        getCaseRecommendations(caseId),
        getCaseAssignment(caseId),
      ]);
      if (!active) return;
      const relatedErrors = [];
      const readOptional = (result, label) => {
        if (result.status === "fulfilled") return result.value;
        if (result.reason?.status === 404) return null;
        relatedErrors.push(label);
        return null;
      };
      const reports = readOptional(reportsResult, "Reports");
      const patient = readOptional(patientResult, "Patient");
      const prediction = readOptional(predictionResult, "Prediction");
      const recommendations = readOptional(recommendationsResult, "Recommendations") ?? [];
      const assignment = readOptional(assignmentResult, "Assignment");
      const report = Array.isArray(reports)
        ? reports.find((record) => String(record.case_id ?? "") === String(caseRecord.case_id)) ?? null
        : null;
      setState({ status: "success", caseRecord, report, patient, prediction, recommendations, assignment, relatedErrors });
    }
    load().catch((error) => {
      if (active) setState({ status: error?.status === 404 ? "not-found" : loadFailureKind(error), caseRecord: null, report: null, patient: null, prediction: null, recommendations: [], assignment: null, relatedErrors: [] });
    });
    return () => { active = false; };
  }, [caseId, revision]);

  if (state.status !== "success") {
    const notFound = state.status === "not-found";
    return (
      <>
        <PageHeader eyebrow="Clinical workflow" title="Case detail" />
        <Card className="workflow-detail-card">
          <FeedbackState
            type={state.status === "loading" ? "loading" : notFound ? "empty" : state.status}
            title={state.status === "loading" ? "Loading case history..." : notFound ? "Case not found." : state.status === "unauthorized" ? "Case detail is unavailable for this account." : state.status === "network" ? "Could not connect to the case workflow." : "Unable to load this case."}
            description={state.status === "loading" ? undefined : notFound ? "Check the case ID and try again." : "Please try again in a moment."}
          />
          <div className="patient-detail-error-actions">
            {state.status !== "loading" && !notFound ? <button className="patient-secondary-button" type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button> : null}
            <Link className="patient-secondary-button" to="/cases"><ArrowLeft size={15} aria-hidden="true" /> Case queue</Link>
          </div>
        </Card>
      </>
    );
  }

  const { caseRecord, report, patient, prediction, recommendations, assignment, relatedErrors } = state;
  const probabilities = probabilityEntries(prediction?.class_probabilities ?? prediction?.decision_function_scores);
  return (
    <>
      <PageHeader
        eyebrow="Clinical workflow"
        title={caseRecord.case_id}
        description={`${caseRecord.patient_ref_id || "Patient reference unavailable"}${patient?.full_name ? ` · ${patient.full_name}` : ""}`}
        actions={<Link className="patient-back-link" to="/cases"><ArrowLeft size={15} aria-hidden="true" /> Case queue</Link>}
      />

      {relatedErrors.length ? <div className="workflow-inline-note" role="status">Some history details could not be loaded: {relatedErrors.join(", ")}.</div> : null}

      <div className="workflow-detail-layout case-overview-layout">
        <Card className="workflow-detail-card">
          <div className="workflow-section-heading">
            <span className="workflow-section-icon"><ClipboardList size={18} aria-hidden="true" /></span>
            <div><p className="card-eyebrow">Case record</p><h2>Current status</h2></div>
            <StatusBadge status={caseRecord.status}>{caseRecord.status || "Unknown"}</StatusBadge>
          </div>
          <dl className="workflow-detail-grid">
            <div className="workflow-detail-value"><dt>Case ID</dt><dd>{caseRecord.case_id}</dd></div>
            <div className="workflow-detail-value"><dt>Patient reference</dt><dd>{caseRecord.patient_ref_id || "—"}</dd></div>
            <div className="workflow-detail-value"><dt>Priority</dt><dd>{caseRecord.priority || "—"}</dd></div>
            <div className="workflow-detail-value"><dt>Urgency</dt><dd>{caseRecord.is_emergency ? "Emergency" : "Routine"}</dd></div>
            <div className="workflow-detail-value"><dt>Submitted</dt><dd>{formatDate(caseRecord.submitted_at, { includeTime: true })}</dd></div>
            <div className="workflow-detail-value"><dt>Patient name</dt><dd>{patient?.full_name || "Not available"}</dd></div>
          </dl>
          {patient?.patient_id != null ? <Link className="patient-secondary-button workflow-inline-action" to={`/patients/${patient.patient_id}`}><UserRound size={14} aria-hidden="true" /> View patient <ArrowRight size={13} aria-hidden="true" /></Link> : null}
        </Card>

        <Card className="workflow-related-card">
          <p className="card-eyebrow">Associated report</p>
          <h2>Report information</h2>
          {report ? (
            <>
              <div className="workflow-related-item">
                <span className="workflow-related-icon"><FileText size={16} aria-hidden="true" /></span>
                <span><small>Report #{report.report_id}</small><strong>{report.original_filename || "Uploaded report"}</strong><small>{formatDate(report.uploaded_at, { includeTime: true })}</small></span>
              </div>
              <Link className="patient-secondary-button workflow-related-action" to={`/reports/${report.report_id}`}>View report <ArrowRight size={14} aria-hidden="true" /></Link>
            </>
          ) : <div className="workflow-no-case">No report with a linked case ID was returned.</div>}
        </Card>
      </div>

      <Card className="workflow-timeline-card">
        <div className="workflow-section-heading">
          <span className="workflow-section-icon is-indigo"><Activity size={18} aria-hidden="true" /></span>
          <div><p className="card-eyebrow">Case history</p><h2>Workflow timeline</h2></div>
        </div>
        <Timeline caseRecord={caseRecord} report={report} prediction={prediction} recommendations={recommendations} assignment={assignment} />
      </Card>

      <div className="workflow-results-grid">
        <Card className="workflow-result-card">
          <div className="workflow-section-heading"><span className="workflow-section-icon is-indigo"><Activity size={17} aria-hidden="true" /></span><div><p className="card-eyebrow">AI prediction</p><h2>Prediction</h2></div></div>
          {prediction ? (
            <>
              <dl className="workflow-compact-grid">
                <div><dt>Department</dt><dd>{prediction.predicted_department || prediction.department_name || prediction.predicted_department_id || "—"}</dd></div>
                <div><dt>Confidence</dt><dd>{scoreLabel(prediction.confidence_score, true)} {prediction.confidence_level || prediction.confidence_level_label ? `· ${prediction.confidence_level || prediction.confidence_level_label}` : ""}</dd></div>
              </dl>
              {probabilities.length ? <div className="workflow-probabilities"><strong>Class probabilities / scores</strong>{probabilities.map(([name, value]) => <span key={name}>{name}<b>{scoreLabel(value, true)}</b></span>)}</div> : null}
            </>
          ) : <FeedbackState type="empty" title="No prediction recorded." compact />}
          <Link className="patient-secondary-button workflow-related-action" to={`/predictions?caseId=${encodeURIComponent(caseRecord.case_id)}`}>View / generate prediction <ArrowRight size={14} aria-hidden="true" /></Link>
        </Card>

        <Card className="workflow-result-card">
          <div className="workflow-section-heading"><span className="workflow-section-icon is-indigo"><UserRound size={17} aria-hidden="true" /></span><div><p className="card-eyebrow">Team matching</p><h2>Recommendations</h2></div></div>
          {recommendations.length ? <ol className="workflow-ranked-list">{recommendations.map((item) => <li key={item.recommendation_id ?? `${item.case_id}-${item.rank}-${item.team_id}`}><span className="workflow-rank">{item.rank ?? "—"}</span><span><strong>{item.team_name || item.team_id || "Team unavailable"}</strong><small>{item.team_id || "Team ID unavailable"}{item.specialization ? ` · ${item.specialization}` : ""}</small></span><b>{scoreLabel(item.recommendation_score)}</b></li>)}</ol> : <FeedbackState type="empty" title="No recommendations recorded." compact />}
          <Link className="patient-secondary-button workflow-related-action" to={`/recommendations?caseId=${encodeURIComponent(caseRecord.case_id)}`}>View / generate recommendations <ArrowRight size={14} aria-hidden="true" /></Link>
        </Card>

        <Card className="workflow-result-card workflow-result-wide">
          <div className="workflow-section-heading"><span className="workflow-section-icon"><ClipboardList size={17} aria-hidden="true" /></span><div><p className="card-eyebrow">Human review</p><h2>Assignment decision</h2></div></div>
          {assignment ? (
            <dl className="workflow-compact-grid">
              <div><dt>Assignment ID</dt><dd>{assignment.assignment_id ?? "—"}</dd></div>
              <div><dt>AI recommended team</dt><dd>{assignment.ai_recommended_team_name || assignment.ai_recommended_team_id || "—"}</dd></div>
              <div><dt>Final team</dt><dd>{assignment.final_assigned_team_name || assignment.final_assigned_team_id || "—"}</dd></div>
              <div><dt>Decision</dt><dd>{assignment.human_decision || "—"}</dd></div>
              <div><dt>Approved by</dt><dd>{assignment.approving_user || "—"}</dd></div>
              {assignment.override_reason ? <div className="workflow-value-wide"><dt>Override reason</dt><dd>{assignment.override_reason}</dd></div> : null}
            </dl>
          ) : <FeedbackState type="empty" title="No human decision or assignment recorded." compact />}
          <Link className="patient-secondary-button workflow-related-action" to={`/assignments?caseId=${encodeURIComponent(caseRecord.case_id)}`}>Manage assignment <ArrowRight size={14} aria-hidden="true" /></Link>
        </Card>
      </div>
    </>
  );
}
