import { apiClient } from "./apiClient.js";

export function loginWithEmail(email, password) {
  return apiClient("/api/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
}
