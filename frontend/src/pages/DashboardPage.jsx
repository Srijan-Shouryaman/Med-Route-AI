import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  ClipboardList,
  FileText,
  LoaderCircle,
  UserRound,
  Users,
} from "lucide-react";
import { Link } from "react-router";
import Card from "../components/ui/Card.jsx";
import FeedbackState from "../components/ui/FeedbackState.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import { getCaseHistory, getCases, getPredictions } from "../services/dashboardApi.js";
import { getPatients } from "../services/patientApi.js";

function useDashboardResource(load, label) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ status: "loading", data: null });
  const requestRef = useRef(null);

  useEffect(() => {
    let active = true;
    setState({ status: "loading", data: null });

    let request = requestRef.current;
    if (!request || request.revision !== revision) {
      request = { revision, promise: Promise.resolve().then(load) };
      requestRef.current = request;
    }

    request.promise
      .then((data) => {
        if (active) setState({ status: "success", data });
      })
      .catch((error) => {
        if (!active) return;
        const status = error?.status === 401 || error?.status === 403
          ? "unauthorized"
          : error?.code === "network_error"
            ? "network"
            : "error";
        setState({ status, data: null });
      });

    return () => {
      active = false;
    };
  }, [load, revision]);

  const retry = useCallback(() => setRevision((current) => current + 1), []);
  return { ...state, label, retry };
}

function isFailure(resource) {
  return ["error", "network", "unauthorized"].includes(resource.status);
}

function resourceGroupState(resources) {
  const failures = resources.filter(isFailure);
  if (failures.length > 0) return { status: "error", failures };
  if (resources.some((resource) => resource.status === "loading")) {
    return { status: "loading", failures: [] };
  }
  return { status: "success", failures: [] };
}

function FailureNotice({ resources, message }) {
  const failures = resources.filter(isFailure);
  if (failures.length === 0) return null;

  return (
    <div className="dashboard-inline-error" role="alert">
      <span>{message}</span>
      <div className="dashboard-retry-actions">
        {failures.map((resource) => (
          <button key={resource.label} type="button" onClick={resource.retry}>
            Retry {resource.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatCount(value) {
  if (value == null || value === "") return "\u2014";
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(number)
    : "\u2014";
}

function formatDateTime(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function TotalCasesSummary({ caseResources, rows }) {
  const group = resourceGroupState(caseResources);
  return (
    <Card className="dashboard-total-card" aria-busy={group.status === "loading"}>
      <h2>Total Cases</h2>
      {group.status === "loading" ? (
        <span className="dashboard-total-loading" aria-label="Loading total cases">
          <LoaderCircle size={22} className="is-spinning" />
        </span>
      ) : group.status === "error" ? (
        <strong className="dashboard-total-unavailable">Unavailable</strong>
      ) : (
        <strong className="dashboard-total-value">{formatCount(rows.length)}</strong>
      )}
      <p>All cases in your workspace</p>
    </Card>
  );
}

function getCaseRows(caseResource, historyResource) {
  if (caseResource.status !== "success" || historyResource.status !== "success") return [];
  const unique = new Map();
  [...caseResource.data, ...historyResource.data].forEach((row) => {
    if (row?.case_id != null) unique.set(String(row.case_id), row);
  });
  return [...unique.values()];
}

function sortRecentCases(rows) {
  return [...rows].sort((left, right) => {
    const leftTime = left.submitted_at ? new Date(left.submitted_at).getTime() : Number.NaN;
    const rightTime = right.submitted_at ? new Date(right.submitted_at).getTime() : Number.NaN;
    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
    if (Number.isNaN(leftTime)) return 1;
    if (Number.isNaN(rightTime)) return -1;
    return rightTime - leftTime;
  });
}

function countStatus(rows, acceptedStatuses) {
  return rows.filter((row) => acceptedStatuses.has(String(row.status ?? "").trim().toLowerCase())).length;
}

function sortCasesForAttention(rows) {
  const reviewStatuses = new Set([
    "pending prediction",
    "predicted",
    "pending human review",
    "recommended",
    "flagged - no eligible team",
  ]);
  const recent = sortRecentCases(rows);
  return [
    ...recent.filter((row) => reviewStatuses.has(String(row.status ?? "").trim().toLowerCase())),
    ...recent.filter((row) => !reviewStatuses.has(String(row.status ?? "").trim().toLowerCase())),
  ];
}

function CaseWorkflow({ caseResources, rows }) {
  const group = resourceGroupState(caseResources);
  const stages = [
    { label: "Pending Prediction", icon: FileText, accent: "is-pending", count: countStatus(rows, new Set(["pending prediction"])) },
    { label: "Pending Human Review", icon: UserRound, accent: "is-review", count: countStatus(rows, new Set(["pending human review", "recommended"])) },
    { label: "Assigned", icon: ClipboardList, accent: "is-assigned", count: countStatus(rows, new Set(["assigned"])) },
    { label: "In Progress", icon: Activity, accent: "is-progress", count: countStatus(rows, new Set(["in progress"])) },
    { label: "Resolved", icon: CheckCircle2, accent: "is-resolved", count: countStatus(rows, new Set(["resolved"])) },
  ];

  return (
    <Card className="dashboard-section-card dashboard-workflow-card">
      <div className="dashboard-section-heading">
        <div>
          <h2>Case workflow</h2>
        </div>
        <Link className="dashboard-header-link" to="/cases">View cases <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
      {group.status === "loading" ? (
        <FeedbackState type="loading" title="Loading case workflow..." compact />
      ) : group.status === "error" ? (
        <FeedbackState type="error" title="Case workflow counts are temporarily unavailable." compact />
      ) : (
        <>
          {rows.length === 0 ? <p className="dashboard-empty-note">No cases are available yet.</p> : null}
          <div className="dashboard-workflow-stages" aria-label="Case counts by workflow stage">
            {stages.map(({ label, icon: Icon, accent, count }, index) => (
              <div className="dashboard-workflow-step" key={label}>
                <Link
                  className={"dashboard-workflow-stage " + accent}
                  to="/cases"
                  aria-label={label + ", " + formatCount(count) + " cases. Open the Cases page and use its status filter to narrow the list."}
                >
                  <span className="dashboard-workflow-icon"><Icon size={19} aria-hidden="true" /></span>
                  <span className="dashboard-workflow-copy">
                    <span>{label}</span>
                    <strong>{formatCount(count)}</strong>
                  </span>
                </Link>
                {index < stages.length - 1 ? <ArrowRight className="dashboard-workflow-arrow" size={18} aria-hidden="true" /> : null}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function makeLookup(rows, keyField, valueField) {
  const lookup = new Map();
  if (!Array.isArray(rows)) return lookup;
  rows.forEach((row) => {
    const key = row?.[keyField];
    if (key != null && !lookup.has(String(key))) lookup.set(String(key), row?.[valueField]);
  });
  return lookup;
}

function RecentCases({ caseResources, rows, predictions, patients }) {
  const group = resourceGroupState(caseResources);
  const recent = sortCasesForAttention(rows).slice(0, 3);
  const departmentsByCase = useMemo(
    () => makeLookup(predictions.status === "success" ? predictions.data : [], "case_id", "department_name"),
    [predictions],
  );
  const patientNamesByReference = useMemo(
    () => makeLookup(patients.status === "success" ? patients.data : [], "patient_ref_id", "full_name"),
    [patients],
  );

  return (
    <Card className="dashboard-section-card dashboard-recent-card">
      <div className="dashboard-section-heading">
        <div>
          <h2>Cases requiring attention</h2>
          <p className="card-subtitle">Recent cases that need your review or action.</p>
        </div>
        <Link className="dashboard-header-link" to="/cases">View all cases <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
      {group.status === "loading" ? (
        <FeedbackState type="loading" title="Loading recent cases..." compact />
      ) : group.status === "error" ? (
        <FeedbackState type="error" title="Recent case information is temporarily unavailable." compact />
      ) : recent.length === 0 ? (
        <FeedbackState type="empty" title="No cases are available yet." compact />
      ) : (
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th scope="col">Case ID</th>
                <th scope="col">Patient</th>
                <th scope="col">Department (Predicted)</th>
                <th scope="col">Status</th>
                <th scope="col">Priority</th>
                <th scope="col">Type</th>
                <th scope="col">Submitted</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row, index) => {
                const caseId = row.case_id;
                const patientName = patientNamesByReference.get(String(row.patient_ref_id ?? ""));
                const department = departmentsByCase.get(String(caseId ?? ""));
                return (
                  <tr key={caseId ?? "case-" + index}>
                    <td className="dashboard-case-id">
                      {caseId != null
                        ? <Link to={"/cases/" + encodeURIComponent(caseId)}>{caseId}</Link>
                        : "\u2014"}
                    </td>
                    <td>{patientName || row.patient_ref_id || "Not available"}</td>
                    <td>{department || "\u2014"}</td>
                    <td><StatusBadge status={row.status}>{row.status || "Unknown"}</StatusBadge></td>
                    <td><StatusBadge status={row.priority}>{row.priority || "\u2014"}</StatusBadge></td>
                    <td>
                      {row.is_emergency === true
                        ? <span className="dashboard-emergency">Emergency</span>
                        : row.is_emergency === false
                          ? "Standard"
                          : "\u2014"}
                    </td>
                    <td>{formatDateTime(row.submitted_at)}</td>
                    <td>
                      {caseId != null
                        ? <Link className="dashboard-case-action" to={"/cases/" + encodeURIComponent(caseId)}>View <ArrowRight size={13} aria-hidden="true" /></Link>
                        : "\u2014"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <FailureNotice resources={[predictions]} message="Predicted department details could not be loaded." />
      <FailureNotice resources={[patients]} message="Patient names could not be loaded; patient references remain available." />
    </Card>
  );
}

const quickAccessItems = [
  {
    title: "AI Diagnosis",
    description: "Analyze medical images and review AI-generated visual explanations.",
    href: "/diagnosis",
    icon: Brain,
    accent: "is-blue",
  },
  {
    title: "Team Performance",
    description: "Review clinical team performance and operational metrics.",
    href: "/team-performance",
    icon: BarChart3,
    accent: "is-purple",
  },
  {
    title: "Clinical Teams",
    description: "Explore clinical teams and their specializations.",
    href: "/teams",
    icon: Users,
    accent: "is-green",
  },
];

function QuickAccessCards() {
  return (
    <nav className="dashboard-quick-access-grid" aria-label="Quick access">
      {quickAccessItems.map(({ title, description, href, icon: Icon, accent }) => (
        <Link className="dashboard-quick-access-link" to={href} key={title}>
          <span className={"dashboard-quick-access-icon " + accent}><Icon size={21} aria-hidden="true" /></span>
          <span className="dashboard-quick-access-copy">
            <strong>{title}</strong>
            <span>{description}</span>
          </span>
          <ArrowRight className="dashboard-quick-access-arrow" size={17} aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}

export default function DashboardPage() {
  const cases = useDashboardResource(getCases, "cases");
  const history = useDashboardResource(getCaseHistory, "case history");
  const predictions = useDashboardResource(getPredictions, "predictions");
  const patients = useDashboardResource(getPatients, "patients");
  const caseResources = useMemo(() => [cases, history], [cases, history]);
  const caseRows = useMemo(() => getCaseRows(cases, history), [cases, history]);

  return (
    <>
      <div className="dashboard-workflow-layout">
        <TotalCasesSummary caseResources={caseResources} rows={caseRows} />
        <CaseWorkflow caseResources={caseResources} rows={caseRows} />
      </div>
      <FailureNotice resources={caseResources} message="Dashboard case counts could not be loaded." />
      <RecentCases caseResources={caseResources} rows={caseRows} predictions={predictions} patients={patients} />
      <QuickAccessCards />
    </>
  );
}
