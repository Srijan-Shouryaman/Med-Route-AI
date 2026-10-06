from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth.jwt import create_access_token
from app.auth.password import verify_password


def login_user(
    email: str,
    password: str,
    db: Session
):
    user_result = db.execute(
        text("""
            SELECT
                user_id,
                email,
                password_hash,
                full_name,
                role,
                department_id,
                is_active
            FROM users
            WHERE email = :email
        """),
        {
            "email": email
        }
    )

    user = user_result.mappings().fetchone()

    if user is None:
        raise ValueError("Invalid email or password")

    if not user["is_active"]:
        raise ValueError("User account is inactive")

    if not verify_password(
        password,
        user["password_hash"]
    ):
        raise ValueError("Invalid email or password")

    access_token = create_access_token(
        user_id=user["user_id"],
        role=user["role"],
        department_id=user["department_id"]
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user["user_id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role": user["role"],
        "department_id": user["department_id"]
    }