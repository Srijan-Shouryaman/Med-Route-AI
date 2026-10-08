import { ApiError, apiClient } from "./apiClient.js";

const diagnosisPaths = {
  "brain-stroke": "/api/diagnosis/brain-stroke",
  "lung-cancer": "/api/diagnosis/lung-cancer",
};

export async function diagnoseImage(modelId, file) {
  const path = diagnosisPaths[modelId];
  if (!path) throw new ApiError("Choose an available diagnosis model.", 400, "invalid_model");
  if (!(file instanceof File)) throw new ApiError("Choose an image file before running the analysis.", 400, "missing_image");

  const body = new FormData();
  body.append("file", file);
  const result = await apiClient(path, { method: "POST", body });
  if (!result || typeof result !== "object" || Array.isArray(result) || typeof result.prediction !== "string") {
    throw new ApiError("The diagnosis service returned an unexpected response.", 502, "invalid_response");
  }
  return result;
}
