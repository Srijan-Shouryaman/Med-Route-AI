import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import Card from "../components/ui/Card.jsx";
import FeedbackState from "../components/ui/FeedbackState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import { getDepartments, getTeams } from "../services/dashboardApi.js";

const caseStatuses = ["Uploaded", "Predicted", "Under Review", "Assigned", "In Progress", "Resolved"];

function classifyFailure(error) {
  if (error?.status === 401 || error?.status === 403) return "unauthorized";
  if (error?.code === "network_error") return "network";
  return "error";
}

function formatPercentage(value) {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(number)}%`
    : "—";
}

export default function ModulePlaceholderPage({ module }) {
  const isCases = module.href === "/cases";
  const isDepartments = module.href === "/departments";
  const isTeams = module.href === "/teams";
  const isDirectory = isDepartments || isTeams;
  const resourceLabel = isDepartments ? "departments" : "clinical teams";
  const [retryCount, setRetryCount] = useState(0);
  const [directory, setDirectory] = useState({ status: "loading", rows: [] });

  useEffect(() => {
    const load = isDepartments ? getDepartments : isTeams ? getTeams : null;
    if (!load) return undefined;

    let active = true;
    setDirectory({ status: "loading", rows: [] });
    load()
      .then((rows) => {
        if (active) setDirectory({ status: "success", rows });
      })
      .catch((error) => {
        if (active) setDirectory({ status: classifyFailure(error), rows: [] });
      });

    return () => { active = false; };
  }, [isDepartments, isTeams, retryCount]);

  function renderDirectoryContent() {
    if (directory.status === "loading") {
      return <FeedbackState type="loading" title={`Loading ${resourceLabel}...`} compact />;
    }

    if (["error", "network", "unauthorized"].includes(directory.status)) {
      const title = directory.status === "unauthorized"
        ? `Access to ${resourceLabel} is unavailable.`
        : directory.status === "network"
          ? `Connection unavailable while loading ${resourceLabel}.`
          : `Unable to load ${resourceLabel}.`;
      return (
        <div className="dashboard-feedback-wrap">
          <FeedbackState type={directory.status} title={title} description="Please try again in a moment." compact />
          <button className="dashboard-retry-button" type="button" onClick={() => setRetryCount((value) => value + 1)}>Retry</button>
        </div>
      );
    }

    if (directory.rows.length === 0) {
      return <FeedbackState type="empty" title={`No ${resourceLabel} available.`} compact />;
    }

    if (isDepartments) {
      return (
        <div className="patient-table-scroll">
          <table className="patient-table">
            <thead><tr><th scope="col">Department ID</th><th scope="col">Department</th><th scope="col">Description</th></tr></thead>
            <tbody>{directory.rows.map((department, index) => (
              <tr key={department.department_id ?? `department-${index}`}>
                <td>{department.department_id ?? "—"}</td>
                <td className="patient-name">{department.department_name ?? "Department name unavailable"}</td>
                <td>{department.description || "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      );
    }

    return (
      <div className="patient-table-scroll">
        <table className="patient-table">
          <thead><tr>
            <th scope="col">Team ID</th><th scope="col">Clinical team</th><th scope="col">Department</th>
            <th scope="col">Specialization</th><th scope="col">Experience (years)</th><th scope="col">Availability</th>
            <th scope="col">Active / max capacity</th><th scope="col">Workload</th><th scope="col">Emergency handling</th>
            <th scope="col">Shift</th><th scope="col">Status</th>
          </tr></thead>
          <tbody>{directory.rows.map((team, index) => (
            <tr key={team.team_id ?? `team-${index}`}>
              <td>{team.team_id ?? "—"}</td>
              <td className="patient-name">{team.team_name ?? "Team name unavailable"}</td>
              <td>{team.department_name ?? "—"}</td>
              <td>{team.specialization ?? "—"}</td>
              <td>{team.experience_years ?? "—"}</td>
              <td>{team.availability ?? "—"}</td>
              <td>{team.active_cases ?? "—"} / {team.maximum_capacity ?? "—"}</td>
              <td>{formatPercentage(team.current_workload_percentage)}</td>
              <td>{team.emergency_handling_capability == null ? "—" : team.emergency_handling_capability ? "Yes" : "No"}</td>
              <td>{team.shift ?? "—"}</td>
              <td>{team.status ? <StatusBadge status={team.status}>{team.status}</StatusBadge> : "—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={module.section}
        title={module.label}
        description={module.description}
      />

      {module.ai ? (
        <div className="ai-advisory-note">
          <span><Sparkles size={17} aria-hidden="true" /></span>
          <p><strong>AI-assisted information is advisory.</strong> Clinical decisions remain with the care team.</p>
        </div>
      ) : null}

      {isCases ? (
        <Card className="module-workflow-card">
          <div className="card-heading-row">
            <div>
              <p className="card-eyebrow">Workflow statuses</p>
              <h2>Case lifecycle</h2>
            </div>
            <span className="workflow-caption">Display legend</span>
          </div>
          <div className="workflow-statuses">
            {caseStatuses.map((status) => <StatusBadge key={status} status={status} />)}
          </div>
        </Card>
      ) : null}

      {isDirectory ? (
        <Card className="module-empty-card">{renderDirectoryContent()}</Card>
      ) : (
        <Card className="module-empty-card">
          <FeedbackState
            type="empty"
            title={`No ${module.label.toLowerCase()} data to display yet`}
            description="This view is ready for the next implementation phase. No sample or placeholder records are shown."
          />
        </Card>
      )}
    </>
  );
}
