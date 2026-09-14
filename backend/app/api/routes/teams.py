from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import get_db


router = APIRouter(
    prefix="/api/teams",
    tags=["Clinical Teams"]
)


@router.get("/")
def get_teams(db: Session = Depends(get_db)):

    result = db.execute(
        text("""
            SELECT
                ct.team_id,
                ct.team_name,
                ct.department_id,
                d.department_name,
                ct.specialization,
                ct.experience_years,
                ct.availability,
                ct.active_cases,
                ct.maximum_capacity,
                ct.current_workload_percentage,
                ct.emergency_handling_capability,
                ct.shift,
                ct.status
            FROM clinical_teams ct
            JOIN departments d
                ON ct.department_id = d.department_id
            ORDER BY ct.team_id
        """)
    )

    teams = result.mappings().all()

    return teams


@router.get("/{team_id}")
def get_team(
    team_id: str,
    db: Session = Depends(get_db)
):
    result = db.execute(
        text("""
            SELECT
                ct.team_id,
                ct.team_name,
                ct.department_id,
                d.department_name,
                ct.specialization,
                ct.experience_years,
                ct.availability,
                ct.active_cases,
                ct.maximum_capacity,
                ct.current_workload_percentage,
                ct.emergency_handling_capability,
                ct.shift,
                ct.status
            FROM clinical_teams ct
            JOIN departments d
                ON ct.department_id = d.department_id
            WHERE ct.team_id = :team_id
        """),
        {
            "team_id": team_id
        }
    )

    team = result.mappings().fetchone()

    if team is None:
        raise HTTPException(status_code=404, detail="Clinical team not found")

    return team