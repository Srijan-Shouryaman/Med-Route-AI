import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError } from "../services/apiClient.js";
import { loginWithEmail } from "../services/authApi.js";
import {
  clearStoredSession,
  readStoredSession,
  SESSION_EXPIRED_EVENT,
  storeSession,
} from "./authSession.js";

const AuthContext = createContext(null);

function createSession(response) {
  const requiredFields = ["user_id", "email", "full_name", "role", "department_id"];
  const hasRequiredUserFields =
    response && requiredFields.every((field) => Object.prototype.hasOwnProperty.call(response, field));

  if (
    typeof response?.access_token !== "string" ||
    !response.access_token ||
    typeof response?.token_type !== "string" ||
    !response.token_type ||
    typeof response.user_id !== "number" ||
    typeof response.email !== "string" ||
    typeof response.full_name !== "string" ||
    typeof response.role !== "string" ||
    !hasRequiredUserFields
  ) {
    throw new ApiError("The server returned an incomplete login response. Please try again.", 502, "invalid_login_response");
  }

  return {
    token: response.access_token,
    tokenType: response.token_type,
    user: {
      user_id: response.user_id,
      email: response.email,
      full_name: response.full_name,
      role: response.role,
      department_id: response.department_id,
    },
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readStoredSession());
  const [isRestoring, setIsRestoring] = useState(true);
  const [authNotice, setAuthNotice] = useState("");

  useEffect(() => {
    setIsRestoring(false);
  }, []);

  const expireSession = useCallback(() => {
    clearStoredSession();
    setSession(null);
    setAuthNotice("Your session has expired. Please log in again.");
  }, []);

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, expireSession);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expireSession);
  }, [expireSession]);

  const login = useCallback(async (email, password) => {
    const response = await loginWithEmail(email, password);
    const nextSession = createSession(response);
    storeSession(nextSession);
    setSession(nextSession);
    setAuthNotice("");
    return nextSession;
  }, []);

  const logout = useCallback(() => {
    clearStoredSession();
    setSession(null);
    setAuthNotice("");
  }, []);

  const clearAuthNotice = useCallback(() => setAuthNotice(""), []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isAuthenticated: Boolean(session?.token && session?.user),
      isRestoring,
      authNotice,
      login,
      logout,
      clearAuthNotice,
    }),
    [session, isRestoring, authNotice, login, logout, clearAuthNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
