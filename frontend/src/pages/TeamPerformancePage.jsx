import { useEffect, useState } from "react";
import Card from "../components/ui/Card.jsx";
import FeedbackState from "../components/ui/FeedbackState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import TeamPerformanceTable from "../components/TeamPerformanceTable.jsx";
import { getTeamPerformance } from "../services/dashboardApi.js";

export default function TeamPerformancePage() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: "loading", rows: [] });

  useEffect(() => {
    let active = true;
    setState({ status: "loading", rows: [] });
    getTeamPerformance()
      .then((rows) => {
        if (active) setState({ status: "success", rows });
      })
      .catch((error) => {
        if (!active) return;
        const status = error?.status === 401 || error?.status === 403
          ? "unauthorized"
          : error?.code === "network_error"
            ? "network"
            : "error";
        setState({ status, rows: [] });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Team Performance"
        description="Performance across clinical teams."
      />
      <Card className="dashboard-section-card dashboard-performance-page-card">
        {state.status === "loading" ? (
          <FeedbackState type="loading" title="Loading team performance..." compact />
        ) : ["error", "network", "unauthorized"].includes(state.status) ? (
          <div className="dashboard-feedback-wrap">
            <FeedbackState
              type={state.status}
              title={state.status === "unauthorized" ? "Access to team performance is unavailable." : "Unable to load team performance."}
              description="Please try again in a moment."
              compact
            />
            <button className="dashboard-retry-button" type="button" onClick={() => setAttempt((value) => value + 1)}>
              Retry
            </button>
          </div>
        ) : state.rows.length === 0 ? (
          <FeedbackState type="empty" title="No team performance data available." compact />
        ) : (
          <TeamPerformanceTable rows={state.rows} />
        )}
      </Card>
    </>
  );
}
