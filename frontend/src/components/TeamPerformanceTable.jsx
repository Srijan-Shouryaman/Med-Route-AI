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

export default function TeamPerformanceTable({ rows }) {
  return (
    <div className="dashboard-table-wrap dashboard-performance-table-wrap">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th scope="col">Team</th>
            <th scope="col">Cases handled</th>
            <th scope="col">Success rate</th>
            <th scope="col">Average resolution (hours)</th>
            <th scope="col">Emergency success rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((team, index) => (
            <tr key={team.performance_id ?? team.team_id ?? `performance-${index}`}>
              <td>{team.team_name ?? "Team name unavailable"}</td>
              <td>{formatNumber(team.total_cases_handled, 0)}</td>
              <td>{formatPercent(team.success_rate)}</td>
              <td>{formatNumber(team.average_case_resolution_time_hours)}</td>
              <td>{formatPercent(team.emergency_success_rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
