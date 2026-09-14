from sqlalchemy import (
    Column,
    BigInteger,
    String,
    SmallInteger,
    Numeric,
    TIMESTAMP,
    ForeignKey
)
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import Base


class Prediction(Base):
    __tablename__ = "predictions"

    prediction_id = Column(
        BigInteger,
        primary_key=True
    )

    case_id = Column(
        String(10),
        ForeignKey("cases.case_id"),
        nullable=False
    )

    predicted_department_id = Column(
        SmallInteger,
        ForeignKey("departments.department_id"),
        nullable=False
    )

    decision_function_scores = Column(
        JSONB,
        nullable=True
    )

    confidence_score = Column(
        Numeric(5, 4),
        nullable=False
    )

    confidence_level_label = Column(
        String(6),
        nullable=False
    )

    model_version = Column(
        String(50),
        nullable=False
    )

    predicted_at = Column(
        TIMESTAMP,
        nullable=False
    )