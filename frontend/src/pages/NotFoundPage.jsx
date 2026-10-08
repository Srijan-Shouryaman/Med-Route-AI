import { Link } from "react-router";
import Card from "../components/ui/Card.jsx";
import FeedbackState from "../components/ui/FeedbackState.jsx";

export default function NotFoundPage() {
  return (
    <Card className="not-found-card">
      <p className="page-eyebrow">404 · Page not found</p>
      <FeedbackState
        type="empty"
        title="We couldn’t find that page."
        description="The address may have changed or may not be part of this workspace."
      />
      <Link className="primary-link-button" to="/">Return to dashboard</Link>
    </Card>
  );
}
