from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import get_db


router = APIRouter(
    prefix="/api/departments",
    tags=["Departments"]
)


@router.get("/")
def get_departments(db: Session = Depends(get_db)):

    result = db.execute(
        text("""
            SELECT
                department_id,
                department_name,
                description
            FROM departments
            ORDER BY department_id
        """)
    )

    departments = result.mappings().all()

    return departments

@router.get("/{department_id}")
def get_department(
    department_id: int,
    db: Session = Depends(get_db)
):
    result = db.execute(
        text("""
            SELECT
                department_id,
                department_name,
                description
            FROM departments
            WHERE department_id = :department_id
        """),
        {
            "department_id": department_id
        }
    )

    department = result.mappings().fetchone()

    if department is None:
        raise HTTPException(status_code=404, detail="Department team not found")

    return department