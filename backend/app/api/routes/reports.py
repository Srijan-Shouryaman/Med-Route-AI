from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.auth.dependencies import get_current_user
from app.schemas.report import ReportResponse
from app.services.report.report_service import save_uploaded_file


router = APIRouter(
    prefix="/api/reports",
    tags=["Reports"]
)


@router.post(
    "/upload",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED
)
async def upload_report(
    patient_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    patient = db.execute(
        text("""
            SELECT patient_id
            FROM patients
            WHERE patient_id = :patient_id
        """),
        {"patient_id": patient_id}
    ).mappings().fetchone()

    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )

    file_data = await save_uploaded_file(file)

    # Store report metadata
    result = db.execute(
        text("""
            INSERT INTO reports (
                patient_id,
                original_filename,
                stored_filename,
                file_path,
                content_type,
                file_size,
                sha256_hash,
                uploaded_by
            )
            VALUES (
                :patient_id,
                :original_filename,
                :stored_filename,
                :file_path,
                :content_type,
                :file_size,
                :sha256_hash,
                :uploaded_by
            )
            RETURNING
                report_id,
                patient_id,
                original_filename,
                stored_filename,
                file_path,
                content_type,
                file_size,
                sha256_hash,
                extracted_text,
                extraction_status,
                extraction_error,
                uploaded_by,
                uploaded_at
        """),
        {
            "patient_id": patient_id,
            "original_filename": file_data["original_filename"],
            "stored_filename": file_data["stored_filename"],
            "file_path": file_data["file_path"],
            "content_type": file_data["content_type"],
            "file_size": file_data["file_size"],
            "sha256_hash": file_data["sha256_hash"],
            "uploaded_by": current_user["user_id"],
        }
    )

    report = result.mappings().fetchone()

    db.commit()

    return report