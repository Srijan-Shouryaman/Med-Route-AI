from pathlib import Path
from hashlib import sha256
import uuid

from fastapi import UploadFile
from app.services.report.ocr_service import (
    extract_text_from_pdf,
    prepare_ml_text
)


BASE_DIR = Path(__file__).resolve().parents[3]
UPLOAD_DIR = BASE_DIR / "storage" / "reports"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def calculate_sha256(file_path: Path) -> str:
    hash_sha256 = sha256()

    with file_path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            hash_sha256.update(chunk)

    return hash_sha256.hexdigest()


async def save_uploaded_file(file: UploadFile):
    original_filename = file.filename or "unknown"

    file_extension = Path(original_filename).suffix.lower()

    stored_filename = f"{uuid.uuid4().hex}{file_extension}"

    file_path = UPLOAD_DIR / stored_filename

    file_size = 0

    with file_path.open("wb") as output_file:
        while True:
            chunk = await file.read(1024 * 1024)

            if not chunk:
                break

            output_file.write(chunk)
            file_size += len(chunk)

    sha256_hash = calculate_sha256(file_path)

    return {
        "original_filename": original_filename,
        "stored_filename": stored_filename,
        "file_path": str(file_path),
        "content_type": file.content_type or "application/octet-stream",
        "file_size": file_size,
        "sha256_hash": sha256_hash,
    }


def extract_report_text(file_path: str) -> dict:
    extracted_text = extract_text_from_pdf(file_path)

    ml_text = prepare_ml_text(extracted_text)

    return {
        "extracted_text": extracted_text,
        "ml_text": ml_text
    }