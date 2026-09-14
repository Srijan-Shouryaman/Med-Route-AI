from pathlib import Path
import joblib


BASE_DIR = Path(__file__).resolve().parents[3]

MODEL_PATH = (
    BASE_DIR
    / "app"
    / "ml"
    / "models"
    / "medflow_svm_calibrated_model.pkl"
)


model = joblib.load(MODEL_PATH)