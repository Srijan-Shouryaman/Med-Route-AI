import torch
import torch.nn as nn
from torchvision import transforms
from torchvision.models import resnet50, ResNet50_Weights
from PIL import Image
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[3]

MODEL_PATH = (
    BASE_DIR
    / "app"
    / "ml"
    / "models"
    / "lung_cancer"
    / "lung_cancer_detection_model.pth"
)



device = torch.device(
    "cuda:0" if torch.cuda.is_available() else "cpu"
)


class ResNetLungCancer(nn.Module):

    def __init__(self, num_classes=4):

        super(ResNetLungCancer, self).__init__()

        self.resnet = resnet50(
            weights=ResNet50_Weights.IMAGENET1K_V1
        )

        num_ftrs = self.resnet.fc.in_features

        self.resnet.fc = nn.Identity()

        self.fc = nn.Sequential(
            nn.Linear(num_ftrs, 256),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(256, num_classes)
        )

    def forward(self, x):

        x = self.resnet(x)

        return self.fc(x)


if not MODEL_PATH.exists():
    raise FileNotFoundError(
        f"Lung cancer model not found: {MODEL_PATH}"
    )


model = ResNetLungCancer(num_classes=4)

state_dict = torch.load(
    MODEL_PATH,
    map_location=device
)

model.load_state_dict(state_dict)

model = model.to(device)
model.eval()


transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


CLASSES = [
    "Adenocarcinoma",
    "Large Cell Carcinoma",
    "Normal",
    "Squamous Cell Carcinoma"
]

def predict_lung_cancer(image: Image.Image):

    image = image.convert("RGB")

    image_tensor = transform(image)

    image_tensor = image_tensor.unsqueeze(0)

    image_tensor = image_tensor.to(device)

    with torch.no_grad():

        output = model(image_tensor)

        probabilities = torch.softmax(
            output,
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

    class_probabilities = {
        CLASSES[index]: float(
            probabilities[0][index].item()
        )
        for index in range(len(CLASSES))
    }

    return {
        "prediction": CLASSES[predicted_class],
        "confidence": float(confidence),
        "class_probabilities": class_probabilities
    }