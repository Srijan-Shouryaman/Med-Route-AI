from sqlalchemy import Column, SmallInteger, String, Text, TIMESTAMP

from app.core.database import Base


class Department(Base):
    __tablename__ = "departments"

    department_id = Column(
        SmallInteger,
        primary_key=True
    )

    department_name = Column(
        String(100),
        nullable=False
    )

    description = Column(
        Text,
        nullable=True
    )

    created_at = Column(
        TIMESTAMP,
        nullable=False
    )