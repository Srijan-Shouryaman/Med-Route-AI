import { ApiError, apiClient } from "./apiClient.js";

async function getList(path, resourceName) {
  const response = await apiClient(path);
  if (!Array.isArray(response)) {
    throw new ApiError(
      `The server returned an unexpected ${resourceName} response.`,
      502,
      "invalid_response",
    );
  }
  return response;
}

export const getCases = () => getList("/api/cases/", "cases");
export const getCaseHistory = () => getList("/api/cases/history", "case history");
export const getDepartments = () => getList("/api/departments/", "departments");
export const getTeams = () => getList("/api/teams/", "clinical teams");
export const getTeamPerformance = () => getList("/api/team-performance/", "team performance");
export const getPredictions = () => getList("/api/predictions/", "predictions");
export const getRecommendations = () => getList("/api/recommendations/", "recommendations");
export const getAssignments = () => getList("/api/assignments/", "assignments");
