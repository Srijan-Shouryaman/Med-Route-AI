import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, FileText, UserRound } from "lucide-react";
import { Link, useParams } from "react-router";
import Card from "../components/ui/Card.jsx";
import FeedbackState from "../components/ui/FeedbackState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import { getReport } from "../services/workflowApi.js";
import { formatDate, formatFileSize, loadFailureKind } from "../utils/formatters.js";

function safeExtractionError(value) {
  if (!value) return "Text extraction did not complete for this report.";
  const message = String(value).trim();
  if (/(?:[a-z]:\\|\\\\[^\\]+\\|\/(?:home|tmp|var|mnt|opt|app)\/)/i.test(message)) {
    return "The report could not be read for text extraction. Check that the file is available and try again.";
  }
  return message.slice(0, 320);
}

function DetailValue({ label, children, className = "" }) {
  return <div className={`workflow-detail-value ${className}`.trim()}><dt>{label}</dt><dd>{children ?? "—"}</dd></div>;
}

export default function ReportDetailPage() {
  const { reportId } = useParams();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ status: "loading", report: null });

  useEffect(() => {
    let active = true;
    if (!/^\d+$/.test(reportId ?? "") || Number(reportId) <= 0) {
      setState({ status: "not-found", report: null });
      return () => { active = false; };
    }
    setState({ status: "loading", report: null });
    getReport(reportId)
      .then((report) => { if (active) setState({ status: "success", report }); })
      .catch((error) => { if (active) setState({ status: error?.status === 404 ? "not-found" : loadFailureKind(error), report: null }); });
    return () => { active = false; };
  }, [reportId, revision]);

  if (state.status !== "success") {
    const notFound = state.status === "not-found";
    return (
      <>
        <PageHeader eyebrow="Report history" title="Report detail" />
        <Card className="workflow-detail-card">
          <FeedbackState
            type={state.status === "loading" ? "loading" : notFound ? "empty" : state.status}
            title={state.status === "loading" ? "Loading report..." : notFound ? "Report not found." : state.status === "unauthorized" ? "Report detail is unavailable for this account." : state.status === "network" ? "Could not connect to report history." : "Unable to load this report."}
            description={state.status === "loading" ? undefined : notFound ? "The report may have been removed or the link may be incorrect." : "Please try again in a moment."}
          />
          <div className="patient-detail-error-actions">
            {state.status !== "loading" && !notFound ? <button className="patient-secondary-button" type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button> : null}
            <Link className="patient-secondary-button" to="/reports"><ArrowLeft size={15} aria-hidden="true" /> Report history</Link>
          </div>
        </Card>
      </>
    );
  }

  const report = state.report;
  const extractionStatus = String(report.extraction_status ?? "").toUpperCase();
  return (
    <>
      <PageHeader
        eyebrow="Report history"
        title={report.original_filename || `Report #${report.report_id}`}
        description={`Report #${report.report_id} · ${report.patient_ref_id || "Patient reference unavailable"}`}
        actions={<Link className="patient-back-link" to="/reports"><ArrowLeft size={15} aria-hidden="true" /> Report history</Link>}
      />

      <div className="workflow-detail-layout">
        <Card className="workflow-detail-card">
          <div className="workflow-section-heading">
            <span className="workflow-section-icon"><FileText size={18} aria-hidden="true" /></span>
            <div><p className="card-eyebrow">Report record</p><h2>Report information</h2></div>
            <StatusBadge status={extractionStatus.toLowerCase()}>{extractionStatus || "Unknown"}</StatusBadge>
          </div>
          <dl className="workflow-detail-grid">
            <DetailValue label="Report ID">#{report.report_id}</DetailValue>
            <DetailValue label="Original filename">{report.original_filename}</DetailValue>
            <DetailValue label="File type">{report.content_type}</DetailValue>
            <DetailValue label="File size">{formatFileSize(report.file_size)}</DetailValue>
            <DetailValue label="Uploaded">{formatDate(report.uploaded_at, { includeTime: true })}</DetailValue>
            <DetailValue label="Uploaded by">{report.uploaded_by != null ? `User #${report.uploaded_by}` : "—"}</DetailValue>
            <DetailValue label="SHA-256" className="workflow-value-wide"><code className="workflow-hash">{report.sha256_hash || "—"}</code></DetailValue>
          </dl>
          {extractionStatus === "FAILED" ? (
            <div className="workflow-warning" role="status"><strong>Extraction needs attention</strong><span>{safeExtractionError(report.extraction_error)}</span></div>
          ) : null}
        </Card>

        <Card className="workflow-related-card">
          <p className="card-eyebrow">Related records</p>
          <h2>Patient and case</h2>
          <div className="workflow-related-item">
            <span className="workflow-related-icon"><UserRound size={16} aria-hidden="true" /></span>
            <span><small>Patient</small><strong>{report.patient_name || report.patient_ref_id || "Patient record"}</strong><small>{report.patient_ref_id || "Reference unavailable"}</small></span>
          </div>
          {report.patient_id != null ? (
            <Link className="patient-secondary-button workflow-related-action" to={`/patients/${report.patient_id}`}>View patient <ArrowUpRight size={14} aria-hidden="true" /></Link>
          ) : null}
          <div className="workflow-related-divider" />
          {report.case_id ? (
            <>
              <div className="workflow-related-item">
                <span className="workflow-related-icon is-indigo"><FileText size={16} aria-hidden="true" /></span>
                <span><small>Linked case</small><strong>{report.case_id}</strong></span>
              </div>
              <Link className="patient-primary-button workflow-related-action" to={`/cases/${encodeURIComponent(report.case_id)}`}>View case <ArrowUpRight size={14} aria-hidden="true" /></Link>
            </>
          ) : (
            <div className="workflow-no-case">Case has not been created for this report yet.</div>
          )}
        </Card>
      </div>

      <Card className="report-ocr-card">
        <div className="workflow-section-heading">
          <span className="workflow-section-icon is-indigo"><FileText size={18} aria-hidden="true" /></span>
          <div><p className="card-eyebrow">Extracted text</p><h2>Clinical report text</h2></div>
        </div>
        {typeof report.extracted_text === "string" && report.extracted_text.length > 0 ? (
          <pre className="report-ocr-text">{report.extracted_text}</pre>
        ) : (
          <FeedbackState
            type="empty"
            title="No extracted text is available."
            description={extractionStatus === "FAILED" ? "Text extraction did not complete for this report." : "There is no OCR text to display for this report."}
            compact
          />
        )}
      </Card>
    </>
  );
}
