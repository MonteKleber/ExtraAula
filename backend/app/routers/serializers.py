from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.models import (
    Message,
    Proposal,
    Review,
    ServiceRequest,
    TeacherProfile,
    TutoringSession,
)
from app.schemas.schemas import (
    AvailabilitySlotOut,
    MessageOut,
    ProposalOut,
    ReviewOut,
    ServiceRequestOut,
    SessionOut,
    TeacherMarketplaceCard,
    TeacherSubjectOut,
)
from app.services.session_service import compute_timer_state


def serialize_teacher(profile: TeacherProfile) -> TeacherMarketplaceCard:
    settings = get_settings()
    user = profile.user
    subjects = [
        TeacherSubjectOut(
            id=ts.id,
            subject_id=ts.subject_id,
            subject_name=ts.subject.name,
            subject_category=ts.subject.category,
            specialty_note=ts.specialty_note,
        )
        for ts in profile.teacher_subjects
        if ts.subject and ts.subject.is_active
    ]
    slots = [
        AvailabilitySlotOut.model_validate(slot)
        for slot in sorted(profile.availability_slots, key=lambda s: (s.day_of_week, s.start_time))
    ]
    return TeacherMarketplaceCard(
        user_id=user.id,
        teacher_profile_id=profile.id,
        name=user.name,
        email=user.email,
        avatar_url=user.avatar_url,
        headline=profile.headline,
        bio=profile.bio,
        education=profile.education,
        experience_years=profile.experience_years,
        avg_tokens_per_session=profile.avg_tokens_per_session,
        is_available=profile.is_available,
        rating_avg=round(profile.rating_avg, 2),
        rating_count=profile.rating_count,
        completed_sessions_count=profile.completed_sessions_count,
        qr_code_slug=profile.qr_code_slug,
        qr_public_url=f"{settings.FRONTEND_BASE_URL.rstrip('/')}/t/{profile.qr_code_slug}",
        subjects=subjects,
        availability_slots=slots,
    )


def serialize_proposal(p: Proposal) -> ProposalOut:
    return ProposalOut(
        id=p.id,
        request_id=p.request_id,
        sender_id=p.sender_id,
        sender_name=p.sender.name if p.sender else "Usuário",
        sender_role=p.sender.role if p.sender else "STUDENT",
        teacher_id=p.teacher_id,
        teacher_name=p.teacher.name if p.teacher else None,
        offered_tokens=p.offered_tokens,
        suggested_datetime=p.suggested_datetime,
        message=p.message,
        status=p.status,
        created_at=p.created_at,
    )


def serialize_request(req: ServiceRequest) -> ServiceRequestOut:
    return ServiceRequestOut(
        id=req.id,
        student_id=req.student_id,
        student_name=req.student.name if req.student else "Aluno",
        teacher_id=req.teacher_id,
        teacher_name=req.teacher.name if req.teacher else None,
        subject_id=req.subject_id,
        subject_name=req.subject.name if req.subject else "Disciplina",
        service_type=req.service_type,
        title=req.title,
        description=req.description,
        duration_minutes=req.duration_minutes,
        offered_tokens=req.offered_tokens,
        agreed_tokens=req.agreed_tokens,
        proposed_scheduled_at=req.proposed_scheduled_at,
        status=req.status,
        session_id=req.session.id if req.session else None,
        proposals=[serialize_proposal(p) for p in req.proposals],
        created_at=req.created_at,
        updated_at=req.updated_at,
    )


def serialize_review(r: Review) -> ReviewOut:
    return ReviewOut(
        id=r.id,
        session_id=r.session_id,
        reviewer_id=r.reviewer_id,
        reviewer_name=r.reviewer.name if r.reviewer else "Usuário",
        reviewer_role=r.reviewer.role if r.reviewer else "STUDENT",
        reviewee_id=r.reviewee_id,
        reviewee_name=r.reviewee.name if r.reviewee else "Usuário",
        rating=r.rating,
        comment=r.comment,
        created_at=r.created_at,
    )


def serialize_message(m: Message) -> MessageOut:
    return MessageOut(
        id=m.id,
        session_id=m.session_id,
        sender_id=m.sender_id,
        sender_name=m.sender.name if m.sender else "Usuário",
        sender_role=m.sender.role if m.sender else "STUDENT",
        content=m.content,
        created_at=m.created_at,
    )


def serialize_session(db: Session, session: TutoringSession) -> SessionOut:
    return SessionOut(
        id=session.id,
        request_id=session.request_id,
        request_title=session.request.title if session.request else f"Sessão #{session.id}",
        service_type=session.request.service_type if session.request else "TIRA_DUVIDAS",
        student_id=session.student_id,
        student_name=session.student.name if session.student else "Aluno",
        teacher_id=session.teacher_id,
        teacher_name=session.teacher.name if session.teacher else "Professor",
        subject_id=session.subject_id,
        subject_name=session.subject.name if session.subject else "Disciplina",
        status=session.status,
        agreed_tokens=session.agreed_tokens,
        planned_duration_minutes=session.planned_duration_minutes,
        scheduled_at=session.scheduled_at,
        started_at=session.started_at,
        ended_at=session.ended_at,
        actual_duration_seconds=session.actual_duration_seconds,
        charged_tokens=session.charged_tokens,
        platform_fee_tokens=session.platform_fee_tokens,
        teacher_net_tokens=session.teacher_net_tokens,
        timer=compute_timer_state(session),
        reviews=[serialize_review(r) for r in session.reviews],
        created_at=session.created_at,
    )
