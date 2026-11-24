from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.exceptions import DomainError, ForbiddenError, NotFoundError
from app.core.security import get_current_user
from app.core.state_machine import RequestStatus
from app.models.models import Message, Review, TutoringSession, User, UserRole
from app.routers.serializers import serialize_message, serialize_review, serialize_session
from app.routers.ws import manager as ws_manager
from app.schemas.schemas import (
    MessageCreate,
    MessageOut,
    ReviewCreate,
    ReviewOut,
    SessionOut,
    SessionTimerState,
)
from app.services.session_service import (
    cancel_session,
    compute_timer_state,
    create_review,
    finish_session,
    start_session,
)

router = APIRouter(prefix="/api/sessions", tags=["Sessões, Chat e Avaliações"])


def _load_session_query():
    return select(TutoringSession).options(
        joinedload(TutoringSession.request),
        joinedload(TutoringSession.student),
        joinedload(TutoringSession.teacher),
        joinedload(TutoringSession.subject),
        joinedload(TutoringSession.reviews).joinedload(Review.reviewer),
        joinedload(TutoringSession.reviews).joinedload(Review.reviewee),
    )


def _check_access(session: TutoringSession, user: User) -> None:
    if user.role == UserRole.ADMIN:
        return
    if user.id not in (session.student_id, session.teacher_id):
        raise ForbiddenError("Você não tem acesso a esta sessão.")


@router.get("", response_model=list[SessionOut])
def list_sessions(
    status: RequestStatus | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = _load_session_query().order_by(TutoringSession.created_at.desc())
    if current_user.role == UserRole.STUDENT:
        stmt = stmt.where(TutoringSession.student_id == current_user.id)
    elif current_user.role == UserRole.TEACHER:
        stmt = stmt.where(TutoringSession.teacher_id == current_user.id)
    if status is not None:
        stmt = stmt.where(TutoringSession.status == status)

    sessions = db.scalars(stmt).unique().all()
    return [serialize_session(db, s) for s in sessions]


@router.get("/{session_id}", response_model=SessionOut)
def get_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.scalar(_load_session_query().where(TutoringSession.id == session_id))
    if not session:
        raise NotFoundError("Sessão não encontrada.")
    _check_access(session, current_user)
    return serialize_session(db, session)


@router.get("/{session_id}/timer", response_model=SessionTimerState)
def get_session_timer(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.get(TutoringSession, session_id)
    if not session:
        raise NotFoundError("Sessão não encontrada.")
    _check_access(session, current_user)
    return compute_timer_state(session)


@router.post("/{session_id}/start", response_model=SessionOut)
async def start_session_endpoint(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = start_session(db, session_id, current_user)
    loaded = db.scalar(_load_session_query().where(TutoringSession.id == session.id))
    out = serialize_session(db, loaded)
    await ws_manager.broadcast_json(
        session_id,
        {"type": "session_status", "session": out.model_dump(mode="json")},
    )
    return out


@router.post("/{session_id}/finish", response_model=SessionOut)
async def finish_session_endpoint(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = finish_session(db, session_id, current_user)
    loaded = db.scalar(_load_session_query().where(TutoringSession.id == session.id))
    out = serialize_session(db, loaded)
    await ws_manager.broadcast_json(
        session_id,
        {"type": "session_status", "session": out.model_dump(mode="json")},
    )
    return out


@router.post("/{session_id}/cancel", response_model=SessionOut)
async def cancel_session_endpoint(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = cancel_session(db, session_id, current_user)
    loaded = db.scalar(_load_session_query().where(TutoringSession.id == session.id))
    out = serialize_session(db, loaded)
    await ws_manager.broadcast_json(
        session_id,
        {"type": "session_status", "session": out.model_dump(mode="json")},
    )
    return out


@router.get("/{session_id}/messages", response_model=list[MessageOut])
def list_messages(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.get(TutoringSession, session_id)
    if not session:
        raise NotFoundError("Sessão não encontrada.")
    _check_access(session, current_user)
    msgs = db.scalars(
        select(Message)
        .where(Message.session_id == session_id)
        .options(joinedload(Message.sender))
        .order_by(Message.created_at.asc())
    ).all()
    return [serialize_message(m) for m in msgs]


@router.post("/{session_id}/messages", response_model=MessageOut, status_code=201)
async def post_message_rest(
    session_id: int,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.get(TutoringSession, session_id)
    if not session:
        raise NotFoundError("Sessão não encontrada.")
    _check_access(session, current_user)
    if session.status in (RequestStatus.CANCELADA, RequestStatus.EXPIRADA):
        raise DomainError("Não é possível enviar mensagens em sessões canceladas ou expiradas.")

    msg = Message(
        session_id=session_id,
        sender_id=current_user.id,
        content=payload.content.strip(),
    )
    db.add(msg)
    db.commit()
    loaded = db.scalar(
        select(Message).where(Message.id == msg.id).options(joinedload(Message.sender))
    )
    out = serialize_message(loaded)
    await ws_manager.broadcast_json(
        session_id,
        {"type": "message", "message": out.model_dump(mode="json")},
    )
    return out


@router.post("/{session_id}/reviews", response_model=ReviewOut, status_code=201)
def submit_review(
    session_id: int,
    payload: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = create_review(db, session_id, current_user, payload)
    loaded = db.scalar(
        select(Review)
        .where(Review.id == review.id)
        .options(joinedload(Review.reviewer), joinedload(Review.reviewee))
    )
    return serialize_review(loaded)
