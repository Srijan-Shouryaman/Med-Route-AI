from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import get_db


router = APIRouter(
    prefix="/api/assignments",
    tags=["Assignments"]
)


@router.get("/")
def get_assignments(db: Session = Depends(get_db)):
    result = db.execute(text("""
        SELECT
            a.assignment_id,
            a.case_id,
            a.ai_recommended_team_id,
            ai_team.team_name AS ai_recommended_team_name,
            a.ai_recommendation_score,
            a.final_assigned_team_id,
            final_team.team_name AS final_assigned_team_name,
            a.human_decision,
            a.override_reason,
            a.approving_user
        FROM assignments a
        LEFT JOIN clinical_teams ai_team
            ON a.ai_recommended_team_id = ai_team.team_id
        LEFT JOIN clinical_teams final_team
            ON a.final_assigned_team_id = final_team.team_id
        ORDER BY a.assignment_id
    """))

    assignments = result.mappings().all()

    return assignments


@router.get("/{assignment_id}")
def get_assignment(
    assignment_id: int,
    db: Session = Depends(get_db)
):
    result = db.execute(text("""
        SELECT
            a.assignment_id,
            a.case_id,
            a.ai_recommended_team_id,
            ai_team.team_name AS ai_recommended_team_name,
            a.ai_recommendation_score,
            a.final_assigned_team_id,
            final_team.team_name AS final_assigned_team_name,
            a.human_decision,
            a.override_reason,
            a.approving_user
        FROM assignments a
        LEFT JOIN clinical_teams ai_team
            ON a.ai_recommended_team_id = ai_team.team_id
        LEFT JOIN clinical_teams final_team
            ON a.final_assigned_team_id = final_team.team_id
        WHERE a.assignment_id = :assignment_id
    """), {
        "assignment_id": assignment_id
    })

    assignment = result.mappings().fetchone()

    if assignment is None:
        raise HTTPException(
            status_code=404,
            detail="Assignment not found"
        )

    return assignment