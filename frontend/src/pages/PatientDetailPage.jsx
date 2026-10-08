import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, FileUp, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { Link, useLocation, useParams } from "react-router";
import Card from "../components/ui/Card.jsx";
import FeedbackState from "../components/ui/FeedbackState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { getPatient } from "../services/patientApi.js";
import { formatDate, loadFailureKind } from "../utils/formatters.js";

function DetailItem({ label, value }) {
  return (
    <div className="patient-detail-item">
      <dt>{label}</dt>
      <dd>{value || "—"}</dd>
    </div>
  );
}

export default function PatientDetailPage() {
  const { patientId } = useParams();
  const location = useLocation();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ status: "loading", patient: null });

  useEffect(() => {
    let active = true;
    if (!/^\d+$/.test(patientId ?? "") || Number(patientId) <= 0) {
      setState({ status: "not-found", patient: null });
      return () => { active = false; };
    }
    setState({ status: "loading", patient: null });
    getPatient(patientId)
      .then((patient) => { if (active) setState({ status: "success", patient }); })
      .catch((error) => {
        if (!active) return;
        setState({ status: error?.status === 404 ? "not-found" : loadFailureKind(error), patient: null });
      });
    return () => { active = false; };
  }, [patientId, revision]);

  if (state.status !== "success") {
    const isNotFound = state.status === "not-found";
    const feedbackType = isNotFound ? "empty" : state.status;
    return (
      <>
        <PageHeader eyebrow="Patient records" title="Patient profile" />
        <Card className="patient-detail-card">
          <FeedbackState
            type={state.status === "loading" ? "loading" : feedbackType}
            title={state.status === "loading" ? "Loading patient profile..." : isNotFound ? "Patient not found." : state.status === "unauthorized" ? "Patient profile is unavailable for this account." : state.status === "network" ? "Could not connect to patient records." : "Unable to load this patient profile."}
            description={isNotFound ? "Check the patient record and try again, or return to the patient list." : state.status === "loading" ? undefined : "Please try again. If the issue continues, contact your administrator."}
          />
          <div className="patient-detail-error-actions">
            {state.status !== "loading" && !isNotFound ? <button className="patient-secondary-button" type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button> : null}
            <Link className="patient-secondary-button" to="/patients"><ArrowLeft size={15} aria-hidden="true" /> Patient list</Link>
          </div>
        </Card>
      </>
    );
  }

  const patient = state.patient;
  return (
    <>
      <PageHeader
        eyebrow="Patient records"
        title={patient.full_name || "Patient profile"}
        description={`Patient reference ${patient.patient_ref_id || "—"}`}
        actions={<Link className="patient-back-link" to="/patients"><ArrowLeft size={15} aria-hidden="true" /> Patient list</Link>}
      />

      {location.state?.patientCreated ? (
        <div className="patient-success-banner" role="status">
          <span className="patient-success-dot" /> Patient record created. The profile below was loaded from the patient directory.
        </div>
      ) : null}

      <div className="patient-detail-layout">
        <Card className="patient-detail-card">
          <div className="patient-detail-heading">
            <span className="patient-profile-icon"><UserRound size={21} aria-hidden="true" /></span>
            <div>
              <p className="card-eyebrow">Patient profile</p>
              <h2>{patient.full_name || "Patient"}</h2>
              <span className="patient-reference">{patient.patient_ref_id || "—"}</span>
            </div>
          </div>
          <dl className="patient-detail-grid">
            <DetailItem label="Date of birth" value={formatDate(patient.date_of_birth)} />
            <DetailItem label="Gender" value={patient.gender} />
            <DetailItem label="Phone" value={patient.phone} />
            <DetailItem label="Email" value={patient.email} />
            <DetailItem label="Address" value={patient.address} />
            <DetailItem label="Created" value={formatDate(patient.created_at, { includeTime: true })} />
            <DetailItem label="Last updated" value={formatDate(patient.updated_at, { includeTime: true })} />
          </dl>
          <div className="patient-contact-shortcuts">
            {patient.phone ? <a href={`tel:${patient.phone}`}><Phone size={14} aria-hidden="true" /> Call patient</a> : null}
            {patient.email ? <a href={`mailto:${patient.email}`}><Mail size={14} aria-hidden="true" /> Email patient</a> : null}
            {patient.address ? <span><MapPin size={14} aria-hidden="true" /> Address on file</span> : null}
          </div>
        </Card>

        <Card className="patient-action-card">
          <span className="patient-action-icon"><FileUp size={19} aria-hidden="true" /></span>
          <p className="card-eyebrow">Report intake</p>
          <h2>Upload a medical report</h2>
          <p>Attach a PDF report to this patient. The report will be processed and, when text extraction succeeds, added to the case workflow.</p>
          <Link className="patient-primary-button patient-action-button" to={`/patients/${patient.patient_id}/upload`}>
            <FileUp size={16} aria-hidden="true" /> Upload medical report
          </Link>
          <Link className="patient-case-link" to="/cases"><ClipboardList size={15} aria-hidden="true" /> Open case workflow</Link>
        </Card>
      </div>
    </>
  );
}
