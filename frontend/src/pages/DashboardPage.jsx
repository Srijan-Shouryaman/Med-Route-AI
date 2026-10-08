import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Brain,
  CheckCircle2,
  ClipboardList,
  Clock3,
  LoaderCircle,
} from "lucide-react";
import { Link } from "react-router";
import Card from "../components/ui/Card.jsx";
import FeedbackState from "../components/ui/FeedbackState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import TeamPerformanceTable from "../components/TeamPerformanceTable.jsx";
import {
  getAssignments,
  getCaseHistory,
  getCases,
  getDepartments,
  getPredictions,
  getRecommendations,
  getTeamPerformance,
  getTeams,
} from "../services/dashboardApi.js";

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

function FailureNotice({ resources, message }) {
  const failures = resources.filter(isFailure);
  if (failures.length === 0) return null;

  return (
    <div className="dashboard-inline-error" role="alert">
      <span>{message ?? "Some dashboard data could not be loaded."}</span>
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

function ResourceFeedback({ resource, emptyTitle, emptyDescription }) {
  if (resource.status === "loading") {
    return <FeedbackState type="loading" title={`Loading ${resource.label}...`} compact />;
  }
  if (isFailure(resource)) {
    const title = resource.status === "unauthorized"
      ? `Access to ${resource.label} is unavailable.`
      : resource.status === "network"
        ? `Connection unavailable while loading ${resource.label}.`
        : `Unable to load ${resource.label}.`;
    return (
      <div className="dashboard-feedback-wrap">
        <FeedbackState
          type={resource.status}
          title={title}
          description="Please try again in a moment."
          compact
        />
        <button className="dashboard-retry-button" type="button" onClick={resource.retry}>
          Retry
        </button>
      </div>
    );
  }
  return (
    <FeedbackState
      type="empty"
      title={emptyTitle ?? `No ${resource.label} available.`}
      description={emptyDescription}
      compact
    />
  );
}

function resourceGroupState(resources) {
  const failures = resources.filter(isFailure);
  if (failures.length > 0) return { status: "error", failures };
  if (resources.some((resource) => resource.status === "loading")) {
    return { status: "loading", failures: [] };
  }
  return { status: "success", failures: [] };
}

function formatCount(value) {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(number)
    : "—";
}

function formatNumber(value, digits = 1) {
  if (value == null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(number)
    : "—";
}

function formatPercent(value) {
  if (value == null || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  const percentage = Math.abs(number) <= 1 ? number * 100 : number;
  return `${formatNumber(percentage)}%`;
}

function formatConfidence(value) {
  return formatPercent(value);
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

function DashboardMetric({ label, description, icon: Icon, resources, calculate, href }) {
  const group = resourceGroupState(resources);
  let value = null;
  if (group.status === "success") {
    value = calculate(...resources.map((resource) => resource.data));
  }

  return (
    <Card as="article" className="dashboard-metric-card dashboard-clickable-card" aria-busy={group.status === "loading"}>
      <Link className="dashboard-metric-link" to={href}>
        <div className="dashboard-metric-topline">
          <span className="dashboard-metric-icon"><Icon size={18} aria-hidden="true" /></span>
          <span className="dashboard-metric-label">{label}</span>
        </div>
        {group.status === "loading" ? (
          <span className="dashboard-metric-loading" aria-label={`Loading ${label}`}>
            <LoaderCircle size={20} className="is-spinning" />
          </span>
        ) : group.status === "error" ? (
          <strong className="dashboard-metric-unavailable">Unavailable</strong>
        ) : (
          <strong className="dashboard-metric-value">{formatCount(value)}</strong>
        )}
        <p>{description}</p>
      </Link>
      {group.status === "error" ? (
        <div className="dashboard-retry-actions metric-retry-actions">
          {group.failures.map((resource) => (
            <button key={resource.label} type="button" onClick={resource.retry}>
              Retry {resource.label}
            </button>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function MiniMetric({ label, resource, icon: Icon, href }) {
  return (
    <div className="dashboard-ai-metric" aria-busy={resource.status === "loading"}>
      <Link className="dashboard-ai-metric-link" to={href}>
        <span className="dashboard-ai-metric-icon"><Icon size={15} aria-hidden="true" /></span>
        <div className="dashboard-ai-metric-copy">
          <span>{label}</span>
          {resource.status === "loading" ? (
            <LoaderCircle size={16} className="is-spinning dashboard-small-spinner" aria-label={`Loading ${label}`} />
          ) : isFailure(resource) ? (
            <span className="dashboard-ai-metric-error">Unavailable</span>
          ) : (
            <strong>{formatCount(resource.data.length)}</strong>
          )}
        </div>
      </Link>
      {isFailure(resource) ? (
        <button className="dashboard-icon-retry" type="button" onClick={resource.retry} aria-label={`Retry ${label}`}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

function getCaseRows(caseResource, historyResource) {
  return [caseResource, historyResource]
    .filter((resource) => resource.status === "success")
    .flatMap((resource) => resource.data);
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

function getRecentPerformanceRows(rows) {
  const records = rows.map((record, index) => {
    const timestamp = record.last_updated ? new Date(record.last_updated).getTime() : Number.NaN;
    return { record, index, timestamp };
  });
  const hasTimestamp = records.some(({ timestamp }) => Number.isFinite(timestamp));
  if (!hasTimestamp) return rows.slice(0, 5);

  return records
    .sort((left, right) => {
      const leftValid = Number.isFinite(left.timestamp);
      const rightValid = Number.isFinite(right.timestamp);
      if (!leftValid && !rightValid) return left.index - right.index;
      if (!leftValid) return 1;
      if (!rightValid) return -1;
      return right.timestamp - left.timestamp || left.index - right.index;
    })
    .slice(0, 5)
    .map(({ record }) => record);
}

function countByStatus(rows) {
  const counts = new Map();
  rows.forEach((row) => {
    const status = typeof row.status === "string" && row.status.trim()
      ? row.status.trim()
      : "Status unavailable";
    counts.set(status, (counts.get(status) ?? 0) + 1);
  });
  return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
}

function CaseDataNotice({ caseResources, rows }) {
  const group = resourceGroupState(caseResources);
  const hasRows = rows.length > 0;
  if (!hasRows && group.status === "loading") {
    return <FeedbackState type="loading" title="Loading case records..." compact />;
  }
  if (!hasRows && group.status === "error") {
    return <FailureNotice resources={caseResources} message="Case information is temporarily unavailable." />;
  }
  if (!hasRows && group.status === "success") {
    return <FeedbackState type="empty" title="No cases available yet." compact />;
  }
  return null;
}

function CaseWorkflow({ caseResources, rows }) {
  const statuses = countByStatus(rows);

  return (
    <Card className="dashboard-section-card">
      <div className="dashboard-section-heading">
        <div>
          <h2>Case workflow</h2>
          <p className="card-subtitle">Overview of cases across the clinical workflow.</p>
        </div>
        <Link className="dashboard-header-link" to="/cases">View cases <ArrowUpRight size={14} aria-hidden="true" /></Link>
      </div>
      <CaseDataNotice caseResources={caseResources} rows={rows} />
      {statuses.length > 0 ? (
        <div className="dashboard-status-grid">
          {statuses.map(([status, count]) => (
            <div className="dashboard-status-item" key={status}>
              <StatusBadge status={status} />
              <strong>{formatCount(count)}</strong>
            </div>
          ))}
        </div>
      ) : null}
      {rows.length > 0 ? <FailureNotice resources={caseResources} message="Some case results could not be loaded; visible counts may be incomplete." /> : null}
      {caseResources.some((resource) => resource.status === "loading") && rows.length > 0 ? (
        <p className="dashboard-partial-note">Loading the remaining case records.</p>
      ) : null}
    </Card>
  );
}

function RecentCases({ caseResources, rows }) {
  const recent = sortRecentCases(rows).slice(0, 6);

  return (
    <Card className="dashboard-section-card dashboard-recent-card">
      <div className="dashboard-section-heading">
        <div>
          <p className="card-eyebrow">Recently submitted</p>
          <h2>Recent cases</h2>
        </div>
        <Link className="dashboard-header-link" to="/cases">Open cases <ArrowUpRight size={14} aria-hidden="true" /></Link>
      </div>
      <CaseDataNotice caseResources={caseResources} rows={rows} />
      {recent.length > 0 ? (
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th scope="col">Case ID</th>
                <th scope="col">Status</th>
                <th scope="col">Priority</th>
                <th scope="col">Type</th>
                <th scope="col">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row, index) => (
                <tr key={row.case_id ?? `case-${index}`}>
                  <td className="dashboard-case-id">{row.case_id ?? "—"}</td>
                  <td><StatusBadge status={row.status} /></td>
                  <td>{row.priority ?? "—"}</td>
                  <td>
                    {row.is_emergency === true
                      ? <span className="dashboard-emergency"><AlertTriangle size={13} /> Emergency</span>
                      : row.is_emergency === false
                        ? "Standard"
                        : "—"}
                  </td>
                  <td>{formatDateTime(row.submitted_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {rows.length > 0 ? <FailureNotice resources={caseResources} message="Some case results could not be loaded; the visible list may be incomplete." /> : null}
    </Card>
  );
}

function DepartmentOverview({ departments, teams }) {
  return (
    <Card className="dashboard-section-card">
      <div className="dashboard-section-heading">
        <div>
          <p className="card-eyebrow">Organization</p>
          <h2>Departments &amp; Teams</h2>
          <p className="card-subtitle">Clinical departments and their active teams.</p>
        </div>
        <div className="dashboard-section-actions">
          <Link className="dashboard-header-link" to="/departments">Departments <ArrowUpRight size={14} aria-hidden="true" /></Link>
          <Link className="dashboard-header-link" to="/teams">Teams <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </div>
      </div>
      {departments.status !== "success" ? (
        <ResourceFeedback resource={departments} emptyTitle="No departments available." />
      ) : departments.data.length === 0 ? (
        <FeedbackState type="empty" title="No departments available." compact />
      ) : (
        <ul className="dashboard-department-list">
          {departments.data.map((department, index) => {
            const activeTeams = teams.status === "success"
              ? teams.data.filter((team) => String(team.status ?? "").trim().toLowerCase() === "active")
              : null;
            const relatedTeams = activeTeams?.filter(
              (team) => String(team.department_id) === String(department.department_id),
            ).length;
            return (
              <li key={department.department_id ?? `department-${index}`}>
                <div>
                  <strong>{department.department_name ?? "Department name unavailable"}</strong>
                  {department.description ? <p>{department.description}</p> : null}
                </div>
                <span className="dashboard-department-team-count">
                  {relatedTeams == null
                    ? teams.status === "loading" ? "Loading teams" : "Team count unavailable"
                    : `${formatCount(relatedTeams)} ${relatedTeams === 1 ? "active team" : "active teams"}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {isFailure(teams) ? <FailureNotice resources={[teams]} message="Active team counts are temporarily unavailable." /> : null}
    </Card>
  );
}

function TeamPerformance({ resource }) {
  return (
    <Card className="dashboard-section-card dashboard-performance-card">
      <div className="dashboard-section-heading">
        <div>
          <p className="card-eyebrow">Clinical operations</p>
          <h2>Team Performance</h2>
          <p className="card-subtitle">Recent performance across clinical teams.</p>
        </div>
        <Link className="dashboard-header-link" to="/team-performance">
          View all metrics <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>
      {resource.status !== "success" ? (
        <ResourceFeedback resource={resource} emptyTitle="No team performance data available." />
      ) : resource.data.length === 0 ? (
        <FeedbackState type="empty" title="No team performance data available." compact />
      ) : (
        <TeamPerformanceTable rows={getRecentPerformanceRows(resource.data)} />
      )}
    </Card>
  );
}

function RecentPredictions({ resource }) {
  if (resource.status !== "success") {
    return <ResourceFeedback resource={resource} emptyTitle="No AI predictions available yet." />;
  }
  if (resource.data.length === 0) {
    return <FeedbackState type="empty" title="No AI predictions available yet." compact />;
  }

  return (
    <div className="dashboard-prediction-list">
      {resource.data.slice(0, 2).map((prediction, index) => (
        <Link className="dashboard-prediction-row" to="/predictions" key={prediction.prediction_id ?? `prediction-${index}`}>
          <div>
            <strong>{prediction.case_id ?? "Case ID unavailable"}</strong>
            <span>{prediction.department_name ?? "Department unavailable"}</span>
          </div>
          <div className="dashboard-prediction-confidence">
            <span>{prediction.confidence_level_label ?? "Confidence unavailable"}</span>
            {prediction.confidence_score != null ? <strong>{formatConfidence(prediction.confidence_score)}</strong> : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

function AiInsights({ predictions, recommendations, assignments }) {
  return (
    <Card className="dashboard-section-card dashboard-ai-card">
      <div className="dashboard-section-heading">
        <div>
          <h2>AI-Assisted Overview</h2>
          <p className="card-subtitle">Review AI-generated insights while keeping clinical decisions under human oversight.</p>
        </div>
        <span className="dashboard-ai-heading-icon"><Brain size={19} aria-hidden="true" /></span>
      </div>
      <div className="ai-advisory-note">
        <span><CheckCircle2 size={16} aria-hidden="true" /></span>
        <p><strong>Advisory only.</strong> Review AI-assisted information with the appropriate clinical context.</p>
      </div>
      <div className="dashboard-ai-content-grid">
        <div className="dashboard-ai-metrics">
          <MiniMetric label="Predictions" resource={predictions} icon={Brain} href="/predictions" />
          <MiniMetric label="Recommendations" resource={recommendations} icon={Activity} href="/recommendations" />
          <MiniMetric label="Recorded assignments" resource={assignments} icon={ClipboardList} href="/assignments" />
        </div>
        <div className="dashboard-predictions-block">
          <div className="dashboard-subsection-heading">
            <h3>Recent Predictions</h3>
            <Link className="dashboard-header-link" to="/predictions">View predictions <ArrowUpRight size={14} aria-hidden="true" /></Link>
          </div>
          <RecentPredictions resource={predictions} />
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const cases = useDashboardResource(getCases, "cases");
  const history = useDashboardResource(getCaseHistory, "case history");
  const departments = useDashboardResource(getDepartments, "departments");
  const teams = useDashboardResource(getTeams, "clinical teams");
  const performance = useDashboardResource(getTeamPerformance, "team performance");
  const predictions = useDashboardResource(getPredictions, "predictions");
  const recommendations = useDashboardResource(getRecommendations, "recommendations");
  const assignments = useDashboardResource(getAssignments, "assignments");
  const caseResources = useMemo(() => [cases, history], [cases, history]);
  const caseRows = useMemo(() => getCaseRows(cases, history), [cases, history]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A current operational overview of your clinical workspace."
      />

      <section className="dashboard-summary-grid" aria-label="Operational summary">
        <DashboardMetric
          label="Total cases"
          description="Cases currently in your workspace"
          icon={ClipboardList}
          resources={[cases, history]}
          calculate={(currentCases, caseHistory) => currentCases.length + caseHistory.length}
          href="/cases"
        />
        <DashboardMetric
          label="Pending prediction"
          description="Cases awaiting AI classification"
          icon={Clock3}
          resources={[cases]}
          calculate={(rows) => rows.filter((row) => String(row.status ?? "").trim().toLowerCase() === "pending prediction").length}
          href="/cases"
        />
        <DashboardMetric
          label="Assigned cases"
          description="Cases assigned for clinical review"
          icon={CheckCircle2}
          resources={[history]}
          calculate={(rows) => rows.length}
          href="/assignments"
        />
        <DashboardMetric
          label="AI predictions"
          description="AI-assisted classifications available for review"
          icon={Brain}
          resources={[predictions]}
          calculate={(rows) => rows.length}
          href="/predictions"
        />
      </section>

      <div className="dashboard-primary-grid">
        <CaseWorkflow caseResources={caseResources} rows={caseRows} />
        <AiInsights predictions={predictions} recommendations={recommendations} assignments={assignments} />
      </div>

      <RecentCases caseResources={caseResources} rows={caseRows} />

      <div className="dashboard-secondary-grid">
        <DepartmentOverview departments={departments} teams={teams} />
        <Card className="dashboard-section-card dashboard-team-summary-card">
          <div className="dashboard-section-heading">
            <div>
              <p className="card-eyebrow">Clinical operations</p>
              <h2>Team Directory Summary</h2>
            </div>
            <Link className="dashboard-header-link" to="/teams">View teams <ArrowUpRight size={14} aria-hidden="true" /></Link>
          </div>
          {teams.status !== "success" ? (
            <ResourceFeedback resource={teams} emptyTitle="No clinical teams available." />
          ) : teams.data.length === 0 ? (
            <FeedbackState type="empty" title="No clinical teams available." compact />
          ) : (
            <Link className="dashboard-team-total" to="/teams">
              <strong>{formatCount(teams.data.length)}</strong>
              <span>clinical teams across the organization</span>
            </Link>
          )}
        </Card>
      </div>

      <TeamPerformance resource={performance} />
    </>
  );
}
