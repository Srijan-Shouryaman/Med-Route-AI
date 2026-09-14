from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import get_db


router = APIRouter(
    prefix="/api/team-performance",
    tags=["Team Performance"]
)


@router.get("/")
def get_team_performance(db: Session = Depends(get_db)):

    result = db.execute(
        text("""
            SELECT
                tp.performance_id,
                tp.team_id,
                ct.team_name,
                tp.total_cases_handled,
                tp.successful_cases,
                tp.success_rate,
                tp.average_case_resolution_time_hours,
                tp.emergency_cases_handled,
                tp.emergency_success_rate,
                tp.last_updated
            FROM team_performance tp
            JOIN clinical_teams ct
                ON tp.team_id = ct.team_id
            ORDER BY tp.team_id
        """)
    )

    performance = result.mappings().all()

    return performance


@router.get("/{team_id}")
def get_team_performance(
    team_id: str,
    db: Session = Depends(get_db)
):

    result = db.execute(
        text("""
            SELECT
                tp.performance_id,
                tp.team_id,
                ct.team_name,
                tp.total_cases_handled,
                tp.successful_cases,
                tp.success_rate,
                tp.average_case_resolution_time_hours,
                tp.emergency_cases_handled,
                tp.emergency_success_rate
            FROM team_performance tp
            JOIN clinical_teams ct
                ON tp.team_id = ct.team_id
            WHERE tp.team_id = :team_id
        """),
        {
            "team_id": team_id
        }
    )

    performance = result.mappings().fetchone()

    if performance is None:
        raise HTTPException(
            status_code=404,
            detail="Team performance not found"
        )

    return performance