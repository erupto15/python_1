from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import schemas
from app.db import get_db
from app.deps import assert_owner, get_current_user
from app.models import Boulder, Comment, Route, User

router = APIRouter(prefix="/comments", tags=["comments"])


def _validate_comment_payload(payload: schemas.CommentCreate) -> None:
    if payload.climb_type == "route":
        if payload.route_id is None or payload.boulder_id is not None:
            raise HTTPException(status_code=400, detail="route_id required and boulder_id must be null")
    else:
        if payload.boulder_id is None or payload.route_id is not None:
            raise HTTPException(status_code=400, detail="boulder_id required and route_id must be null")


@router.get("/by-route/{route_id}", response_model=list[schemas.CommentRead])
def list_comments_route(route_id: int, db: Session = Depends(get_db)) -> list[Comment]:
    if not db.get(Route, route_id):
        raise HTTPException(status_code=404, detail="Route not found")
    return (
        db.query(Comment)
        .filter(Comment.climb_type == "route", Comment.route_id == route_id, Comment.deleted_at.is_(None))
        .order_by(Comment.id)
        .all()
    )


@router.get("/by-boulder/{boulder_id}", response_model=list[schemas.CommentRead])
def list_comments_boulder(boulder_id: int, db: Session = Depends(get_db)) -> list[Comment]:
    if not db.get(Boulder, boulder_id):
        raise HTTPException(status_code=404, detail="Boulder not found")
    return (
        db.query(Comment)
        .filter(Comment.climb_type == "boulder", Comment.boulder_id == boulder_id, Comment.deleted_at.is_(None))
        .order_by(Comment.id)
        .all()
    )


@router.post("", response_model=schemas.CommentRead, status_code=201)
def create_comment(
    payload: schemas.CommentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Comment:
    _validate_comment_payload(payload)
    if payload.climb_type == "route" and not db.get(Route, payload.route_id):
        raise HTTPException(status_code=404, detail="Route not found")
    if payload.climb_type == "boulder" and not db.get(Boulder, payload.boulder_id):
        raise HTTPException(status_code=404, detail="Boulder not found")
    data = payload.model_dump()
    data["user_id"] = user.id
    comment = Comment(**data)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.patch("/{comment_id}", response_model=schemas.CommentRead)
def update_comment(
    comment_id: int,
    payload: schemas.CommentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Comment:
    c = db.get(Comment, comment_id)
    if not c or c.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Comment not found")
    assert_owner(user, c.user_id)
    c.body = payload.body
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{comment_id}", status_code=204)
def delete_comment(comment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    c = db.get(Comment, comment_id)
    if not c or c.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Comment not found")
    assert_owner(user, c.user_id)
    c.deleted_at = datetime.now(timezone.utc)
    db.commit()
