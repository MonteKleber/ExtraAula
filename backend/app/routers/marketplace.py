from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.models.models import Review, TeacherProfile, TeacherSubject, User
from app.routers.serializers import serialize_review, serialize_teacher
from app.schemas.schemas import ReviewOut, TeacherMarketplaceCard

router = APIRouter(prefix="/api/marketplace", tags=["Marketplace de Professores"])


@router.get("/teachers", response_model=list[TeacherMarketplaceCard])
def list_teachers(
    subject_id: int | None = Query(default=None),
    available_only: bool = Query(default=False),
    min_rating: float | None = Query(default=None, ge=0, le=5),
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    stmt = (
        select(TeacherProfile)
        .join(TeacherProfile.user)
        .where(User.is_active.is_(True))
        .options(
            joinedload(TeacherProfile.user),
            joinedload(TeacherProfile.teacher_subjects).joinedload(TeacherSubject.subject),
            joinedload(TeacherProfile.availability_slots),
        )
        .order_by(TeacherProfile.is_available.desc(), TeacherProfile.rating_avg.desc())
    )
    if available_only:
        stmt = stmt.where(TeacherProfile.is_available.is_(True))
    if min_rating is not None:
        stmt = stmt.where(TeacherProfile.rating_avg >= min_rating)

    profiles = db.scalars(stmt).unique().all()

    results: list[TeacherMarketplaceCard] = []
    search_lower = q.lower().strip() if q else None
    for p in profiles:
        if subject_id is not None:
            if not any(ts.subject_id == subject_id for ts in p.teacher_subjects):
                continue
        if search_lower:
            haystack = " ".join(
                [
                    p.user.name or "",
                    p.headline or "",
                    p.bio or "",
                    " ".join(ts.subject.name for ts in p.teacher_subjects if ts.subject),
                    " ".join(ts.specialty_note or "" for ts in p.teacher_subjects),
                ]
            ).lower()
            if search_lower not in haystack:
                continue
        results.append(serialize_teacher(p))
    return results


@router.get("/teachers/{teacher_user_id}", response_model=TeacherMarketplaceCard)
def get_teacher_detail(teacher_user_id: int, db: Session = Depends(get_db)):
    profile = db.scalar(
        select(TeacherProfile)
        .join(TeacherProfile.user)
        .where(TeacherProfile.user_id == teacher_user_id, User.is_active.is_(True))
        .options(
            joinedload(TeacherProfile.user),
            joinedload(TeacherProfile.teacher_subjects).joinedload(TeacherSubject.subject),
            joinedload(TeacherProfile.availability_slots),
        )
    )
    if not profile:
        raise NotFoundError("Professor não encontrado.")
    return serialize_teacher(profile)


@router.get("/teachers/{teacher_user_id}/reviews", response_model=list[ReviewOut])
def get_teacher_reviews(teacher_user_id: int, db: Session = Depends(get_db)):
    reviews = db.scalars(
        select(Review)
        .where(Review.reviewee_id == teacher_user_id)
        .options(joinedload(Review.reviewer), joinedload(Review.reviewee))
        .order_by(Review.created_at.desc())
    ).all()
    return [serialize_review(r) for r in reviews]


@router.get("/qr/{qr_slug}", response_model=TeacherMarketplaceCard)
def get_teacher_by_qr(qr_slug: str, db: Session = Depends(get_db)):
    """Rota pública acessada pelo QR Code exclusivo de cada professor."""
    profile = db.scalar(
        select(TeacherProfile)
        .join(TeacherProfile.user)
        .where(TeacherProfile.qr_code_slug == qr_slug, User.is_active.is_(True))
        .options(
            joinedload(TeacherProfile.user),
            joinedload(TeacherProfile.teacher_subjects).joinedload(TeacherSubject.subject),
            joinedload(TeacherProfile.availability_slots),
        )
    )
    if not profile:
        raise NotFoundError("QR Code inválido ou professor indisponível.")
    return serialize_teacher(profile)
