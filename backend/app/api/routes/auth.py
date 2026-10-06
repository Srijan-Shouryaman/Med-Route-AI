from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.schemas.auth import LoginRequest, LoginResponse
from app.services.auth.auth_service import login_user
from app.auth.dependencies import get_current_user
from app.auth.dependencies import get_current_user, require_role, require_department_access

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


@router.post(
    "/login",
    response_model=LoginResponse
)
def login(
    request: LoginRequest,
    db: Session = Depends(get_db)
):
    try:
        return login_user(
            email=request.email,
            password=request.password,
            db=db
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc)
        )
        

