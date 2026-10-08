import { ApiError, apiClient } from "./apiClient.js";

function ensureObjectResponse(response, resourceName) {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new ApiError(`The server returned an unexpected ${resourceName} response.`, 502, "invalid_response");
  }
  return response;
}

export async function getPatients() {
  const response = await apiClient("/api/patients/");
  if (!Array.isArray(response)) {
    throw new ApiError("The server returned an unexpected patients response.", 502, "invalid_response");
  }
  return response;
}

export async function getPatient(patientId) {
  return ensureObjectResponse(await apiClient(`/api/patients/${patientId}`), "patient");
}

export async function getPatientByReference(patientReferenceId) {
  return ensureObjectResponse(
    await apiClient(`/api/patients/ref/${encodeURIComponent(patientReferenceId)}`),
    "patient",
  );
}

export async function createPatient(patient) {
  // The implemented POST route is registered at the prefix without a trailing slash.
  return ensureObjectResponse(
    await apiClient("/api/patients", { method: "POST", body: patient }),
    "patient",
  );
}

export async function uploadPatientReport(patientId, file) {
  const body = new FormData();
  body.append("patient_id", String(patientId));
  body.append("file", file);
  return ensureObjectResponse(
    await apiClient("/api/reports/upload", { method: "POST", body }),
    "report",
  );
}

const patientFieldLabels = {
  patient_ref_id: "Patient reference ID",
  full_name: "Patient name",
  date_of_birth: "Date of birth",
  gender: "Gender",
  phone: "Phone",
  email: "Email",
  address: "Address",
};

export function getPatientRequestError(error) {
  if (error?.status === 409) {
    return "That patient reference ID is already in use. Choose a different ID.";
  }

  const issues = error?.payload?.detail;
  if (error?.status === 422 && Array.isArray(issues)) {
    const messages = issues.slice(0, 3).map((issue) => {
      const fieldName = Array.isArray(issue?.loc) ? issue.loc.at(-1) : "";
      const label = patientFieldLabels[fieldName];
      const detail = String(issue?.msg ?? "").toLowerCase();
      if (fieldName === "email" && detail.includes("valid")) return "Enter a valid email address.";
      if (label && detail.includes("required")) return `${label} is required.`;
      if (label) return `Check the ${label.toLowerCase()} field.`;
      return "Please review the patient details and try again.";
    });
    return [...new Set(messages)].join(" ");
  }

  if (error?.status === 422) {
    return "Please review the patient details and try again.";
  }
  return error?.message ?? "Unable to save this patient. Please try again.";
}
