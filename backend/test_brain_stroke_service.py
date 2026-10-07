from pathlib import Path
from PIL import Image

from app.ml.inference.brain_stroke_ct_service import (
    predict_brain_stroke
)


BASE_DIR = Path(__file__).resolve().parent

IMAGE_PATH = BASE_DIR / "test_ct.jpg"


image = Image.open(IMAGE_PATH)

print("Image loaded:")
print("Mode:", image.mode)
print("Size:", image.size)

result = predict_brain_stroke(image)

print()
print("========== SERVICE RESULT ==========")
print("Prediction:", result["prediction"])
print(
    "Confidence:",
    f"{result['confidence'] * 100:.2f}%"
)

print()
print("Class probabilities:")

for label, probability in result[
    "class_probabilities"
].items():
    print(
        f"{label}: "
        f"{probability * 100:.2f}%"
    )

print("====================================")