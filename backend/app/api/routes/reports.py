from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.auth.dependencies import get_current_user
from app.schemas.report import ReportResponse
from app.services.report.report_service import (
    save_uploaded_file,
    extract_report_text,
)


router = APIRouter(
    prefix="/api/reports",
    tags=["Reports"]
)


@router.post(
    "/upload",
    response_model=ReportResponse,
    status_code=201
)
async def upload_report(
    patient_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # 1. Verify patient exists.
    patient = db.execute(
        text("""
            SELECT patient_id
            FROM patients
            WHERE patient_id = :patient_id
        """),
        {
            "patient_id": patient_id
        }
    ).mappings().fetchone()

    if patient is None:
        raise HTTPException(
            status_code=404,
            detail="Patient not found"
        )

    # 2. Store original uploaded file.
    file_data = await save_uploaded_file(file)

    # 3. Create report record first.
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
                extracted_text,
                extraction_status,
                extraction_error,
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
                NULL,
                'PENDING',
                NULL,
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

    try:
        extracted_text = extract_report_text(
            file_data["file_path"]
        )

        if not extracted_text:
            raise ValueError(
                "OCR completed but no text was extracted"
            )

        # 5. Save OCR result.
        result = db.execute(
            text("""
                UPDATE reports
                SET
                    extracted_text = :extracted_text,
                    extraction_status = 'EXTRACTED',
                    extraction_error = NULL
                WHERE report_id = :report_id
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
                "extracted_text": extracted_text,
                "report_id": report["report_id"],
            }
        )

        report = result.mappings().fetchone()
        db.commit()

    except Exception as exc:

        db.rollback()

        result = db.execute(
            text("""
                UPDATE reports
                SET
                    extraction_status = 'FAILED',
                    extraction_error = :extraction_error
                WHERE report_id = :report_id
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
                "extraction_error": str(exc),
                "report_id": report["report_id"],
            }
        )

        report = result.mappings().fetchone()
        db.commit()

    return report