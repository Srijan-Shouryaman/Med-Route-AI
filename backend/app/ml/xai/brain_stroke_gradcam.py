import torch
import torch.nn as nn

from pathlib import Path
from PIL import Image

from torchvision import models, transforms

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
    / "brain_stroke"
    / "best_ct_resnet18.pth"
)


# ============================================================
# DEVICE
# ============================================================

device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)


# ============================================================
# MODEL
# ============================================================

model = models.resnet18(weights=None)

model.fc = nn.Linear(
    model.fc.in_features,
    2
)

checkpoint = torch.load(
    MODEL_PATH,
    map_location=device
)

model.load_state_dict(checkpoint)

model = model.to(device)
model.eval()


# ============================================================
# PREPROCESSING
# ============================================================

transform = transforms.Compose([
    transforms.Grayscale(num_output_channels=3),
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


# ============================================================
# CLASSES
# ============================================================

CLASSES = {
    0: "Control",
    1: "Stroke"
}


# ============================================================
# GRAD-CAM
# ============================================================

def generate_brain_stroke_gradcam(
    image: Image.Image,
    predicted_class: int
):

    image = image.convert("RGB")

    # Image for Grad-CAM visualization
    visualization_image = image.resize(
        (224, 224)
    )

    rgb_image = (
        torch.from_numpy(
            __import__("numpy").array(
                visualization_image
            )
        ).float() / 255.0
    ).numpy()

    # Model input
    input_tensor = transform(image)
    input_tensor = input_tensor.unsqueeze(0)
    input_tensor = input_tensor.to(device)

    # Last convolutional layer of ResNet18
    target_layers = [
        model.layer4[-1]
    ]

    # Target class
    targets = [
        ClassifierOutputTarget(predicted_class)
    ]

    # Generate Grad-CAM
    with GradCAM(
        model=model,
        target_layers=target_layers
    ) as cam:

        grayscale_cam = cam(
            input_tensor=input_tensor,
            targets=targets
        )[0]

    # Overlay heatmap
    visualization = show_cam_on_image(
        rgb_image,
        grayscale_cam,
        use_rgb=True
    )

    return Image.fromarray(visualization)