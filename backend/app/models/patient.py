from sqlalchemy import Column, Integer, String, Date, Text, TIMESTAMP
from app.core.database import Base


class Patient(Base):
    __tablename__ = "patients"

    patient_id = Column(Integer, primary_key=True)
    patient_ref_id = Column(String(30), nullable=False, unique=True)
    full_name = Column(String(150), nullable=False)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(150), nullable=True)
    address = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, nullable=False)
    updated_at = Column(TIMESTAMP, nullable=False)