import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ClipboardList } from "lucide-react";
import { Link, useParams } from "react-router";
import Card from "../components/ui/Card.jsx";
import FeedbackState from "../components/ui/FeedbackState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { getAssignment, getWorkflowErrorMessage } from "../services/workflowApi.js";
import { loadFailureKind } from "../utils/formatters.js";

function scoreLabel(value) {
  const score = Number(value);
  return Number.isFinite(score) ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(score) : value ?? "—";
}

export default function AssignmentDetailPage() {
  const { assignmentId } = useParams();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ status: "loading", assignment: null, error: null });

  useEffect(() => {
    let active = true;
    if (!/^\d+$/.test(assignmentId ?? "") || Number(assignmentId) <= 0) {
      setState({ status: "not-found", assignment: null, error: null });
      return () => { active = false; };
    }
    setState({ status: "loading", assignment: null, error: null });
    getAssignment(assignmentId)
      .then((assignment) => { if (active) setState({ status: "success", assignment, error: null }); })
      .catch((error) => { if (active) setState({ status: error?.status === 404 ? "not-found" : loadFailureKind(error), assignment: null, error }); });
    return () => { active = false; };
  }, [assignmentId, revision]);

  if (state.status !== "success") {
    const notFound = state.status === "not-found";
    return <><PageHeader eyebrow="Operations" title="Assignment detail" /><Card className="workflow-detail-card"><FeedbackState type={state.status === "loading" ? "loading" : notFound ? "empty" : state.status} title={state.status === "loading" ? "Loading assignment..." : notFound ? "Assignment not found." : state.status === "unauthorized" ? "Assignment detail is unavailable for this account." : state.status === "network" ? "Could not connect to assignment history." : "Unable to load this assignment."} description={state.status === "loading" ? undefined : notFound ? "Check the assignment ID and try again." : getWorkflowErrorMessage(state.error, "Please try again in a moment.")} /><div className="patient-detail-error-actions">{!notFound && state.status !== "loading" ? <button className="patient-secondary-button" type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button> : null}<Link className="patient-secondary-button" to="/assignments"><ArrowLeft size={15} aria-hidden="true" /> Assignment history</Link></div></Card></>;
  }

  const assignment = state.assignment;
  return (
    <>
      <PageHeader eyebrow="Operations" title={`Assignment #${assignment.assignment_id}`} description={`Case ${assignment.case_id} · ${assignment.human_decision || "Assignment record"}`} actions={<Link className="patient-back-link" to="/assignments"><ArrowLeft size={15} aria-hidden="true" /> Assignment history</Link>} />
      <Card className="workflow-detail-card assignment-detail-card">
        <div className="workflow-section-heading"><span className="workflow-section-icon"><ClipboardList size={18} aria-hidden="true" /></span><div><p className="card-eyebrow">Assignment record</p><h2>{assignment.human_decision || "Human decision"}</h2></div></div>
        <dl className="workflow-detail-grid">
          <div className="workflow-detail-value"><dt>Assignment ID</dt><dd>#{assignment.assignment_id}</dd></div>
          <div className="workflow-detail-value"><dt>Case ID</dt><dd>{assignment.case_id}</dd></div>
          <div className="workflow-detail-value"><dt>AI recommended team</dt><dd>{assignment.ai_recommended_team_name || assignment.ai_recommended_team_id || "—"}</dd></div>
          <div className="workflow-detail-value"><dt>Recommendation score</dt><dd>{scoreLabel(assignment.ai_recommendation_score)}</dd></div>
          <div className="workflow-detail-value"><dt>Final assigned team</dt><dd>{assignment.final_assigned_team_name || assignment.final_assigned_team_id || "—"}</dd></div>
          <div className="workflow-detail-value"><dt>Decision</dt><dd>{assignment.human_decision || "—"}</dd></div>
          <div className="workflow-detail-value"><dt>Approved by</dt><dd>{assignment.approving_user || "—"}</dd></div>
          {assignment.override_reason ? <div className="workflow-detail-value workflow-value-wide"><dt>Override reason</dt><dd>{assignment.override_reason}</dd></div> : null}
        </dl>
        <div className="report-result-actions"><Link className="patient-primary-button" to={`/cases/${encodeURIComponent(assignment.case_id)}`}>View case <ArrowRight size={14} aria-hidden="true" /></Link><Link className="patient-secondary-button" to={`/assignments?caseId=${encodeURIComponent(assignment.case_id)}`}>Review case assignment</Link></div>
      </Card>
    </>
  );
}
