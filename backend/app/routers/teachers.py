from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.core.security import require_roles
from app.core.state_machine import RequestStatus
from app.models.models import (
    AvailabilitySlot,
    Review,
    Subject,
    TeacherProfile,
    TeacherSubject,
    TutoringSession,
    User,
    UserRole,
)
from app.routers.serializers import serialize_review, serialize_teacher
from app.schemas.schemas import ReviewOut, TeacherMarketplaceCard, TeacherProfileUpdate
from app.services.wallet_service import get_or_create_wallet

router = APIRouter(prefix="/api/teachers", tags=["Área do Professor"])


@router.get("/me/profile", response_model=TeacherMarketplaceCard)
def get_my_teacher_profile(
    teacher: User = Depends(require_roles([UserRole.TEACHER])),
    db: Session = Depends(get_db),
):
    profile = db.scalar(
        select(TeacherProfile)
        .where(TeacherProfile.user_id == teacher.id)
        .options(
            joinedload(TeacherProfile.user),
            joinedload(TeacherProfile.teacher_subjects).joinedload(TeacherSubject.subject),
            joinedload(TeacherProfile.availability_slots),
        )
    )
    if not profile:
        raise NotFoundError("Perfil de professor não encontrado.")
    return serialize_teacher(profile)


@router.put("/me/profile", response_model=TeacherMarketplaceCard)
def update_my_teacher_profile(
    payload: TeacherProfileUpdate,
    teacher: User = Depends(require_roles([UserRole.TEACHER])),
    db: Session = Depends(get_db),
):
    profile = db.scalar(
        select(TeacherProfile)
        .where(TeacherProfile.user_id == teacher.id)
        .options(
            joinedload(TeacherProfile.user),
            joinedload(TeacherProfile.teacher_subjects).joinedload(TeacherSubject.subject),
            joinedload(TeacherProfile.availability_slots),
        )
    )
    if not profile:
        raise NotFoundError("Perfil de professor não encontrado.")

    if payload.headline is not None:
        profile.headline = payload.headline.strip()
    if payload.bio is not None:
        profile.bio = payload.bio.strip()
    if payload.education is not None:
        profile.education = payload.education.strip()
    if payload.experience_years is not None:
        profile.experience_years = payload.experience_years
    if payload.avg_tokens_per_session is not None:
        profile.avg_tokens_per_session = payload.avg_tokens_per_session
    if payload.is_available is not None:
        profile.is_available = payload.is_available

    if payload.subjects is not None:
        profile.teacher_subjects.clear()
        db.flush()
        seen_ids: set[int] = set()
        for item in payload.subjects:
            if item.subject_id in seen_ids:
                continue
            subj = db.get(Subject, item.subject_id)
            if not subj or not subj.is_active:
                continue
            seen_ids.add(item.subject_id)
            profile.teacher_subjects.append(
                TeacherSubject(
                    teacher_profile_id=profile.id,
                    subject_id=subj.id,
                    specialty_note=item.specialty_note,
                )
            )

    if payload.availability_slots is not None:
        profile.availability_slots.clear()
        db.flush()
        for slot in payload.availability_slots:
            profile.availability_slots.append(
                AvailabilitySlot(
                    teacher_profile_id=profile.id,
                    day_of_week=slot.day_of_week,
                    start_time=slot.start_time,
                    end_time=slot.end_time,
                    is_active=slot.is_active,
                )
            )

    db.commit()
    db.expire_all()
    refreshed = db.scalar(
        select(TeacherProfile)
        .where(TeacherProfile.user_id == teacher.id)
        .options(
            joinedload(TeacherProfile.user),
            joinedload(TeacherProfile.teacher_subjects).joinedload(TeacherSubject.subject),
            joinedload(TeacherProfile.availability_slots),
        )
    )
    return serialize_teacher(refreshed)


@router.get("/me/earnings")
def get_my_earnings(
    teacher: User = Depends(require_roles([UserRole.TEACHER])),
    db: Session = Depends(get_db),
):
    wallet = get_or_create_wallet(db, teacher.id)
    total_gross, total_fee, total_net, completed_count = db.execute(
        select(
            func.coalesce(func.sum(TutoringSession.charged_tokens), 0),
            func.coalesce(func.sum(TutoringSession.platform_fee_tokens), 0),
            func.coalesce(func.sum(TutoringSession.teacher_net_tokens), 0),
            func.count(TutoringSession.id),
        ).where(
            TutoringSession.teacher_id == teacher.id,
            TutoringSession.status == RequestStatus.FINALIZADA,
        )
    ).one()

    pending_escrow = db.scalar(
        select(func.coalesce(func.sum(TutoringSession.agreed_tokens), 0)).where(
            TutoringSession.teacher_id == teacher.id,
            TutoringSession.status.in_([RequestStatus.AGENDADA, RequestStatus.EM_ANDAMENTO]),
        )
    )

    return {
        "available_balance": wallet.balance,
        "total_gross_tokens": int(total_gross),
        "total_platform_fee_tokens": int(total_fee),
        "total_net_tokens": int(total_net),
        "completed_sessions": int(completed_count),
        "scheduled_escrow_tokens": int(pending_escrow or 0),
    }


@router.get("/me/reviews", response_model=list[ReviewOut])
def get_my_reviews(
    teacher: User = Depends(require_roles([UserRole.TEACHER])),
    db: Session = Depends(get_db),
):
    reviews = db.scalars(
        select(Review)
        .where(Review.reviewee_id == teacher.id)
        .options(joinedload(Review.reviewer), joinedload(Review.reviewee))
        .order_by(Review.created_at.desc())
    ).all()
    return [serialize_review(r) for r in reviews]
