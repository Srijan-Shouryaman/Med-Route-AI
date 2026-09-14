from sqlalchemy import (
    Column,
    String,
    SmallInteger,
    Integer,
    Boolean,
    Numeric,
    TIMESTAMP,
    ForeignKey
)

from app.core.database import Base


class ClinicalTeam(Base):
    __tablename__ = "clinical_teams"

    team_id = Column(
        String(10),
        primary_key=True
    )

    team_name = Column(
        String(150),
        nullable=False
    )

    department_id = Column(
        SmallInteger,
        ForeignKey("departments.department_id"),
        nullable=False
    )

    specialization = Column(
        String(150),
        nullable=False
    )

    experience_years = Column(
        SmallInteger,
        nullable=False
    )

    availability = Column(
        String(11),
        nullable=False
    )

    active_cases = Column(
        Integer,
        nullable=False
    )

    maximum_capacity = Column(
        Integer,
        nullable=False
    )

    current_workload_percentage = Column(
        Numeric(5, 2),
        nullable=True
    )

    emergency_handling_capability = Column(
        Boolean,
        nullable=False
    )

    shift = Column(
        String(8),
        nullable=False
    )

    status = Column(
        String(8),
        nullable=False
    )

    created_at = Column(
        TIMESTAMP,
        nullable=False
    )

    updated_at = Column(
        TIMESTAMP,
        nullable=False
    )