from pathlib import Path
import joblib

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "app" / "ml" / "models" / "medflow_svm_calibrated_model.pkl"

# Load model
model = joblib.load(MODEL_PATH)

print("Model loaded successfully!")
print("Model type:", type(model))

sample_report = """
Patient presents with chest pain, shortness of breath,
and discomfort radiating to the left arm. ECG shows
abnormal findings suggestive of a cardiac condition.
"""

prediction = model.predict([sample_report])
probabilities = model.predict_proba([sample_report])

print("Prediction:", prediction)
print("Probabilities:", probabilities)

print("Classes:", model.classes_)

confidence = probabilities.max()
print("Confidence:", confidence)

predicted_index = probabilities.argmax()
print("Predicted class:", model.classes_[predicted_index])