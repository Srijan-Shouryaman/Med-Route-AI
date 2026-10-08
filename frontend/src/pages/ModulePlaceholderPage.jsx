import { Sparkles } from "lucide-react";
import Card from "../components/ui/Card.jsx";
import FeedbackState from "../components/ui/FeedbackState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";

const caseStatuses = ["Uploaded", "Predicted", "Under Review", "Assigned", "In Progress", "Resolved"];

export default function ModulePlaceholderPage({ module }) {
  const isCases = module.href === "/cases";

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

      <Card className="module-empty-card">
        <FeedbackState
          type="empty"
          title={`No ${module.label.toLowerCase()} data to display yet`}
          description="This view is ready for the next implementation phase. No sample or placeholder records are shown."
        />
      </Card>
    </>
  );
}
