from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    TIMESTAMP
)

from app.core.database import Base


class Case(Base):
    __tablename__ = "cases"

    case_id = Column(
        String(10),
        primary_key=True
    )

    patient_ref_id = Column(
        String(30),
        nullable=False
    )

    report_summary = Column(
        Text,
        nullable=False
    )

    is_emergency = Column(
        Boolean,
        nullable=False
    )

    priority = Column(
        String(9),
        nullable=False
    )

    submitted_at = Column(
        TIMESTAMP,
        nullable=False
    )

    status = Column(
        String(30),
        nullable=False
    )