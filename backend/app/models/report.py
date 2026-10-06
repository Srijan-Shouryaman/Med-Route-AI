from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    BigInteger,
    TIMESTAMP,
    ForeignKey,
)
from app.core.database import Base


class Report(Base):
    __tablename__ = "reports"

    report_id = Column(Integer, primary_key=True)

    patient_id = Column(
        Integer,
        ForeignKey("patients.patient_id"),
        nullable=False
    )

    original_filename = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)

    content_type = Column(String(100), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    sha256_hash = Column(String(64), nullable=False)

    extracted_text = Column(Text, nullable=True)
    extraction_status = Column(
        String(30),
        nullable=False,
        default="PENDING"
    )
    extraction_error = Column(Text, nullable=True)

    uploaded_by = Column(
        Integer,
        ForeignKey("users.user_id"),
        nullable=False
    )

    uploaded_at = Column(TIMESTAMP, nullable=False)