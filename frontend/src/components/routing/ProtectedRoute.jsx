import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../../auth/AuthContext.jsx";
import FeedbackState from "../ui/FeedbackState.jsx";

export default function ProtectedRoute() {
  const { isAuthenticated, isRestoring } = useAuth();
  const location = useLocation();

  if (isRestoring) {
    return (
      <main className="auth-restore-screen">
        <FeedbackState
          type="loading"
          title="Restoring your session"
          description="Please wait while we check your saved session."
        />
      </main>
    );
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ returnTo }} />;
  }

  return <Outlet />;
}
