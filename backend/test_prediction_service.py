from app.ml.inference.prediction_service import predict_department


sample_report = """
Patient presents with chest pain, shortness of breath,
and discomfort radiating to the left arm. ECG shows
abnormal findings suggestive of a cardiac condition.
"""


result = predict_department(sample_report)

print("Prediction Result:")
print("Department:", result["predicted_department"])
print("Confidence:", result["confidence_score"])
print("Confidence Level:", result["confidence_level"])

print("\nClass Probabilities:")
for department, probability in result["class_probabilities"].items():
    print(f"{department}: {probability:.4f}")