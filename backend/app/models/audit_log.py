from sqlalchemy import (
    Column,
    BigInteger,
    String,
    TIMESTAMP,
    ForeignKey
)
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    audit_id = Column(
        BigInteger,
        primary_key=True
    )

    case_id = Column(
        String(10),
        ForeignKey("cases.case_id"),
        nullable=True
    )

    event_type = Column(
        String(60),
        nullable=False
    )

    actor = Column(
        String(150),
        nullable=True
    )

    details = Column(
        JSONB,
        nullable=True
    )

    created_at = Column(
        TIMESTAMP,
        nullable=False
    )