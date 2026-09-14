from sqlalchemy import (
    Column,
    String,
    Integer,
    Numeric,
    Date,
    ForeignKey
)

from app.core.database import Base


class TeamPerformance(Base):
    __tablename__ = "team_performance"

    performance_id = Column(
        String(10),
        primary_key=True
    )

    team_id = Column(
        String(10),
        ForeignKey("clinical_teams.team_id"),
        nullable=False
    )

    total_cases_handled = Column(
        Integer,
        nullable=False
    )

    successful_cases = Column(
        Integer,
        nullable=False
    )

    success_rate = Column(
        Numeric(5, 2),
        nullable=True
    )

    average_case_resolution_time_hours = Column(
        Numeric(6, 1),
        nullable=False
    )

    emergency_cases_handled = Column(
        Integer,
        nullable=False
    )

    emergency_success_rate = Column(
        Numeric(5, 2),
        nullable=True
    )

    last_updated = Column(
        Date,
        nullable=False
    )