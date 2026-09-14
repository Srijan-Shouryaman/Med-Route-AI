from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.prediction import PredictionRequest

from app.api.dependencies import get_db


router = APIRouter(
    prefix="/api/predictions",
    tags=["Predictions"]
)


@router.get("/")
def get_predictions(db: Session = Depends(get_db)):

    result = db.execute(
        text("""
            SELECT
                p.prediction_id,
                p.case_id,
                p.predicted_department_id,
                d.department_name,
                p.decision_function_scores,
                p.confidence_score,
                p.confidence_level_label,
                p.model_version
            FROM predictions p
            JOIN departments d
                ON p.predicted_department_id = d.department_id
            ORDER BY p.prediction_id DESC
        """)
    )

    predictions = result.mappings().all()

    return predictions


@router.get("/{prediction_id}")
def get_prediction(
    prediction_id: int,
    db: Session = Depends(get_db)
):

    result = db.execute(
        text("""
            SELECT
                p.prediction_id,
                p.case_id,
                p.predicted_department_id,
                d.department_name,
                p.decision_function_scores,
                p.confidence_score,
                p.confidence_level_label,
                p.model_version
            FROM predictions p
            JOIN departments d
                ON p.predicted_department_id = d.department_id
            WHERE p.prediction_id = :prediction_id
        """),
        {
            "prediction_id": prediction_id
        }
    )

    prediction = result.mappings().fetchone()

    if prediction is None:
        raise HTTPException(
            status_code=404,
            detail="Prediction not found"
        )

    return prediction