from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.auth.dependencies import get_current_user
from app.schemas.patient import (
    PatientCreate,
    PatientResponse,
    PatientUpdate,
)
from app.services.patient.patient_service import (
    create_patient,
    get_patient,
    get_patient_by_ref_id,
    list_patients,
    update_patient,
)


router = APIRouter(
    prefix="/api/patients",
    tags=["Patients"]
)


@router.post(
    "",
    response_model=PatientResponse,
    status_code=status.HTTP_201_CREATED
)
def create_patient_endpoint(
    patient_data: PatientCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    try:
        patient = create_patient(patient_data, db)
        db.commit()

        return patient

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Patient reference ID already exists"
        )


@router.get(
    "",
    response_model=list[PatientResponse]
)
def list_patients_endpoint(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return list_patients(db)


@router.get(
    "/{patient_id}",
    response_model=PatientResponse
)
def get_patient_endpoint(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user) 
):
    patient = get_patient(patient_id, db)

    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )

    return patient


@router.get(
    "/ref/{patient_ref_id}",
    response_model=PatientResponse
)
def get_patient_by_ref_endpoint(
    patient_ref_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    patient = get_patient_by_ref_id(patient_ref_id, db)

    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )

    return patient


@router.put(
    "/{patient_id}",
    response_model=PatientResponse
)
def update_patient_endpoint(
    patient_id: int,
    patient_data: PatientUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    patient = update_patient(patient_id, patient_data, db)

    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )

    db.commit()

    return patient