from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, DomainError, ForbiddenError, NotFoundError
from app.core.state_machine import RequestStatus, assert_transition
from app.models.models import (
    Proposal,
    ProposalStatus,
    ServiceRequest,
    ServiceType,
    Subject,
    TeacherProfile,
    TutoringSession,
    User,
    UserRole,
)
from app.schemas.schemas import ProposalCreate, ServiceRequestCreate
from app.services.notification_service import notify
from app.services.wallet_service import get_or_create_wallet, lock_escrow


def validate_duration_for_type(service_type: ServiceType, duration_minutes: int) -> None:
    if service_type == ServiceType.TIRA_DUVIDAS:
        if not (15 <= duration_minutes <= 30):
            raise DomainError("Tira-dúvidas deve ter duração entre 15 e 30 minutos.")
    elif service_type == ServiceType.MENTORIA_PROFISSIONAL:
        if not (30 <= duration_minutes <= 60):
            raise DomainError("Mentoria profissional deve ter duração entre 30 e 60 minutos.")


def create_service_request(
    db: Session,
    student: User,
    data: ServiceRequestCreate,
) -> ServiceRequest:
    if student.role != UserRole.STUDENT:
        raise ForbiddenError("Apenas alunos podem criar solicitações de atendimento.")

    validate_duration_for_type(data.service_type, data.duration_minutes)

    subject = db.get(Subject, data.subject_id)
    if not subject or not subject.is_active:
        raise NotFoundError("Disciplina não encontrada ou inativa.")

    target_teacher: User | None = None
    if data.teacher_id is not None:
        target_teacher = db.get(User, data.teacher_id)
        if not target_teacher or target_teacher.role != UserRole.TEACHER or not target_teacher.is_active:
            raise NotFoundError("Professor selecionado não encontrado.")

    wallet = get_or_create_wallet(db, student.id)
    if wallet.balance < data.offered_tokens:
        raise DomainError(
            f"Saldo insuficiente para essa oferta. Disponível: {wallet.balance} tokens, oferta: {data.offered_tokens} tokens."
        )

    req = ServiceRequest(
        student_id=student.id,
        teacher_id=target_teacher.id if target_teacher else None,
        subject_id=subject.id,
        service_type=data.service_type,
        title=data.title.strip(),
        description=data.description.strip(),
        duration_minutes=data.duration_minutes,
        offered_tokens=data.offered_tokens,
        proposed_scheduled_at=data.proposed_scheduled_at,
        status=RequestStatus.CRIADA,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(req)
    db.flush()

    # Initial offer transitions CRIADA -> PROPOSTA_ENVIADA
    req.status = assert_transition(req.status, RequestStatus.PROPOSTA_ENVIADA)
    initial_proposal = Proposal(
        request_id=req.id,
        sender_id=student.id,
        teacher_id=target_teacher.id if target_teacher else None,
        offered_tokens=data.offered_tokens,
        suggested_datetime=data.proposed_scheduled_at,
        message="Proposta inicial do aluno.",
        status=ProposalStatus.PENDING,
    )
    db.add(initial_proposal)

    if target_teacher:
        notify(
            db,
            user_id=target_teacher.id,
            title="Nova solicitação de atendimento",
            message=f"{student.name} ofereceu {data.offered_tokens} tokens para {subject.name}: {req.title}",
            kind="REQUEST",
            link="/requests",
        )

    db.commit()
    db.refresh(req)
    return req


def create_proposal(
    db: Session,
    request_id: int,
    sender: User,
    data: ProposalCreate,
) -> Proposal:
    req = db.get(ServiceRequest, request_id)
    if not req:
        raise NotFoundError("Solicitação não encontrada.")

    # Ensure state allows proposals/counterproposals
    req.status = assert_transition(req.status, RequestStatus.PROPOSTA_ENVIADA)

    if sender.role == UserRole.TEACHER:
        if req.teacher_id is not None and req.teacher_id != sender.id:
            raise ForbiddenError("Esta solicitação foi direcionada a outro professor.")
        teacher_id = sender.id
        # Supersede any prior pending proposals from this same teacher
        for p in req.proposals:
            if p.status == ProposalStatus.PENDING and p.sender_id == sender.id:
                p.status = ProposalStatus.SUPERSEDED
    elif sender.role == UserRole.STUDENT:
        if req.student_id != sender.id:
            raise ForbiddenError("Você não é o autor desta solicitação.")
        wallet = get_or_create_wallet(db, sender.id)
        if wallet.balance < data.offered_tokens:
            raise DomainError(
                f"Saldo insuficiente para esta contraproposta. Disponível: {wallet.balance} tokens."
            )
        # Find active teacher from targeted request or latest teacher proposal
        teacher_id = req.teacher_id
        if teacher_id is None:
            teacher_props = [p for p in req.proposals if p.teacher_id is not None]
            if teacher_props:
                teacher_id = teacher_props[-1].teacher_id
        for p in req.proposals:
            if p.status == ProposalStatus.PENDING and p.sender_id == sender.id:
                p.status = ProposalStatus.SUPERSEDED
    else:
        raise ForbiddenError("Apenas alunos e professores podem negociar propostas.")

    proposal = Proposal(
        request_id=req.id,
        sender_id=sender.id,
        teacher_id=teacher_id,
        offered_tokens=data.offered_tokens,
        suggested_datetime=data.suggested_datetime,
        message=data.message.strip() if data.message else None,
        status=ProposalStatus.PENDING,
    )
    db.add(proposal)
    req.offered_tokens = data.offered_tokens
    if data.suggested_datetime:
        req.proposed_scheduled_at = data.suggested_datetime

    # Notify counterparty
    recipient_id = req.student_id if sender.role == UserRole.TEACHER else teacher_id
    if recipient_id:
        notify(
            db,
            user_id=recipient_id,
            title="Nova contraproposta recebida",
            message=f"{sender.name} propôs {data.offered_tokens} tokens em '{req.title}'.",
            kind="PROPOSAL",
            link="/requests",
        )

    db.commit()
    db.refresh(proposal)
    return proposal


def accept_proposal(
    db: Session,
    proposal_id: int,
    actor: User,
) -> TutoringSession:
    proposal = db.get(Proposal, proposal_id)
    if not proposal:
        raise NotFoundError("Proposta não encontrada.")

    req = db.get(ServiceRequest, proposal.request_id)
    if not req:
        raise NotFoundError("Solicitação não encontrada.")

    if proposal.status != ProposalStatus.PENDING:
        raise ConflictError("Esta proposta não está mais pendente.")

    if proposal.sender_id == actor.id:
        raise ForbiddenError("Você não pode aceitar a sua própria proposta.")

    # Determine teacher and validate permissions
    if actor.role == UserRole.TEACHER:
        if req.teacher_id is not None and req.teacher_id != actor.id:
            raise ForbiddenError("Esta solicitação pertence a outro professor.")
        teacher_id = actor.id
    elif actor.role == UserRole.STUDENT:
        if req.student_id != actor.id:
            raise ForbiddenError("Apenas o aluno autor da solicitação pode aceitar contrapropostas.")
        teacher_id = proposal.teacher_id or proposal.sender_id
    else:
        raise ForbiddenError("Perfil não autorizado a aceitar propostas.")

    # Verify teacher exists and is active
    teacher_user = db.get(User, teacher_id)
    if not teacher_user or teacher_user.role != UserRole.TEACHER:
        raise NotFoundError("Professor associado à proposta não encontrado.")

    # State transitions: PROPOSTA_ENVIADA -> ACEITA -> AGENDADA
    req.status = assert_transition(req.status, RequestStatus.ACEITA)
    req.teacher_id = teacher_id
    req.agreed_tokens = proposal.offered_tokens

    # Create session and lock student tokens atomically
    session = TutoringSession(
        request_id=req.id,
        student_id=req.student_id,
        teacher_id=teacher_id,
        subject_id=req.subject_id,
        status=RequestStatus.AGENDADA,
        agreed_tokens=proposal.offered_tokens,
        planned_duration_minutes=req.duration_minutes,
        scheduled_at=proposal.suggested_datetime or req.proposed_scheduled_at or datetime.now(timezone.utc),
    )
    db.add(session)
    db.flush()

    # Lock escrow (raises InsufficientBalanceError and rolls back cleanly if insufficient)
    lock_escrow(
        db=db,
        student_id=req.student_id,
        amount=proposal.offered_tokens,
        request_id=req.id,
        session_id=session.id,
        idempotency_key=f"request:{req.id}:escrow_lock",
    )

    # Finalize request state to AGENDADA
    req.status = assert_transition(req.status, RequestStatus.AGENDADA)

    # Update proposals
    for p in req.proposals:
        if p.id == proposal.id:
            p.status = ProposalStatus.ACCEPTED
            p.teacher_id = teacher_id
        elif p.status == ProposalStatus.PENDING:
            p.status = ProposalStatus.SUPERSEDED

    # Notify both parties
    notify(
        db,
        user_id=req.student_id,
        title="Sessão agendada!",
        message=f"Acordo fechado por {proposal.offered_tokens} tokens com {teacher_user.name}. Tokens reservados em garantia.",
        kind="SESSION",
        link=f"/sessions/{session.id}",
    )
    notify(
        db,
        user_id=teacher_id,
        title="Sessão confirmada!",
        message=f"Atendimento '{req.title}' confirmado por {proposal.offered_tokens} tokens.",
        kind="SESSION",
        link=f"/sessions/{session.id}",
    )

    db.commit()
    db.refresh(session)
    return session


def reject_proposal(db: Session, proposal_id: int, actor: User) -> ServiceRequest:
    proposal = db.get(Proposal, proposal_id)
    if not proposal:
        raise NotFoundError("Proposta não encontrada.")

    req = db.get(ServiceRequest, proposal.request_id)
    if not req:
        raise NotFoundError("Solicitação não encontrada.")

    if proposal.status != ProposalStatus.PENDING:
        raise ConflictError("Esta proposta não está mais pendente.")

    if actor.role == UserRole.TEACHER:
        if req.teacher_id is not None and req.teacher_id != actor.id:
            raise ForbiddenError("Esta solicitação não foi direcionada a você.")
        proposal.status = ProposalStatus.REJECTED
        # If targeted request is rejected by the targeted teacher, mark request RECUSADA
        if req.teacher_id == actor.id:
            req.status = assert_transition(req.status, RequestStatus.RECUSADA)
            notify(
                db,
                user_id=req.student_id,
                title="Proposta recusada",
                message=f"{actor.name} recusou a solicitação '{req.title}'.",
                kind="WARNING",
                link="/requests",
            )
    elif actor.role == UserRole.STUDENT:
        if req.student_id != actor.id:
            raise ForbiddenError("Você não tem permissão para recusar esta contraproposta.")
        if proposal.sender_id == actor.id:
            raise ForbiddenError("Para encerrar sua própria solicitação, use cancelar.")
        proposal.status = ProposalStatus.REJECTED
        if proposal.sender_id:
            notify(
                db,
                user_id=proposal.sender_id,
                title="Contraproposta recusada",
                message=f"O aluno recusou a contraproposta de {proposal.offered_tokens} tokens em '{req.title}'.",
                kind="WARNING",
                link="/requests",
            )
    else:
        raise ForbiddenError("Perfil não autorizado.")

    db.commit()
    db.refresh(req)
    return req


def cancel_request(db: Session, request_id: int, actor: User) -> ServiceRequest:
    req = db.get(ServiceRequest, request_id)
    if not req:
        raise NotFoundError("Solicitação não encontrada.")

    if actor.role != UserRole.ADMIN and req.student_id != actor.id:
        raise ForbiddenError("Apenas o aluno autor ou administrador pode cancelar esta solicitação.")

    if req.session is not None:
        raise ConflictError("Esta solicitação já virou sessão. Cancele diretamente pela sessão.")

    req.status = assert_transition(req.status, RequestStatus.CANCELADA)
    for p in req.proposals:
        if p.status == ProposalStatus.PENDING:
            p.status = ProposalStatus.REJECTED

    if req.teacher_id:
        notify(
            db,
            user_id=req.teacher_id,
            title="Solicitação cancelada",
            message=f"A solicitação '{req.title}' foi cancelada.",
            kind="WARNING",
            link="/requests",
        )

    db.commit()
    db.refresh(req)
    return req
