import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Brain, CheckCircle2, FileImage, ScanLine, Sparkles, UploadCloud } from "lucide-react";
import Card from "../components/ui/Card.jsx";
import FeedbackState from "../components/ui/FeedbackState.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import { diagnoseImage } from "../services/diagnosisApi.js";

const diagnosisModels = [
  {
    id: "brain-stroke",
    name: "Brain Stroke",
    description: "Brain CT image classification with the existing Stroke and Control classes.",
    model: "ResNet-18",
    classes: ["Control", "Stroke"],
    icon: Brain,
  },
  {
    id: "lung-cancer",
    name: "Lung Cancer",
    description: "Image classification with the four classes returned by the existing model.",
    model: "ResNet-50",
    classes: ["Adenocarcinoma", "Large Cell Carcinoma", "Normal", "Squamous Cell Carcinoma"],
    icon: Activity,
  },
];

function percent(value) {
  if (value == null) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return typeof value === "string" ? value : JSON.stringify(value);
  const display = number <= 1 ? number * 100 : number;
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(display)}%`;
}

function probabilityEntries(probabilities) {
  if (Array.isArray(probabilities)) return probabilities.map((item, index) => [item?.class_name ?? item?.label ?? `Class ${index + 1}`, item?.probability ?? item?.score ?? item]);
  if (probabilities && typeof probabilities === "object") return Object.entries(probabilities);
  return [];
}

function diagnosisErrorMessage(error) {
  if (error?.status === 400) {
    const detail = error?.payload?.detail;
    return typeof detail === "string" ? detail : "Choose a valid image file and try again.";
  }
  if (error?.status === 401 || error?.status === 403 || error?.code === "network_error") return error.message;
  if (error?.status === 404) return "This diagnosis endpoint is unavailable. Contact your administrator.";
  if (error?.status === 413) return "The selected image is too large for the diagnosis service.";
  return "The diagnosis could not be completed. Check the image and try again later.";
}

export default function DiagnosisPage() {
  const [modelId, setModelId] = useState("brain-stroke");
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [request, setRequest] = useState({ status: "idle", result: null, error: "" });
  const [diagnosisView, setDiagnosisView] = useState("results");

  const model = useMemo(() => diagnosisModels.find((entry) => entry.id === modelId) ?? null, [modelId]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function selectModel(id) {
    setModelId(id);
    setDiagnosisView("results");
    setFile(null);
    setFileError("");
    setRequest({ status: "idle", result: null, error: "" });
  }

  function chooseFile(candidate) {
    setRequest({ status: "idle", result: null, error: "" });
    setDiagnosisView("results");
    if (!candidate) return;
    if (!candidate.type?.startsWith("image/")) {
      setFile(null);
      setFileError("Choose an image file. The diagnosis service accepts image uploads.");
      return;
    }
    setFileError("");
    setFile(candidate);
  }

  async function runDiagnosis() {
    if (!model || !file || request.status === "loading") return;
    setDiagnosisView("results");
    setRequest({ status: "loading", result: null, error: "" });
    try {
      const result = await diagnoseImage(model.id, file);
      setRequest({ status: "success", result, error: "" });
    } catch (error) {
      setRequest({ status: "error", result: null, error: diagnosisErrorMessage(error) });
    }
  }

  const probabilities = probabilityEntries(request.result?.class_probabilities);
  const confidenceValue = Number(request.result?.confidence);
  const confidenceTone = !Number.isFinite(confidenceValue) ? "" : confidenceValue >= (confidenceValue <= 1 ? 0.7 : 70) ? "is-high" : confidenceValue >= (confidenceValue <= 1 ? 0.45 : 45) ? "is-medium" : "is-low";
  const xai = request.result?.xai;
  const hasGradCamData = request.status === "success" && Boolean(xai?.original_image && xai?.heatmap_image);

  return (
    <>
      <PageHeader title="Diagnosis Board" description="AI-assisted medical image analysis using the diagnosis models available in MedFlow." />

      <Card className="diagnosis-model-selector-card" aria-labelledby="diagnosis-model-heading">
        <div className="diagnosis-section-heading"><h2 id="diagnosis-model-heading">Select a diagnosis model</h2></div>
        <div className="diagnosis-model-grid">
          {diagnosisModels.map((item) => {
            const Icon = item.icon;
            const selected = item.id === modelId;
            return (
              <button className={`surface-card diagnosis-model-card${selected ? " is-selected" : ""}`} type="button" aria-pressed={selected} onClick={() => selectModel(item.id)} key={item.id}>
                <span className="diagnosis-model-icon"><Icon size={20} aria-hidden="true" /></span>
                <strong>{item.name}</strong>
              </button>
            );
          })}
        </div>
      </Card>

      {model ? (
        <div className="diagnosis-workspace-grid">
          {diagnosisView === "gradcam" && hasGradCamData ? (
            <Card className="diagnosis-xai-card">
              <div className="diagnosis-gradcam-header">
                <div className="diagnosis-gradcam-heading">
                  <span className="workflow-section-icon is-indigo"><Sparkles size={18} aria-hidden="true" /></span>
                  <div>
                    <h2>Grad-CAM Visualization</h2>
                    <p>Visual explanation of the image regions that influenced the model's prediction.</p>
                  </div>
                </div>
                <button className="patient-secondary-button" type="button" onClick={() => setDiagnosisView("results")}>Back to Results</button>
              </div>
              <div className="diagnosis-xai-grid">
                <figure>
                  <img src={xai.original_image} alt={`Original image sent to ${model.name} model`} />
                  <figcaption>Original Image</figcaption>
                </figure>
                <figure>
                  <img src={xai.heatmap_image} alt={`${xai.method || "Grad-CAM"} explanation overlay returned by ${model.name} model`} />
                  <figcaption>Grad-CAM Overlay</figcaption>
                </figure>
              </div>
              <section className="diagnosis-gradcam-guide" aria-labelledby="diagnosis-gradcam-guide-heading">
                <h3 id="diagnosis-gradcam-guide-heading">How to interpret this heatmap</h3>
                <div className="diagnosis-gradcam-legend">
                  <div className="diagnosis-gradcam-legend-item">
                    <span className="diagnosis-gradcam-swatch is-warm" aria-hidden="true" />
                    <p><strong>Warm colors (red/yellow):</strong> Regions of higher relative importance to the model's prediction.</p>
                  </div>
                  <div className="diagnosis-gradcam-legend-item">
                    <span className="diagnosis-gradcam-swatch is-cool" aria-hidden="true" />
                    <p><strong>Cool colors (blue):</strong> Regions of lower relative importance.</p>
                  </div>
                </div>
                <p className="diagnosis-gradcam-note">Grad-CAM highlights image regions that influenced the model's prediction. These regions do not independently confirm a disease and should be interpreted alongside the original image and clinical findings.</p>
              </section>
            </Card>
          ) : (
            <>
            <Card className="diagnosis-input-card">
              <div className="workflow-section-heading"><span className="workflow-section-icon is-indigo"><ScanLine size={18} aria-hidden="true" /></span><div><p className="card-eyebrow">{model.name} workspace</p><h2>Image input</h2></div></div>
              <p className="diagnosis-input-description">Select an image for the {model.name.toLowerCase()} model. The backend validates and processes the uploaded image.</p>
              <label className={`diagnosis-dropzone${file ? " has-file" : ""}`}>
                <input className="sr-only" type="file" accept="image/*" onChange={(event) => { chooseFile(event.target.files?.[0]); event.target.value = ""; }} disabled={request.status === "loading"} />
                {previewUrl ? <img className="diagnosis-selected-preview" src={previewUrl} alt={`Selected image for ${model.name} diagnosis`} /> : <span className="diagnosis-drop-icon"><UploadCloud size={22} aria-hidden="true" /></span>}
                <strong>{file?.name || "Choose an image"}</strong>
                <span>{file ? `${new Intl.NumberFormat().format(file.size)} bytes · ${file.type}` : "Select an image file to preview and analyze."}</span>
                <em>Browse images</em>
              </label>
              {fileError ? <div className="patient-form-error" role="alert">{fileError}</div> : null}
              {request.status === "error" ? <div className="patient-form-error" role="alert">{request.error}</div> : null}
              <div className="diagnosis-input-actions">
                <button className="patient-secondary-button" type="button" disabled={!file || request.status === "loading"} onClick={() => { setFile(null); setFileError(""); setRequest({ status: "idle", result: null, error: "" }); setDiagnosisView("results"); }}>Clear image</button>
                <button className="patient-primary-button" type="button" disabled={!file || request.status === "loading"} onClick={runDiagnosis}>
                  {request.status === "loading" ? <span className="patient-spin">◌</span> : <FileImage size={16} aria-hidden="true" />}
                  {request.status === "loading" ? "Analyzing image..." : "Run diagnosis"}
                </button>
              </div>
              {request.status === "loading" ? <FeedbackState type="loading" title="Running the existing diagnosis model..." description="The result and Grad-CAM explanation will appear when the service responds." compact /> : null}
            </Card>

            <Card className="diagnosis-result-card">
              <div className="workflow-section-heading">
                <span className={`workflow-confidence-icon ${confidenceTone}`}><Activity size={18} aria-hidden="true" /></span>
                <div><p className="card-eyebrow">AI-generated result</p><h2>Analysis result</h2></div>
                {hasGradCamData ? (
                  <button className="patient-primary-button diagnosis-gradcam-open" type="button" onClick={() => setDiagnosisView("gradcam")}>
                    View Grad-CAM <ArrowRight size={15} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              {request.status === "success" ? (
                <>
                  <div className="diagnosis-prediction-value"><small>Predicted class</small><strong>{request.result.prediction}</strong></div>
                  <div className="diagnosis-confidence"><span>Confidence</span><b className={confidenceTone}>{percent(request.result.confidence)}</b></div>
                  {probabilities.length ? <div className="workflow-probabilities"><strong>Class probabilities</strong>{probabilities.map(([name, value]) => {
                    const number = Number(value);
                    const width = Number.isFinite(number) ? Math.max(0, Math.min(100, number <= 1 ? number * 100 : number)) : 0;
                    return <span className="workflow-probability-row" key={name}><span>{name}<b>{percent(value)}</b></span><i><em style={{ width: `${width}%` }} /></i></span>;
                  })}</div> : <FeedbackState type="empty" title="No class probabilities were returned." compact />}
                  <div className="diagnosis-clinical-note"><CheckCircle2 size={16} aria-hidden="true" /><span>AI-generated analysis only. A qualified clinician should interpret this result in context.</span></div>
                  {!hasGradCamData ? <FeedbackState type="empty" title="Grad-CAM visualization unavailable." description="This response did not include both the original image and the Grad-CAM overlay." compact /> : null}
                </>
              ) : request.status === "loading" ? <FeedbackState type="loading" title="Waiting for model response..." compact />
                : request.status === "error" ? <FeedbackState type="error" title="Diagnosis request failed." description={request.error} compact />
                  : <FeedbackState type="empty" title="No analysis result yet." description="Choose an image and run the selected model to see its response." compact />}
            </Card>

            </>
          )}
        </div>
      ) : null}
    </>
  );
}
