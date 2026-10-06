from sqlalchemy import text
from sqlalchemy.orm import Session


def create_patient(patient_data, db: Session):
    result = db.execute(
        text("""
            INSERT INTO patients (
                patient_ref_id,
                full_name,
                date_of_birth,
                gender,
                phone,
                email,
                address
            )
            VALUES (
                :patient_ref_id,
                :full_name,
                :date_of_birth,
                :gender,
                :phone,
                :email,
                :address
            )
            RETURNING
                patient_id,
                patient_ref_id,
                full_name,
                date_of_birth,
                gender,
                phone,
                email,
                address,
                created_at,
                updated_at
        """),
        {
            "patient_ref_id": patient_data.patient_ref_id,
            "full_name": patient_data.full_name,
            "date_of_birth": patient_data.date_of_birth,
            "gender": patient_data.gender,
            "phone": patient_data.phone,
            "email": patient_data.email,
            "address": patient_data.address,
        }
    )

    return result.mappings().fetchone()


def get_patient(patient_id: int, db: Session):
    result = db.execute(
        text("""
            SELECT
                patient_id,
                patient_ref_id,
                full_name,
                date_of_birth,
                gender,
                phone,
                email,
                address,
                created_at,
                updated_at
            FROM patients
            WHERE patient_id = :patient_id
        """),
        {"patient_id": patient_id}
    )

    return result.mappings().fetchone()


def get_patient_by_ref_id(patient_ref_id: str, db: Session):
    result = db.execute(
        text("""
            SELECT
                patient_id,
                patient_ref_id,
                full_name,
                date_of_birth,
                gender,
                phone,
                email,
                address,
                created_at,
                updated_at
            FROM patients
            WHERE patient_ref_id = :patient_ref_id
        """),
        {"patient_ref_id": patient_ref_id}
    )

    return result.mappings().fetchone()


def list_patients(db: Session):
    result = db.execute(
        text("""
            SELECT
                patient_id,
                patient_ref_id,
                full_name,
                date_of_birth,
                gender,
                phone,
                email,
                address,
                created_at,
                updated_at
            FROM patients
            ORDER BY created_at DESC
        """)
    )

    return result.mappings().all()


def update_patient(patient_id: int, patient_data, db: Session):
    result = db.execute(
        text("""
            UPDATE patients
            SET
                full_name = COALESCE(:full_name, full_name),
                date_of_birth = COALESCE(:date_of_birth, date_of_birth),
                gender = COALESCE(:gender, gender),
                phone = COALESCE(:phone, phone),
                email = COALESCE(:email, email),
                address = COALESCE(:address, address),
                updated_at = CURRENT_TIMESTAMP
            WHERE patient_id = :patient_id
            RETURNING
                patient_id,
                patient_ref_id,
                full_name,
                date_of_birth,
                gender,
                phone,
                email,
                address,
                created_at,
                updated_at
        """),
        {
            "patient_id": patient_id,
            "full_name": patient_data.full_name,
            "date_of_birth": patient_data.date_of_birth,
            "gender": patient_data.gender,
            "phone": patient_data.phone,
            "email": patient_data.email,
            "address": patient_data.address,
        }
    )

    return result.mappings().fetchone()