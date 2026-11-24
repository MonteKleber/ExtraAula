import re
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import require_roles
from app.models.models import Subject, User, UserRole
from app.schemas.schemas import SubjectCreate, SubjectOut, SubjectUpdate

router = APIRouter(prefix="/api/subjects", tags=["Disciplinas"])


def _slugify(name: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "-", name.lower()).strip("-")


@router.get("", response_model=list[SubjectOut])
def list_subjects(include_inactive: bool = False, db: Session = Depends(get_db)):
    stmt = select(Subject).order_by(Subject.name.asc())
    if not include_inactive:
        stmt = stmt.where(Subject.is_active.is_(True))
    return [SubjectOut.model_validate(s) for s in db.scalars(stmt).all()]


@router.post("", response_model=SubjectOut, status_code=201)
def create_subject(
    payload: SubjectCreate,
    _admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    slug = _slugify(payload.name)
    exists = db.scalar(
        select(Subject).where((Subject.name == payload.name.strip()) | (Subject.slug == slug))
    )
    if exists:
        raise ConflictError("Já existe uma disciplina com este nome.")
    subject = Subject(
        name=payload.name.strip(),
        slug=slug,
        category=payload.category.strip(),
        description=payload.description,
    )
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return SubjectOut.model_validate(subject)


@router.patch("/{subject_id}", response_model=SubjectOut)
def update_subject(
    subject_id: int,
    payload: SubjectUpdate,
    _admin: User = Depends(require_roles([UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    subject = db.get(Subject, subject_id)
    if not subject:
        raise NotFoundError("Disciplina não encontrada.")
    if payload.name is not None:
        subject.name = payload.name.strip()
        subject.slug = _slugify(payload.name)
    if payload.category is not None:
        subject.category = payload.category.strip()
    if payload.description is not None:
        subject.description = payload.description
    if payload.is_active is not None:
        subject.is_active = payload.is_active
    db.commit()
    db.refresh(subject)
    return SubjectOut.model_validate(subject)
