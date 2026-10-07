import base64
from io import BytesIO

from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image

from app.ml.inference.brain_stroke_ct_service import (
    predict_brain_stroke
)

from app.ml.inference.lung_cancer_service import (
    predict_lung_cancer
)

from app.ml.xai.brain_stroke_gradcam import (
    generate_brain_stroke_gradcam
)

from app.ml.xai.lung_cancer_gradcam import (
    generate_lung_cancer_gradcam
)


router = APIRouter(
    prefix="/api/diagnosis",
    tags=["Diagnosis"]
)


# ============================================================
# IMAGE → BASE64 DATA URL
# ============================================================

def bytes_to_data_url(
    image_bytes: bytes,
    content_type: str
):
    encoded = base64.b64encode(
        image_bytes
    ).decode("utf-8")

    return f"data:{content_type};base64,{encoded}"


def pil_image_to_data_url(image: Image.Image):
    buffer = BytesIO()

    image.save(
        buffer,
        format="PNG"
    )

    encoded = base64.b64encode(
        buffer.getvalue()
    ).decode("utf-8")

    return f"data:image/png;base64,{encoded}"


# ============================================================
# BRAIN STROKE
# ============================================================

@router.post("/brain-stroke")
async def brain_stroke_diagnosis(
    file: UploadFile = File(...)
):
    try:

        # ----------------------------------------------------
        # Validate file type
        # ----------------------------------------------------

        if (
            not file.content_type
            or not file.content_type.startswith("image/")
        ):
            raise HTTPException(
                status_code=400,
                detail="Only image files are allowed."
            )


        # ----------------------------------------------------
        # Read uploaded image
        # ----------------------------------------------------

        image_bytes = await file.read()

        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="Uploaded image is empty."
            )


        # ----------------------------------------------------
        # Open image
        # ----------------------------------------------------

        try:

            image = Image.open(
                BytesIO(image_bytes)
            )

            image.load()

        except Exception:

            raise HTTPException(
                status_code=400,
                detail="Invalid image file."
            )


        # ----------------------------------------------------
        # Prediction
        # ----------------------------------------------------

        result = predict_brain_stroke(
            image
        )


        # ----------------------------------------------------
        # Determine predicted class
        #
        # 0 = Control
        # 1 = Stroke
        # ----------------------------------------------------

        if result["prediction"] == "Stroke":
            predicted_class = 1
        else:
            predicted_class = 0


        # ----------------------------------------------------
        # Generate Grad-CAM
        # ----------------------------------------------------

        heatmap = generate_brain_stroke_gradcam(
            image,
            predicted_class
        )


        # ----------------------------------------------------
        # Convert images to Base64
        # ----------------------------------------------------

        original_image = bytes_to_data_url(
            image_bytes,
            file.content_type
        )

        heatmap_image = pil_image_to_data_url(
            heatmap
        )


        # ----------------------------------------------------
        # Response
        # ----------------------------------------------------

        return {
            "prediction": result["prediction"],
            "confidence": result["confidence"],
            "class_probabilities": result[
                "class_probabilities"
            ],
            "xai": {
                "method": "Grad-CAM",
                "original_image": original_image,
                "heatmap_image": heatmap_image
            }
        }


    except HTTPException:
        raise


    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Brain stroke prediction failed: "
                f"{str(e)}"
            )
        )


# ============================================================
# LUNG CANCER
# ============================================================

@router.post("/lung-cancer")
async def lung_cancer_diagnosis(
    file: UploadFile = File(...)
):
    try:

        # ----------------------------------------------------
        # Validate file type
        # ----------------------------------------------------

        if (
            not file.content_type
            or not file.content_type.startswith("image/")
        ):
            raise HTTPException(
                status_code=400,
                detail="Only image files are allowed."
            )


        # ----------------------------------------------------
        # Read uploaded image
        # ----------------------------------------------------

        image_bytes = await file.read()

        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="Uploaded image is empty."
            )


        # ----------------------------------------------------
        # Open image
        # ----------------------------------------------------

        try:

            image = Image.open(
                BytesIO(image_bytes)
            )

            image.load()

        except Exception:

            raise HTTPException(
                status_code=400,
                detail="Invalid image file."
            )


        # ----------------------------------------------------
        # Prediction
        # ----------------------------------------------------

        result = predict_lung_cancer(
            image
        )


        # ----------------------------------------------------
        # Lung cancer class order
        # ----------------------------------------------------

        class_names = [
            "Adenocarcinoma",
            "Large Cell Carcinoma",
            "Normal",
            "Squamous Cell Carcinoma"
        ]


        # ----------------------------------------------------
        # Determine predicted class
        # ----------------------------------------------------

        predicted_class = class_names.index(
            result["prediction"]
        )


        # ----------------------------------------------------
        # Generate Grad-CAM
        # ----------------------------------------------------

        heatmap = generate_lung_cancer_gradcam(
            image,
            predicted_class
        )


        # ----------------------------------------------------
        # Convert images to Base64
        # ----------------------------------------------------

        original_image = bytes_to_data_url(
            image_bytes,
            file.content_type
        )

        heatmap_image = pil_image_to_data_url(
            heatmap
        )


        # ----------------------------------------------------
        # Response
        # ----------------------------------------------------

        return {
            "prediction": result["prediction"],
            "confidence": result["confidence"],
            "class_probabilities": result[
                "class_probabilities"
            ],
            "xai": {
                "method": "Grad-CAM",
                "original_image": original_image,
                "heatmap_image": heatmap_image
            }
        }


    except HTTPException:
        raise


    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Lung cancer prediction failed: "
                f"{str(e)}"
            )
        )