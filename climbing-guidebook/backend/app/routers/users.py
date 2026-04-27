from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import schemas, security
from app.db import get_db
from app.models import User

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=schemas.UserRead, status_code=201)
def register_user(payload: schemas.UserCreate, db: Session = Depends(get_db)) -> User:
    email = str(payload.email).strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=email,
        password_hash=security.hash_password(payload.password),
        display_name=payload.display_name or "",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=schemas.UserRead)
def get_user(user_id: str, db: Session = Depends(get_db)) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
