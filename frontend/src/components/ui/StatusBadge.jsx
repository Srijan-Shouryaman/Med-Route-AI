const statusStyles = {
  uploaded: "status-neutral",
  predicted: "status-indigo",
  "pending prediction": "status-blue",
  "pending human review": "status-amber",
  recommended: "status-amber",
  "flagged - no eligible team": "status-amber",
  "under review": "status-amber",
  assigned: "status-blue",
  "in progress": "status-blue",
  resolved: "status-green",
  extracted: "status-green",
  failed: "status-amber",
  pending: "status-blue",
  high: "status-green",
  medium: "status-amber",
  low: "status-blue",
};

export default function StatusBadge({ status, children }) {
  const label = children ?? status ?? "Unknown";
  const style = statusStyles[String(label).trim().toLowerCase()] ?? "status-neutral";

  return <span className={`status-badge ${style}`}>{label}</span>;
}
