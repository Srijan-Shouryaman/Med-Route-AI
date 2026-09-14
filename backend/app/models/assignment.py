from sqlalchemy import (
    Column,
    BigInteger,
    String,
    Numeric,
    Text,
    TIMESTAMP,
    ForeignKey
)

from app.core.database import Base


class Assignment(Base):
    __tablename__ = "assignments"

    assignment_id = Column(
        BigInteger,
        primary_key=True
    )

    case_id = Column(
        String(10),
        ForeignKey("cases.case_id"),
        nullable=False
    )

    ai_recommended_team_id = Column(
        String(10),
        ForeignKey("clinical_teams.team_id"),
        nullable=True
    )

    ai_recommendation_score = Column(
        Numeric(5, 2),
        nullable=True
    )

    final_assigned_team_id = Column(
        String(10),
        ForeignKey("clinical_teams.team_id"),
        nullable=True
    )

    human_decision = Column(
        String(29),
        nullable=False
    )

    override_reason = Column(
        Text,
        nullable=True
    )

    approving_user = Column(
        String(150),
        nullable=False
    )

    decided_at = Column(
        TIMESTAMP,
        nullable=False
    )