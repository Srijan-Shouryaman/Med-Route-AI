import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
from pathlib import Path


# --------------------------------------------------
# 1. Paths
# --------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = (
    BASE_DIR
    / "app"
    / "ml"
    / "models"
    / "brain_stroke"
    / "best_ct_resnet18.pth"
)

IMAGE_PATH = BASE_DIR / "test_ct.jpg"


# --------------------------------------------------
# 2. Device
# --------------------------------------------------

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print("Device:", device)


# --------------------------------------------------
# 3. Create ResNet18
# --------------------------------------------------

model = models.resnet18(weights=None)

model.fc = nn.Linear(
    model.fc.in_features,
    2
)


# --------------------------------------------------
# 4. Load checkpoint
# --------------------------------------------------

checkpoint = torch.load(
    MODEL_PATH,
    map_location=device
)

model.load_state_dict(checkpoint)

model = model.to(device)
model.eval()

print("Model loaded successfully")


# --------------------------------------------------
# 5. Preprocessing
# --------------------------------------------------

transform = transforms.Compose([
    transforms.Grayscale(num_output_channels=3),
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


# --------------------------------------------------
# 6. Load CT image
# --------------------------------------------------

image = Image.open(IMAGE_PATH)

print("Original image mode:", image.mode)
print("Original image size:", image.size)


image_tensor = transform(image)

image_tensor = image_tensor.unsqueeze(0)

image_tensor = image_tensor.to(device)


# --------------------------------------------------
# 7. Prediction
# --------------------------------------------------

with torch.no_grad():

    outputs = model(image_tensor)

    probabilities = torch.softmax(
        outputs,
        dim=1
    )

    predicted_class = torch.argmax(
        probabilities,
        dim=1
    ).item()

    confidence = probabilities[
        0,
        predicted_class
    ].item()


# --------------------------------------------------
# 8. Result
# --------------------------------------------------

classes = {
    0: "Control",
    1: "Stroke"
}

print()
print("========== BRAIN STROKE RESULT ==========")

print(
    "Prediction:",
    classes[predicted_class]
)

print(
    "Confidence:",
    f"{confidence * 100:.2f}%"
)

print()
print("Class probabilities:")

print(
    "Control:",
    f"{probabilities[0][0].item() * 100:.2f}%"
)

print(
    "Stroke:",
    f"{probabilities[0][1].item() * 100:.2f}%"
)

print("==========================================")