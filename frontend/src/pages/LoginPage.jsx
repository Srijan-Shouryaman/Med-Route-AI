import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, HeartPulse, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext.jsx";

function getSafeReturnPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value === "/login" || value.startsWith("/login?")) return "/";
  return value;
}

export default function LoginPage() {
  const { login, isAuthenticated, isRestoring, authNotice, clearAuthNotice } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const returnTo = getSafeReturnPath(location.state?.returnTo);

  useEffect(() => {
    if (!isRestoring && isAuthenticated) {
      navigate(returnTo, { replace: true });
    }
  }, [isRestoring, isAuthenticated, navigate, returnTo]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    clearAuthNotice();

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError("Enter your email and password to continue.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(normalizedEmail, password);
      navigate(returnTo, { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isRestoring || isAuthenticated) {
    return (
      <main className="auth-restore-screen">
        <div className="login-loading-mark"><HeartPulse size={22} aria-hidden="true" /></div>
        <p>Opening your workspace...</p>
      </main>
    );
  }

  const visibleError = error || authNotice;

  return (
    <main className="login-screen">
      <section className="login-identity-panel">
        <div className="login-brand">
          <span className="brand-mark"><HeartPulse size={22} strokeWidth={2.1} aria-hidden="true" /></span>
          <span className="brand-text">
            <strong>MedFlow <span>AI</span></strong>
            <small>Clinical workspace</small>
          </span>
        </div>

        <div className="login-story">
          <span className="login-story-kicker">A clearer path through care</span>
          <h1>Clinical insight.<br />Human judgment.</h1>
          <p>
            MedFlow AI brings clinical teams and decision support into one thoughtful workspace.
          </p>
          <div className="login-value-list">
            <div><span><HeartPulse size={17} /></span><p><strong>Connected workflows</strong><small>Keep each review step clear.</small></p></div>
            <div><span className="login-value-ai"><ShieldCheck size={17} /></span><p><strong>Human-led decisions</strong><small>AI insight stays advisory.</small></p></div>
          </div>
        </div>

        <div className="login-panel-footer">
          <span><LockKeyhole size={14} /> Secure access for authorized hospital staff</span>
          <span>MedFlow AI</span>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <span className="brand-mark"><HeartPulse size={22} aria-hidden="true" /></span>
            <strong>MedFlow <span>AI</span></strong>
          </div>
          <div className="login-form-heading">
            <p className="page-eyebrow">Welcome back</p>
            <h2>Sign in to MedFlow</h2>
            <p>Use your hospital account to access your clinical workspace.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="login-email">Email address</label>
            <div className="login-input-wrap">
              <Mail size={17} aria-hidden="true" />
              <input
                autoComplete="username"
                autoCapitalize="none"
                id="login-email"
                name="email"
                type="email"
                inputMode="email"
                placeholder="name@hospital.org"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="login-label-row">
              <label htmlFor="login-password">Password</label>
            </div>
            <div className="login-input-wrap">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                autoComplete="current-password"
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                required
                disabled={isSubmitting}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="password-visibility-button"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                disabled={isSubmitting}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {visibleError ? (
              <div className="login-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{visibleError}</span>
              </div>
            ) : null}

            <button className="login-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <><span className="login-spinner" aria-hidden="true" />Signing in...</>
              ) : (
                <>Sign in <ArrowRight size={17} aria-hidden="true" /></>
              )}
            </button>
          </form>

          <p className="login-secure-note"><ShieldCheck size={15} /> Authorized hospital staff only</p>
          <p className="login-no-registration">Account access is managed by your hospital administrator.</p>
        </div>
      </section>
    </main>
  );
}
