import { useState } from "react";
import { ArrowLeft, LoaderCircle, Save } from "lucide-react";
import { Link, useNavigate } from "react-router";
import Card from "../components/ui/Card.jsx";
import { createPatient, getPatientRequestError } from "../services/patientApi.js";

const initialValues = {
  patient_ref_id: "",
  full_name: "",
  date_of_birth: "",
  gender: "",
  phone: "",
  email: "",
  address: "",
};

export default function PatientFormPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    if (errorMessage) setErrorMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    const patient = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value.trim() || null]),
    );
    if (!patient.patient_ref_id || !patient.full_name) {
      setErrorMessage("Enter both a patient reference ID and patient name.");
      return;
    }
    setSubmitting(true);

    try {
      const created = await createPatient(patient);
      if (!Number.isInteger(created.patient_id)) {
        throw new Error("The patient was saved, but the server did not return a patient record ID. Refresh the patient directory to continue.");
      }
      navigate(`/patients/${created.patient_id}`, { replace: true, state: { patientCreated: true } });
    } catch (error) {
      setErrorMessage(error?.status ? getPatientRequestError(error) : error.message);
      setSubmitting(false);
    }
  }

  return (
    <Card className="patient-form-card">
      <div className="patient-form-intro">
        <div className="patient-form-intro-heading">
          <div>
            <p className="card-eyebrow">New record</p>
            <h2>Patient information</h2>
          </div>
          <Link className="patient-back-link" to="/patients"><ArrowLeft size={15} aria-hidden="true" /> Patient list</Link>
        </div>
        <p>Patient reference ID and patient name are required. Other information can be added when available.</p>
      </div>

      <form className="patient-form" onSubmit={handleSubmit}>
          <div className="patient-form-grid">
            <label className="patient-field">
              <span>Patient reference ID <b aria-hidden="true">*</b></span>
              <input name="patient_ref_id" value={values.patient_ref_id} onChange={updateField} maxLength={30} required autoComplete="off" />
              <small>Use the reference assigned by your organization.</small>
            </label>
            <label className="patient-field">
              <span>Patient name <b aria-hidden="true">*</b></span>
              <input name="full_name" value={values.full_name} onChange={updateField} required autoComplete="name" />
            </label>
            <label className="patient-field">
              <span>Date of birth</span>
              <input type="date" name="date_of_birth" value={values.date_of_birth} onChange={updateField} />
            </label>
            <label className="patient-field">
              <span>Gender</span>
              <input name="gender" value={values.gender} onChange={updateField} autoComplete="sex" />
            </label>
            <label className="patient-field">
              <span>Phone</span>
              <input type="tel" name="phone" value={values.phone} onChange={updateField} autoComplete="tel" />
            </label>
            <label className="patient-field">
              <span>Email</span>
              <input type="email" name="email" value={values.email} onChange={updateField} autoComplete="email" />
            </label>
            <label className="patient-field patient-field-wide">
              <span>Address</span>
              <textarea name="address" value={values.address} onChange={updateField} rows={3} autoComplete="street-address" />
            </label>
          </div>

          {errorMessage ? <div className="patient-form-error" role="alert">{errorMessage}</div> : null}

          <div className="patient-form-actions">
            <Link className="patient-secondary-button" to="/patients">Cancel</Link>
            <button className="patient-primary-button" type="submit" disabled={submitting}>
              {submitting ? <LoaderCircle className="patient-spin" size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              {submitting ? "Saving patient..." : "Save patient"}
            </button>
          </div>
      </form>
    </Card>
  );
}
