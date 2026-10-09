import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Search } from "lucide-react";
import { Link } from "react-router";
import Card from "../components/ui/Card.jsx";
import FeedbackState from "../components/ui/FeedbackState.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import { getCases, getCaseHistory } from "../services/dashboardApi.js";
import { formatDate, loadFailureKind } from "../utils/formatters.js";

export default function CasesPage() {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ status: "loading", cases: [] });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    let active = true;
    setState({ status: "loading", cases: [] });
    Promise.all([getCases(), getCaseHistory()])
      .then(([openCases, history]) => {
        if (!active) return;
        const uniqueCases = new Map();
        [...openCases, ...history].forEach((caseRecord) => {
          if (caseRecord?.case_id != null) uniqueCases.set(String(caseRecord.case_id), caseRecord);
        });
        const cases = [...uniqueCases.values()].sort((left, right) =>
          String(right.submitted_at ?? "").localeCompare(String(left.submitted_at ?? "")));
        setState({ status: "success", cases });
      })
      .catch((error) => { if (active) setState({ status: loadFailureKind(error), cases: [] }); });
    return () => { active = false; };
  }, [revision]);

  const statuses = useMemo(() => [...new Set(state.cases.map((item) => item.status).filter(Boolean))].sort(), [state.cases]);
  const filteredCases = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return state.cases.filter((caseRecord) => {
      const matchesSearch = !query || [caseRecord.case_id, caseRecord.patient_ref_id, caseRecord.priority, caseRecord.status]
        .some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
      return matchesSearch && (statusFilter === "All" || caseRecord.status === statusFilter);
    });
  }, [search, state.cases, statusFilter]);

  return (
    <Card className="case-list-card">
        <div className="workflow-list-toolbar">
          <div>
            <p className="card-eyebrow">Case work queue</p>
            <h2>Case records</h2>
          </div>
          <div className="workflow-list-controls">
            <label className="patient-search">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Search cases</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search case, patient, or status" />
            </label>
            <label className="workflow-filter">
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by case status">
                <option value="All">All statuses</option>
                {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
          </div>
        </div>

        {state.status === "loading" ? (
          <FeedbackState type="loading" title="Loading case records..." />
        ) : state.status !== "success" ? (
          <div className="patient-load-error">
            <FeedbackState
              type={state.status}
              title={state.status === "unauthorized" ? "Cases are unavailable for this account." : state.status === "network" ? "Could not connect to the case workflow." : "Unable to load cases."}
              description="Please try again in a moment."
            />
            <button className="patient-secondary-button" type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button>
          </div>
        ) : filteredCases.length === 0 ? (
          <FeedbackState
            type="empty"
            title={state.cases.length ? "No matching cases found." : "No cases are available."}
            description={state.cases.length ? "Change the search or status filter." : "Cases will appear here when they are created from reports."}
          />
        ) : (
          <div className="patient-table-scroll">
            <table className="patient-table case-table">
              <thead>
                <tr>
                  <th scope="col">Case ID</th>
                  <th scope="col">Patient reference</th>
                  <th scope="col">Priority / Urgency</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((caseRecord) => (
                  <tr key={caseRecord.case_id}>
                    <td><Link className="patient-reference workflow-case-link" to={`/cases/${encodeURIComponent(caseRecord.case_id)}`}>{caseRecord.case_id}</Link></td>
                    <td>{caseRecord.patient_ref_id || "—"}</td>
                    <td>
                      <div className="case-priority-urgency">
                        <span className="case-priority-value">{caseRecord.priority || "\u2014"}</span>
                        <span className={`case-urgency-value${caseRecord.is_emergency ? " is-urgent" : ""}`}>
                          {caseRecord.is_emergency
                            ? <><AlertTriangle size={13} aria-hidden="true" /> Urgent</>
                            : "Routine"}
                        </span>
                      </div>
                    </td>
                    <td>{formatDate(caseRecord.submitted_at, { includeTime: true })}</td>
                    <td><StatusBadge status={caseRecord.status}>{caseRecord.status || "Unknown"}</StatusBadge></td>
                    <td><Link className="patient-view-link" to={`/cases/${encodeURIComponent(caseRecord.case_id)}`}>View case <ArrowRight size={13} aria-hidden="true" /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {state.status === "success" && state.cases.length > 0 ? (
          <p className="patient-table-footnote">Showing {filteredCases.length} of {state.cases.length} cases</p>
        ) : null}
    </Card>
  );
}
