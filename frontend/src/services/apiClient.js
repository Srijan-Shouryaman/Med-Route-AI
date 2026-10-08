import { API_BASE_URL } from "./apiConfig.js";
import { clearStoredSession, readStoredSession, SESSION_EXPIRED_EVENT } from "../auth/authSession.js";

const messages = {
  400: "The request could not be completed. Check the information and try again.",
  403: "You do not have permission to access this resource.",
  404: "The requested resource was not found.",
  422: "Some information is missing or invalid. Check your entries and try again.",
  500: "The server encountered an error. Please try again later.",
};

export class ApiError extends Error {
  constructor(message, status = 0, code = "api_error", payload = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

function getRequestUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

async function readResponseBody(response) {
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("json")) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  return text;
}

function messageForResponse(status, payload, isLoginRequest) {
  const detail = typeof payload?.detail === "string" ? payload.detail.toLowerCase() : "";

  if (status === 401 && isLoginRequest) {
    return detail.includes("inactive")
      ? "This account is inactive. Contact your administrator."
      : "Invalid email or password.";
  }
  if (status === 401) return "Your session has expired. Please log in again.";
  return messages[status] ?? "The request could not be completed. Please try again.";
}

function isBodyFormData(body) {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function isBodyAlreadyEncoded(body) {
  return (
    isBodyFormData(body) ||
    (typeof Blob !== "undefined" && body instanceof Blob) ||
    (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) ||
    (typeof ArrayBuffer !== "undefined" && body instanceof ArrayBuffer) ||
    ArrayBuffer.isView(body)
  );
}

export async function apiClient(
  path,
  { method = "GET", headers: suppliedHeaders, body: suppliedBody, auth = true, ...options } = {},
) {
  const headers = new Headers(suppliedHeaders ?? {});
  const session = auth ? readStoredSession({ notifyExpired: true }) : null;
  if (session?.token) {
    const authScheme = session.tokenType.toLowerCase() === "bearer"
      ? "Bearer"
      : session.tokenType;
    headers.set("Authorization", `${authScheme} ${session.token}`);
  }

  let body = suppliedBody;
  if (body != null && typeof body === "object" && !isBodyAlreadyEncoded(body)) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(getRequestUrl(path), { ...options, method, headers, body });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("Unable to connect to the server. Please try again.", 0, "network_error");
  }

  const payload = await readResponseBody(response);
  if (!response.ok) {
    if (response.status === 401 && auth && session?.token) {
      clearStoredSession();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
    }

    const isLoginRequest = path.endsWith("/api/auth/login");
    throw new ApiError(
      messageForResponse(response.status, payload, isLoginRequest),
      response.status,
      `http_${response.status}`,
      payload,
    );
  }

  return payload;
}
