import torch
import torch.nn as nn
import numpy as np

from pathlib import Path
from PIL import Image

from torchvision import transforms
from torchvision.models import resnet50, ResNet50_Weights

from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from pytorch_grad_cam.utils.image import show_cam_on_image


# ============================================================
# PATH
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[3]

MODEL_PATH = (
    BASE_DIR
    / "app"
    / "ml"
    / "models"
    / "lung_cancer"
    / "lung_cancer_detection_model.pth"
)


# ============================================================
# DEVICE
# ============================================================

device = torch.device(
    "cuda:0" if torch.cuda.is_available() else "cpu"
)


# ============================================================
# MODEL ARCHITECTURE
# ============================================================

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


# ============================================================
# LOAD MODEL
# ============================================================

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


# ============================================================
# PREPROCESSING
# ============================================================

transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


# ============================================================
# CLASSES
# ============================================================

CLASSES = [
    "Adenocarcinoma",
    "Large Cell Carcinoma",
    "Normal",
    "Squamous Cell Carcinoma"
]


# ============================================================
# GRAD-CAM
# ============================================================

def generate_lung_cancer_gradcam(
    image: Image.Image,
    predicted_class: int
):

    # Ensure RGB
    image = image.convert("RGB")

    # ----------------------------------------
    # Prepare visualization image
    # ----------------------------------------

    visualization_image = image.resize(
        (256, 256)
    )

    # Match the model's CenterCrop(224)
    left = (256 - 224) // 2
    top = (256 - 224) // 2

    visualization_image = visualization_image.crop(
        (
            left,
            top,
            left + 224,
            top + 224
        )
    )

    rgb_image = (
        np.array(
            visualization_image
        ).astype(np.float32)
        / 255.0
    )

    # ----------------------------------------
    # Prepare model input
    # ----------------------------------------

    input_tensor = transform(image)

    input_tensor = input_tensor.unsqueeze(0)

    input_tensor = input_tensor.to(device)

    # ----------------------------------------
    # Target layer
    # ----------------------------------------

    target_layers = [
        model.resnet.layer4[-1]
    ]

    # ----------------------------------------
    # Target class
    # ----------------------------------------

    targets = [
        ClassifierOutputTarget(
            predicted_class
        )
    ]

    # ----------------------------------------
    # Generate Grad-CAM
    # ----------------------------------------

    with GradCAM(
        model=model,
        target_layers=target_layers
    ) as cam:

        grayscale_cam = cam(
            input_tensor=input_tensor,
            targets=targets
        )[0]

    # ----------------------------------------
    # Overlay heatmap
    # ----------------------------------------

    visualization = show_cam_on_image(
        rgb_image,
        grayscale_cam,
        use_rgb=True
    )

    return Image.fromarray(
        visualization
    )