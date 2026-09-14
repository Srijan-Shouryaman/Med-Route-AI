from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import get_db


router = APIRouter(
    prefix="/api/recommendations",
    tags=["Recommendations"]
)


@router.get("/")
def get_recommendations(db: Session = Depends(get_db)):

    result = db.execute(
        text("""
            SELECT
                r.recommendation_id,
                r.case_id,
                r.prediction_id,
                r.rank,
                r.team_id,
                ct.team_name,
                ct.specialization,
                r.recommendation_score,
                r.score_breakdown
            FROM recommendations r
            LEFT JOIN clinical_teams ct
                ON r.team_id = ct.team_id
            ORDER BY r.case_id, r.rank
        """)
    )

    recommendations = result.mappings().all()

    return recommendations


@router.get("/{case_id}")
def get_case_recommendations(
    case_id: str,
    db: Session = Depends(get_db)
):

    result = db.execute(
        text("""
            SELECT
                r.recommendation_id,
                r.case_id,
                r.prediction_id,
                r.rank,
                r.team_id,
                ct.team_name,
                ct.specialization,
                r.recommendation_score,
                r.score_breakdown
            FROM recommendations r
            LEFT JOIN clinical_teams ct
                ON r.team_id = ct.team_id
            WHERE r.case_id = :case_id
            ORDER BY r.rank
        """),
        {
            "case_id": case_id
        }
    )

    recommendations = result.mappings().all()

    if not recommendations:
        raise HTTPException(
            status_code=404,
            detail="Recommendations not found for this case"
        )

    return recommendations