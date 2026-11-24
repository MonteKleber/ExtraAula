from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.security import get_current_user, require_roles
from app.core.state_machine import RequestStatus
from app.models.models import Proposal, ServiceRequest, User, UserRole
from app.routers.serializers import serialize_proposal, serialize_request, serialize_session
from app.schemas.schemas import (
    ProposalCreate,
    ProposalOut,
    ServiceRequestCreate,
    ServiceRequestOut,
    SessionOut,
)
from app.services.negotiation_service import (
    accept_proposal,
    cancel_request,
    create_proposal,
    create_service_request,
    reject_proposal,
)

router = APIRouter(prefix="/api", tags=["Solicitações e Negociação (InDrive)"])


def _load_request_query():
    return select(ServiceRequest).options(
        joinedload(ServiceRequest.student),
        joinedload(ServiceRequest.teacher),
        joinedload(ServiceRequest.subject),
        joinedload(ServiceRequest.session),
        joinedload(ServiceRequest.proposals).joinedload(Proposal.sender),
        joinedload(ServiceRequest.proposals).joinedload(Proposal.teacher),
    )


@router.post("/requests", response_model=ServiceRequestOut, status_code=201)
def create_request(
    payload: ServiceRequestCreate,
    student: User = Depends(require_roles([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    req = create_service_request(db, student, payload)
    loaded = db.scalar(_load_request_query().where(ServiceRequest.id == req.id))
    return serialize_request(loaded)


@router.get("/requests", response_model=list[ServiceRequestOut])
def list_requests(
    status: RequestStatus | None = Query(default=None),
    open_only: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = _load_request_query().order_by(ServiceRequest.created_at.desc())

    if current_user.role == UserRole.STUDENT:
        stmt = stmt.where(ServiceRequest.student_id == current_user.id)
    elif current_user.role == UserRole.TEACHER:
        if open_only:
            stmt = stmt.where(
                ServiceRequest.teacher_id.is_(None),
                ServiceRequest.status.in_([RequestStatus.CRIADA, RequestStatus.PROPOSTA_ENVIADA]),
            )
        else:
            stmt = stmt.where(
                or_(
                    ServiceRequest.teacher_id == current_user.id,
                    (
                        ServiceRequest.teacher_id.is_(None)
                        & ServiceRequest.status.in_(
                            [RequestStatus.CRIADA, RequestStatus.PROPOSTA_ENVIADA]
                        )
                    ),
                )
            )

    if status is not None:
        stmt = stmt.where(ServiceRequest.status == status)

    items = db.scalars(stmt).unique().all()
    return [serialize_request(r) for r in items]


@router.get("/requests/{request_id}", response_model=ServiceRequestOut)
def get_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    req = db.scalar(_load_request_query().where(ServiceRequest.id == request_id))
    if not req:
        raise NotFoundError("Solicitação não encontrada.")
    if current_user.role == UserRole.STUDENT and req.student_id != current_user.id:
        raise ForbiddenError("Sem permissão para visualizar esta solicitação.")
    if (
        current_user.role == UserRole.TEACHER
        and req.teacher_id is not None
        and req.teacher_id != current_user.id
    ):
        raise ForbiddenError("Esta solicitação foi direcionada a outro professor.")
    return serialize_request(req)


@router.post("/requests/{request_id}/proposals", response_model=ProposalOut, status_code=201)
def send_proposal(
    request_id: int,
    payload: ProposalCreate,
    current_user: User = Depends(require_roles([UserRole.STUDENT, UserRole.TEACHER])),
    db: Session = Depends(get_db),
):
    prop = create_proposal(db, request_id, current_user, payload)
    loaded = db.scalar(
        select(Proposal)
        .where(Proposal.id == prop.id)
        .options(joinedload(Proposal.sender), joinedload(Proposal.teacher))
    )
    return serialize_proposal(loaded)


@router.post("/proposals/{proposal_id}/accept", response_model=SessionOut)
def accept_proposal_endpoint(
    proposal_id: int,
    current_user: User = Depends(require_roles([UserRole.STUDENT, UserRole.TEACHER])),
    db: Session = Depends(get_db),
):
    session = accept_proposal(db, proposal_id, current_user)
    return serialize_session(db, session)


@router.post("/proposals/{proposal_id}/reject", response_model=ServiceRequestOut)
def reject_proposal_endpoint(
    proposal_id: int,
    current_user: User = Depends(require_roles([UserRole.STUDENT, UserRole.TEACHER])),
    db: Session = Depends(get_db),
):
    req = reject_proposal(db, proposal_id, current_user)
    loaded = db.scalar(_load_request_query().where(ServiceRequest.id == req.id))
    return serialize_request(loaded)


@router.post("/requests/{request_id}/cancel", response_model=ServiceRequestOut)
def cancel_request_endpoint(
    request_id: int,
    current_user: User = Depends(require_roles([UserRole.STUDENT, UserRole.ADMIN])),
    db: Session = Depends(get_db),
):
    req = cancel_request(db, request_id, current_user)
    loaded = db.scalar(_load_request_query().where(ServiceRequest.id == req.id))
    return serialize_request(loaded)
