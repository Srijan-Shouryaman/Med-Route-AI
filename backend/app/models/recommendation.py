from sqlalchemy import (
    Column,
    String,
    BigInteger,
    SmallInteger,
    Numeric,
    TIMESTAMP,
    ForeignKey
)
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import Base


class Recommendation(Base):
    __tablename__ = "recommendations"

    recommendation_id = Column(
        String(10),
        primary_key=True
    )

    case_id = Column(
        String(10),
        ForeignKey("cases.case_id"),
        nullable=False
    )

    prediction_id = Column(
        BigInteger,
        ForeignKey("predictions.prediction_id"),
        nullable=True
    )

    rank = Column(
        SmallInteger,
        nullable=False
    )

    team_id = Column(
        String(10),
        ForeignKey("clinical_teams.team_id"),
        nullable=True
    )

    recommendation_score = Column(
        Numeric(5, 2),
        nullable=True
    )

    score_breakdown = Column(
        JSONB,
        nullable=True
    )

    generated_at = Column(
        TIMESTAMP,
        nullable=False
    )