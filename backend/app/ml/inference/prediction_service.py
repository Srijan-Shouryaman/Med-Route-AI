from app.ml.inference.model_loader import model


def predict_department(report_text: str):
    prediction = model.predict([report_text])[0]

    probabilities = model.predict_proba([report_text])[0]

    predicted_index = probabilities.argmax()
    confidence = float(probabilities[predicted_index])

    if confidence >= 0.80:
        confidence_level = "High"
    elif confidence >= 0.60:
        confidence_level = "Medium"
    else:
        confidence_level = "Low"

    class_probabilities = {
        class_name: float(probability)
        for class_name, probability in zip(model.classes_, probabilities)
    }

    return {
        "predicted_department": prediction,
        "confidence_score": confidence,
        "confidence_level": confidence_level,
        "class_probabilities": class_probabilities
    }