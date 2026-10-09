import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, FileUp, LoaderCircle, RotateCcw, UploadCloud, X } from "lucide-react";
import { Link, useParams } from "react-router";
import Card from "../components/ui/Card.jsx";
import FeedbackState from "../components/ui/FeedbackState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import { getReport } from "../services/workflowApi.js";
import { getPatient, uploadPatientReport } from "../services/patientApi.js";
import { formatDate, formatFileSize, loadFailureKind } from "../utils/formatters.js";

function isPdf(file) {
  return Boolean(file && file.size > 0 && /\.pdf$/i.test(file.name)
    && (!file.type || file.type === "application/pdf"));
}

function uploadErrorMessage(error) {
  if (error?.status === 404) return "This patient could not be found. Return to the patient list and select a valid record.";
  if (error?.status === 413) return "This file is too large to upload. Choose a smaller PDF and try again.";
  if (error?.status === 422) return "The report could not be accepted. Confirm the patient and selected PDF, then try again.";
  if (error?.status === 401 || error?.status === 403 || error?.code === "network_error") return error.message;
  return "The report could not be uploaded. Please try again in a moment.";
}

function ReportResult({ report, onUploadAnother, onCancel, inline = false }) {
  const extractionSucceeded = String(report.extraction_status ?? "").toUpperCase() === "EXTRACTED";
  const caseId = String(report.case_id ?? "").trim();
  return (
    <Card className={`report-result-card${extractionSucceeded ? " is-success" : " is-warning"}`}>
      <div className="report-result-heading">
        <span className={`report-result-icon${extractionSucceeded ? "" : " is-warning"}`}>
          {extractionSucceeded ? <CheckCircle2 size={21} aria-hidden="true" /> : <FileText size={21} aria-hidden="true" />}
        </span>
        <div>
          <p className="card-eyebrow">Upload result</p>
          <h2>{extractionSucceeded ? "Report processed successfully" : "Report uploaded; processing needs attention"}</h2>
          <p>{extractionSucceeded
            ? "Text extraction completed. A case was created automatically and is available in the case workflow."
            : "The report was stored, but text extraction did not complete, so a case was not created. Check that the PDF is readable and try another copy."}</p>
        </div>
      </div>

      <dl className="report-result-grid">
        <div><dt>Report ID</dt><dd>#{report.report_id}</dd></div>
        <div><dt>Original filename</dt><dd title={report.original_filename}>{report.original_filename || "—"}</dd></div>
        <div><dt>Extraction status</dt><dd><StatusBadge status={String(report.extraction_status ?? "Unknown").toLowerCase()}>{report.extraction_status || "Unknown"}</StatusBadge></dd></div>
        <div><dt>Uploaded</dt><dd>{formatDate(report.uploaded_at, { includeTime: true })}</dd></div>
        <div><dt>File size</dt><dd>{formatFileSize(report.file_size)}</dd></div>
      </dl>

      <div className="report-result-actions">
        {extractionSucceeded && caseId ? (
          <Link className="patient-primary-button" to={`/predictions?caseId=${encodeURIComponent(caseId)}`}>Generate Prediction <ArrowRight size={15} aria-hidden="true" /></Link>
        ) : null}
        <button className="patient-secondary-button" type="button" onClick={onUploadAnother}><RotateCcw size={15} aria-hidden="true" /> Upload another report</button>
        {inline ? <button className="patient-secondary-button" type="button" onClick={onCancel}>Back to patient details</button> : null}
      </div>
    </Card>
  );
}

export default function ReportUploadPage({ patientRecord = null, inline = false, onCancel } = {}) {
  const { patientId: routePatientId } = useParams();
  const patientId = patientRecord?.patient_id ?? routePatientId;
  const fileInputRef = useRef(null);
  const [patientState, setPatientState] = useState(() => patientRecord
    ? { status: "success", patient: patientRecord }
    : { status: "loading", patient: null });
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [report, setReport] = useState(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    if (patientRecord) {
      setPatientState({ status: "success", patient: patientRecord });
      return () => { active = false; };
    }
    if (!/^\d+$/.test(patientId ?? "") || Number(patientId) <= 0) {
      setPatientState({ status: "not-found", patient: null });
      return () => { active = false; };
    }
    setPatientState({ status: "loading", patient: null });
    getPatient(patientId)
      .then((patient) => { if (active) setPatientState({ status: "success", patient }); })
      .catch((error) => {
        if (!active) return;
        setPatientState({ status: error?.status === 404 ? "not-found" : loadFailureKind(error), patient: null });
      });
    return () => { active = false; };
  }, [patientId, patientRecord, revision]);

  function selectFile(candidate) {
    setRequestError("");
    if (!candidate) return;
    if (!isPdf(candidate)) {
      setFile(null);
      setFileError(candidate.size === 0 ? "This file is empty. Choose a readable PDF report." : "Choose a PDF file to upload.");
      return;
    }
    setFileError("");
    setFile(candidate);
    setReport(null);
  }

  function clearFile() {
    setFile(null);
    setFileError("");
    setRequestError("");
    setReport(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    if (!patientState.patient || !file || uploading) return;
    setUploading(true);
    setRequestError("");
    try {
      const result = await uploadPatientReport(patientState.patient.patient_id, file);
      let resultForDisplay = result;
      if (String(result.extraction_status ?? "").toUpperCase() === "EXTRACTED" && result.report_id != null) {
        try {
          const reportDetails = await getReport(result.report_id);
          resultForDisplay = { ...result, case_id: reportDetails.case_id };
        } catch {
          // Keep the successful upload result if the related case lookup is unavailable.
        }
      }
      setReport(resultForDisplay);
    } catch (error) {
      setRequestError(uploadErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  if (patientState.status !== "success") {
    const notFound = patientState.status === "not-found";
    return (
      <>
        {!inline ? <PageHeader eyebrow="Report intake" title="Upload medical report" /> : null}
        <Card className="patient-detail-card">
          <FeedbackState
            type={patientState.status === "loading" ? "loading" : notFound ? "empty" : patientState.status}
            title={patientState.status === "loading" ? "Loading patient..." : notFound ? "Patient not found." : patientState.status === "unauthorized" ? "Patient information is unavailable for this account." : patientState.status === "network" ? "Could not connect to patient records." : "Unable to load patient information."}
            description={notFound ? "Select a patient record before uploading a report." : patientState.status === "loading" ? undefined : "Please try again, or return to the patient list."}
          />
          <div className="patient-detail-error-actions">
            {patientState.status !== "loading" && !notFound ? <button className="patient-secondary-button" type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button> : null}
            <Link className="patient-secondary-button" to="/patients"><ArrowLeft size={15} aria-hidden="true" /> Patient list</Link>
          </div>
        </Card>
      </>
    );
  }

  const patient = patientState.patient;
  return (
    <>
      {!inline ? (
        <>
          <PageHeader
            eyebrow="Report intake"
            title="Upload medical report"
            description="Select a PDF report to store it with this patient and begin text extraction."
            actions={<Link className="patient-back-link" to={`/patients/${patient.patient_id}`}><ArrowLeft size={15} aria-hidden="true" /> Patient profile</Link>}
          />

          <div className="upload-patient-context">
            <span className="patient-profile-icon"><FileText size={19} aria-hidden="true" /></span>
            <span><small>Uploading for</small><strong>{patient.full_name}</strong><small>Reference {patient.patient_ref_id}</small></span>
          </div>
        </>
      ) : null}

      {report ? (
        <ReportResult report={report} onUploadAnother={clearFile} onCancel={onCancel} inline={inline} />
      ) : (
        <Card className="report-upload-card">
          <div className="report-upload-intro">
            <p className="card-eyebrow">Medical report</p>
            <h2>Choose a PDF file</h2>
            <p>PDF is the supported report format. The original file is kept with the patient record.</p>
          </div>

          <input
            ref={fileInputRef}
            className="sr-only"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(event) => {
              selectFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          {!file ? (
            <button
              className={`report-dropzone${isDragging ? " is-dragging" : ""}`}
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={(event) => { event.preventDefault(); setIsDragging(false); }}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                selectFile(event.dataTransfer.files?.[0]);
              }}
              disabled={uploading}
            >
              <span className="report-drop-icon"><UploadCloud size={23} aria-hidden="true" /></span>
              <strong>Drop a report PDF here</strong>
              <span>or <em>browse files</em></span>
              <small>PDF files only</small>
            </button>
          ) : (
            <div className="report-selected-file">
              <span className="report-file-icon"><FileText size={19} aria-hidden="true" /></span>
              <span className="report-file-copy"><strong title={file.name}>{file.name}</strong><small>{formatFileSize(file.size)} · PDF document</small></span>
              <button className="report-remove-file" type="button" onClick={clearFile} aria-label="Remove selected file" disabled={uploading}><X size={17} aria-hidden="true" /></button>
              <button className="report-change-file" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>Change file</button>
            </div>
          )}

          {fileError ? <div className="patient-form-error" role="alert">{fileError}</div> : null}
          {requestError ? <div className="patient-form-error" role="alert">{requestError}</div> : null}

          {uploading ? (
            <div className="report-upload-progress" role="status" aria-live="polite">
              <div><LoaderCircle className="patient-spin" size={15} aria-hidden="true" /><span>Uploading and processing report...</span></div>
              <span className="report-progress-track"><span /></span>
              <small>Text extraction can take a few moments.</small>
            </div>
          ) : null}

          <div className="report-upload-actions">
            {inline ? (
              <button className="patient-secondary-button" type="button" disabled={uploading} onClick={onCancel}>Cancel</button>
            ) : (
              <Link className="patient-secondary-button" to={`/patients/${patient.patient_id}`}>Cancel</Link>
            )}
            <button className="patient-primary-button" type="button" disabled={!file || uploading} onClick={handleUpload}>
              {uploading ? <LoaderCircle className="patient-spin" size={16} aria-hidden="true" /> : <FileUp size={16} aria-hidden="true" />}
              {uploading ? "Processing report..." : "Upload report"}
            </button>
          </div>
        </Card>
      )}
    </>
  );
}
