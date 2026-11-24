import math
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, DomainError, ForbiddenError, NotFoundError
from app.core.state_machine import RequestStatus, assert_transition
from app.models.models import (
    Review,
    StudentProfile,
    TeacherProfile,
    TutoringSession,
    User,
    UserRole,
)
from app.schemas.schemas import ReviewCreate, SessionTimerState
from app.services.notification_service import notify
from app.services.wallet_service import refund_session_escrow, settle_session_escrow


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def calculate_session_charge(
    agreed_tokens: int,
    planned_duration_minutes: int,
    actual_duration_seconds: int,
) -> int:
    """
    Backend-authoritative token billing based on server-calculated elapsed time.
    - Minimum consultation charge: 20% of agreed_tokens (at least 1 token).
    - Prorated per started minute relative to planned_duration_minutes.
    - Never exceeds agreed_tokens (the locked escrow).
    """
    if actual_duration_seconds <= 0:
        return max(1, round(agreed_tokens * 0.20))

    billed_minutes = max(1, math.ceil(actual_duration_seconds / 60))
    ratio = billed_minutes / max(1, planned_duration_minutes)
    prorated = round(agreed_tokens * ratio)
    min_charge = max(1, round(agreed_tokens * 0.20))
    return min(agreed_tokens, max(min_charge, prorated))


def compute_timer_state(session: TutoringSession) -> SessionTimerState:
    now = datetime.now(timezone.utc)
    planned_seconds = session.planned_duration_minutes * 60
    started_at = _ensure_utc(session.started_at)
    ended_at = _ensure_utc(session.ended_at)

    if session.status == RequestStatus.EM_ANDAMENTO and started_at is not None:
        elapsed = max(0, int((now - started_at).total_seconds()))
        estimated = calculate_session_charge(
            session.agreed_tokens, session.planned_duration_minutes, elapsed
        )
    elif session.status == RequestStatus.FINALIZADA:
        elapsed = session.actual_duration_seconds
        estimated = session.charged_tokens
    else:
        elapsed = 0
        estimated = 0

    remaining = max(0, planned_seconds - elapsed)
    return SessionTimerState(
        session_id=session.id,
        status=session.status,
        server_now=now,
        started_at=started_at,
        ended_at=ended_at,
        planned_duration_seconds=planned_seconds,
        elapsed_seconds=elapsed,
        remaining_seconds=remaining,
        estimated_tokens_so_far=estimated,
        agreed_tokens=session.agreed_tokens,
    )


def _assert_participant(session: TutoringSession, user: User) -> None:
    if user.role == UserRole.ADMIN:
        return
    if user.id not in (session.student_id, session.teacher_id):
        raise ForbiddenError("Você não participa desta sessão de atendimento.")


def start_session(db: Session, session_id: int, actor: User) -> TutoringSession:
    session = db.get(TutoringSession, session_id)
    if not session:
        raise NotFoundError("Sessão não encontrada.")
    _assert_participant(session, actor)

    new_status = assert_transition(session.status, RequestStatus.EM_ANDAMENTO)
    session.status = new_status
    session.started_at = datetime.now(timezone.utc)
    if session.request:
        session.request.status = assert_transition(session.request.status, RequestStatus.EM_ANDAMENTO)

    other_id = session.teacher_id if actor.id == session.student_id else session.student_id
    notify(
        db,
        user_id=other_id,
        title="Sessão iniciada",
        message=f"A sessão #{session.id} está em andamento. O cronômetro oficial foi iniciado.",
        kind="SESSION",
        link=f"/sessions/{session.id}",
    )

    db.commit()
    db.refresh(session)
    return session


def finish_session(db: Session, session_id: int, actor: User) -> TutoringSession:
    session = db.get(TutoringSession, session_id)
    if not session:
        raise NotFoundError("Sessão não encontrada.")
    _assert_participant(session, actor)

    new_status = assert_transition(session.status, RequestStatus.FINALIZADA)
    now = datetime.now(timezone.utc)
    started_at = _ensure_utc(session.started_at) or now
    elapsed_seconds = max(1, int((now - started_at).total_seconds()))

    charged_calc = calculate_session_charge(
        agreed_tokens=session.agreed_tokens,
        planned_duration_minutes=session.planned_duration_minutes,
        actual_duration_seconds=elapsed_seconds,
    )

    charged, fee, teacher_net = settle_session_escrow(db, session, charged_calc)

    session.status = new_status
    session.ended_at = now
    session.actual_duration_seconds = elapsed_seconds
    session.charged_tokens = charged
    session.platform_fee_tokens = fee
    session.teacher_net_tokens = teacher_net

    if session.request:
        session.request.status = assert_transition(session.request.status, RequestStatus.FINALIZADA)

    # Increment teacher's completed session count
    teacher_profile = db.scalar(
        select(TeacherProfile).where(TeacherProfile.user_id == session.teacher_id)
    )
    if teacher_profile:
        teacher_profile.completed_sessions_count += 1

    notify(
        db,
        user_id=session.student_id,
        title="Sessão finalizada — avalie o atendimento",
        message=f"Sessão #{session.id} encerrada. Valor cobrado: {charged} tokens. Deixe sua avaliação!",
        kind="REVIEW",
        link=f"/sessions/{session.id}",
    )
    notify(
        db,
        user_id=session.teacher_id,
        title="Sessão finalizada — repasse creditado",
        message=f"Sessão #{session.id} encerrada. Você recebeu {teacher_net} tokens líquidos!",
        kind="PAYMENT",
        link=f"/sessions/{session.id}",
    )

    db.commit()
    db.refresh(session)
    return session


def cancel_session(db: Session, session_id: int, actor: User) -> TutoringSession:
    session = db.get(TutoringSession, session_id)
    if not session:
        raise NotFoundError("Sessão não encontrada.")
    _assert_participant(session, actor)

    new_status = assert_transition(session.status, RequestStatus.CANCELADA)
    refund_session_escrow(db, session)

    session.status = new_status
    session.ended_at = datetime.now(timezone.utc)
    if session.request:
        session.request.status = assert_transition(session.request.status, RequestStatus.CANCELADA)

    for uid in (session.student_id, session.teacher_id):
        notify(
            db,
            user_id=uid,
            title="Sessão cancelada",
            message=f"Sessão #{session.id} foi cancelada. Os tokens reservados foram estornados ao aluno.",
            kind="WARNING",
            link=f"/sessions/{session.id}",
        )

    db.commit()
    db.refresh(session)
    return session


def create_review(
    db: Session,
    session_id: int,
    reviewer: User,
    data: ReviewCreate,
) -> Review:
    session = db.get(TutoringSession, session_id)
    if not session:
        raise NotFoundError("Sessão não encontrada.")

    if reviewer.id not in (session.student_id, session.teacher_id):
        raise ForbiddenError("Apenas participantes da sessão podem avaliá-la.")

    if session.status != RequestStatus.FINALIZADA:
        raise DomainError("Avaliações só são permitidas após a finalização da sessão.")

    existing = db.scalar(
        select(Review).where(
            Review.session_id == session_id,
            Review.reviewer_id == reviewer.id,
        )
    )
    if existing:
        raise ConflictError("Você já enviou uma avaliação para esta sessão.")

    reviewee_id = session.teacher_id if reviewer.id == session.student_id else session.student_id

    review = Review(
        session_id=session.id,
        reviewer_id=reviewer.id,
        reviewee_id=reviewee_id,
        rating=data.rating,
        comment=data.comment.strip() if data.comment else None,
    )
    db.add(review)
    db.flush()

    # Recalculate reviewee average rating
    avg_val, count_val = db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(
            Review.reviewee_id == reviewee_id
        )
    ).one()

    reviewee = db.get(User, reviewee_id)
    if reviewee and reviewee.role == UserRole.TEACHER:
        profile = db.scalar(select(TeacherProfile).where(TeacherProfile.user_id == reviewee_id))
        if profile:
            profile.rating_avg = round(float(avg_val or 5.0), 2)
            profile.rating_count = int(count_val or 0)
    elif reviewee and reviewee.role == UserRole.STUDENT:
        profile = db.scalar(select(StudentProfile).where(StudentProfile.user_id == reviewee_id))
        if profile:
            profile.rating_avg = round(float(avg_val or 5.0), 2)
            profile.rating_count = int(count_val or 0)

    notify(
        db,
        user_id=reviewee_id,
        title="Nova avaliação recebida",
        message=f"{reviewer.name} avaliou a sessão #{session.id} com {data.rating} estrelas.",
        kind="REVIEW",
        link=f"/sessions/{session.id}",
    )

    db.commit()
    db.refresh(review)
    return review
