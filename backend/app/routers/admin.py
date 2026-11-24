from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.exceptions import DomainError, NotFoundError
from app.core.security import require_roles
from app.core.state_machine import RequestStatus
from app.models.models import (
    Review,
    ServiceRequest,
    Subject,
    TeacherProfile,
    TeacherSubject,
    TutoringSession,
    User,
    UserRole,
    Wallet,
    WalletTransaction,
)
from app.routers.serializers import serialize_session, serialize_teacher
from app.schemas.schemas import (
    AdminOverview,
    SessionOut,
    StatusCount,
    SubjectMetric,
    TeacherMarketplaceCard,
    UserSummary,
)

router = APIRouter(prefix="/api/admin", tags=["Painel Administrativo"])


@router.get("/overview", response_model=AdminOverview)
def get_admin_overview(
    _admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    total_students = db.scalar(
        select(func.count(User.id)).where(User.role == UserRole.STUDENT)
    ) or 0
    total_teachers = db.scalar(
        select(func.count(User.id)).where(User.role == UserRole.TEACHER)
    ) or 0
    available_teachers = db.scalar(
        select(func.count(TeacherProfile.id))
        .join(TeacherProfile.user)
        .where(TeacherProfile.is_available.is_(True), User.is_active.is_(True))
    ) or 0

    total_completed = db.scalar(
        select(func.count(TutoringSession.id)).where(
            TutoringSession.status == RequestStatus.FINALIZADA
        )
    ) or 0
    total_cancelled = db.scalar(
        select(func.count(TutoringSession.id)).where(
            TutoringSession.status == RequestStatus.CANCELADA
        )
    ) or 0
    total_active = db.scalar(
        select(func.count(TutoringSession.id)).where(
            TutoringSession.status.in_([RequestStatus.AGENDADA, RequestStatus.EM_ANDAMENTO])
        )
    ) or 0

    total_tokens_volume = db.scalar(
        select(func.coalesce(func.sum(WalletTransaction.amount), 0))
    ) or 0
    platform_commission = db.scalar(
        select(func.coalesce(func.sum(TutoringSession.platform_fee_tokens), 0)).where(
            TutoringSession.status == RequestStatus.FINALIZADA
        )
    ) or 0

    avg_rating = db.scalar(
        select(func.avg(TeacherProfile.rating_avg)).where(TeacherProfile.rating_count > 0)
    )
    if avg_rating is None:
        avg_rating = db.scalar(select(func.avg(TeacherProfile.rating_avg))) or 5.0

    req_rows = db.execute(
        select(ServiceRequest.status, func.count(ServiceRequest.id)).group_by(ServiceRequest.status)
    ).all()
    requests_by_status = [
        StatusCount(status=row[0].value if hasattr(row[0], "value") else str(row[0]), count=int(row[1]))
        for row in req_rows
    ]

    subj_rows = db.execute(
        select(
            Subject.name,
            func.count(TutoringSession.id),
            func.coalesce(func.sum(TutoringSession.charged_tokens), 0),
        )
        .join(TutoringSession, TutoringSession.subject_id == Subject.id)
        .group_by(Subject.name)
        .order_by(func.count(TutoringSession.id).desc())
    ).all()
    sessions_by_subject = [
        SubjectMetric(subject=row[0], sessions=int(row[1]), tokens=int(row[2]))
        for row in subj_rows
    ]

    return AdminOverview(
        total_students=int(total_students),
        total_teachers=int(total_teachers),
        available_teachers=int(available_teachers),
        total_sessions_completed=int(total_completed),
        total_sessions_cancelled=int(total_cancelled),
        total_sessions_active=int(total_active),
        total_tokens_volume=int(total_tokens_volume),
        platform_commission_tokens=int(platform_commission),
        avg_teacher_rating=round(float(avg_rating), 2),
        requests_by_status=requests_by_status,
        sessions_by_subject=sessions_by_subject,
    )


@router.get("/users", response_model=list[UserSummary])
def list_users(
    _admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    users = db.scalars(select(User).order_by(User.created_at.desc())).all()
    return [UserSummary.model_validate(u) for u in users]


@router.patch("/users/{user_id}/toggle-active", response_model=UserSummary)
def toggle_user_active(
    user_id: int,
    admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise NotFoundError("Usuário não encontrado.")
    if user.id == admin.id:
        raise DomainError("Não é possível desativar o próprio administrador.")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return UserSummary.model_validate(user)


@router.get("/teachers", response_model=list[TeacherMarketplaceCard])
def list_admin_teachers(
    _admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    profiles = db.scalars(
        select(TeacherProfile)
        .options(
            joinedload(TeacherProfile.user),
            joinedload(TeacherProfile.teacher_subjects).joinedload(TeacherSubject.subject),
            joinedload(TeacherProfile.availability_slots),
        )
        .order_by(TeacherProfile.rating_avg.desc())
    ).unique().all()
    return [serialize_teacher(p) for p in profiles]


@router.get("/sessions", response_model=list[SessionOut])
def list_admin_sessions(
    _admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    sessions = db.scalars(
        select(TutoringSession)
        .options(
            joinedload(TutoringSession.request),
            joinedload(TutoringSession.student),
            joinedload(TutoringSession.teacher),
            joinedload(TutoringSession.subject),
            joinedload(TutoringSession.reviews).joinedload(Review.reviewer),
            joinedload(TutoringSession.reviews).joinedload(Review.reviewee),
        )
        .order_by(TutoringSession.created_at.desc())
    ).unique().all()
    return [serialize_session(db, s) for s in sessions]


@router.get("/transactions")
def list_admin_transactions(
    _admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(WalletTransaction, User.name, User.email, User.role)
        .join(Wallet, Wallet.id == WalletTransaction.wallet_id)
        .join(User, User.id == Wallet.user_id)
        .order_by(WalletTransaction.created_at.desc(), WalletTransaction.id.desc())
        .limit(150)
    ).all()

    return [
        {
            "id": tx.id,
            "user_name": name,
            "user_email": email,
            "user_role": role.value if hasattr(role, "value") else role,
            "session_id": tx.session_id,
            "request_id": tx.request_id,
            "tx_type": tx.tx_type.value if hasattr(tx.tx_type, "value") else tx.tx_type,
            "amount": tx.amount,
            "balance_after": tx.balance_after,
            "locked_balance_after": tx.locked_balance_after,
            "description": tx.description,
            "created_at": tx.created_at.isoformat(),
        }
        for tx, name, email, role in rows
    ]
