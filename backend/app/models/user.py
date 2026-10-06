from sqlalchemy import (
    Column,
    Integer,
    SmallInteger,
    String,
    Boolean,
    TIMESTAMP,
    ForeignKey,
)

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(
        Integer,
        primary_key=True
    )

    email = Column(
        String(150),
        nullable=False,
        unique=True
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    full_name = Column(
        String(150),
        nullable=False
    )

    role = Column(
        String(30),
        nullable=False
    )

    department_id = Column(
        SmallInteger,
        ForeignKey("departments.department_id"),
        nullable=True
    )

    is_active = Column(
        Boolean,
        nullable=False,
        default=True
    )

    created_at = Column(
        TIMESTAMP,
        nullable=False
    )

    updated_at = Column(
        TIMESTAMP,
        nullable=False
    )