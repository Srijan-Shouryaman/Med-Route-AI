from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, EmailStr


class PatientCreate(BaseModel):
    patient_ref_id: str
    full_name: str
    date_of_birth: date | None = None
    gender: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None


class PatientUpdate(BaseModel):
    full_name: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None


class PatientResponse(BaseModel):
    patient_id: int
    patient_ref_id: str
    full_name: str
    date_of_birth: date | None
    gender: str | None
    phone: str | None
    email: EmailStr | None
    address: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)