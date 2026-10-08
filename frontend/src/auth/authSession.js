export const SESSION_EXPIRED_EVENT = "medflow:session-expired";

const SESSION_STORAGE_KEY = "medflow.auth.session.v1";

function getStorage() {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isJwtExpired(token) {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return true;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(window.atob(padded));
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

function isSessionShape(value) {
  const user = value?.user;
  return (
    typeof value?.token === "string" &&
    value.token.length > 0 &&
    typeof value?.tokenType === "string" &&
    value.tokenType.length > 0 &&
    typeof user?.user_id === "number" &&
    typeof user?.email === "string" &&
    typeof user?.full_name === "string" &&
    typeof user?.role === "string" &&
    Object.prototype.hasOwnProperty.call(user, "department_id")
  );
}

export function clearStoredSession() {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
}

function notifySessionExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}

export function readStoredSession({ notifyExpired = false } = {}) {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const storedValue = storage.getItem(SESSION_STORAGE_KEY);
    if (!storedValue) return null;

    const session = JSON.parse(storedValue);
    if (!isSessionShape(session)) {
      clearStoredSession();
      return null;
    }

    if (isJwtExpired(session.token)) {
      clearStoredSession();
      if (notifyExpired) notifySessionExpired();
      return null;
    }

    return session;
  } catch {
    clearStoredSession();
    return null;
  }
}

export function storeSession(session) {
  const storage = getStorage();
  if (!storage) throw new Error("Session storage is unavailable in this browser.");

  try {
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    throw new Error("Unable to save your session in this browser.");
  }
}
