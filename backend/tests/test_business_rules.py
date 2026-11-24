import pytest

from app.core.exceptions import (
    ConflictError,
    DomainError,
    InsufficientBalanceError,
    InvalidStateTransitionError,
)
from app.core.security import hash_password
from app.core.state_machine import RequestStatus, assert_transition, can_transition
from app.models.models import (
    ServiceRequest,
    ServiceType,
    Subject,
    TutoringSession,
    User,
    UserRole,
)
from app.services.negotiation_service import validate_duration_for_type
from app.services.session_service import calculate_session_charge
from app.services.wallet_service import (
    get_or_create_wallet,
    lock_escrow,
    refund_session_escrow,
    settle_session_escrow,
    top_up_wallet,
)


def test_state_machine_valid_chain():
    chain = [
        RequestStatus.CRIADA,
        RequestStatus.PROPOSTA_ENVIADA,
        RequestStatus.ACEITA,
        RequestStatus.AGENDADA,
        RequestStatus.EM_ANDAMENTO,
        RequestStatus.FINALIZADA,
    ]
    for cur, nxt in zip(chain, chain[1:]):
        assert can_transition(cur, nxt) is True
        assert assert_transition(cur, nxt) == nxt


def test_state_machine_rejects_invalid_transitions():
    invalid_pairs = [
        (RequestStatus.CRIADA, RequestStatus.FINALIZADA),
        (RequestStatus.CRIADA, RequestStatus.EM_ANDAMENTO),
        (RequestStatus.PROPOSTA_ENVIADA, RequestStatus.FINALIZADA),
        (RequestStatus.FINALIZADA, RequestStatus.EM_ANDAMENTO),
        (RequestStatus.CANCELADA, RequestStatus.AGENDADA),
        (RequestStatus.RECUSADA, RequestStatus.ACEITA),
        (RequestStatus.EXPIRADA, RequestStatus.PROPOSTA_ENVIADA),
    ]
    for cur, nxt in invalid_pairs:
        assert can_transition(cur, nxt) is False
        with pytest.raises(InvalidStateTransitionError):
            assert_transition(cur, nxt)


def test_duration_validation_by_service_type():
    validate_duration_for_type(ServiceType.TIRA_DUVIDAS, 15)
    validate_duration_for_type(ServiceType.TIRA_DUVIDAS, 30)
    with pytest.raises(DomainError):
        validate_duration_for_type(ServiceType.TIRA_DUVIDAS, 45)

    validate_duration_for_type(ServiceType.MENTORIA_PROFISSIONAL, 30)
    validate_duration_for_type(ServiceType.MENTORIA_PROFISSIONAL, 60)
    with pytest.raises(DomainError):
        validate_duration_for_type(ServiceType.MENTORIA_PROFISSIONAL, 20)


def test_server_billing_calculation():
    # Full planned duration -> full agreed tokens
    assert calculate_session_charge(100, 30, 30 * 60) == 100
    # Over planned duration -> capped at agreed tokens (escrow cap)
    assert calculate_session_charge(100, 30, 45 * 60) == 100
    # Half duration -> half agreed tokens
    assert calculate_session_charge(100, 30, 15 * 60) == 50
    # Very short session -> minimum consultation fee (20%)
    assert calculate_session_charge(100, 30, 20) == 20


def test_wallet_idempotency_and_negative_balance_protection(db_session):
    student = User(
        name="Aluno Teste",
        email="s@test.com",
        password_hash=hash_password("123456"),
        role=UserRole.STUDENT,
    )
    db_session.add(student)
    db_session.flush()

    w1, tx1 = top_up_wallet(db_session, student.id, 100, idempotency_key="dup-key-1")
    w2, tx2 = top_up_wallet(db_session, student.id, 100, idempotency_key="dup-key-1")
    assert w1.balance == 100
    assert w2.balance == 100
    assert tx1.id == tx2.id

    with pytest.raises(InsufficientBalanceError):
        lock_escrow(db_session, student.id, 150, request_id=999, idempotency_key="lock-too-much")
    assert get_or_create_wallet(db_session, student.id).balance == 100


def test_wallet_escrow_settle_and_refund(db_session):
    student = User(name="Aluno", email="st@t.com", password_hash=hash_password("123456"), role=UserRole.STUDENT)
    teacher = User(name="Prof", email="pr@t.com", password_hash=hash_password("123456"), role=UserRole.TEACHER)
    subj = Subject(name="Cálculo", slug="calculo", category="Exatas")
    db_session.add_all([student, teacher, subj])
    db_session.flush()

    top_up_wallet(db_session, student.id, 200, idempotency_key="topup-1")
    req = ServiceRequest(
        student_id=student.id,
        teacher_id=teacher.id,
        subject_id=subj.id,
        service_type=ServiceType.TIRA_DUVIDAS,
        title="Dúvida",
        description="Descrição completa",
        duration_minutes=30,
        offered_tokens=100,
        agreed_tokens=100,
        status=RequestStatus.AGENDADA,
    )
    db_session.add(req)
    db_session.flush()

    sess = TutoringSession(
        request_id=req.id,
        student_id=student.id,
        teacher_id=teacher.id,
        subject_id=subj.id,
        status=RequestStatus.EM_ANDAMENTO,
        agreed_tokens=100,
        planned_duration_minutes=30,
    )
    db_session.add(sess)
    db_session.flush()

    lock_escrow(db_session, student.id, 100, req.id, sess.id, idempotency_key="lock-1")
    sw = get_or_create_wallet(db_session, student.id)
    assert sw.balance == 100
    assert sw.locked_balance == 100

    # Settle with partial charge (60 of 100 -> 40 refunded, 15% fee = 9, teacher net = 51)
    charged, fee, net = settle_session_escrow(db_session, sess, charged_tokens=60, commission_rate=0.15)
    assert (charged, fee, net) == (60, 9, 51)

    sw = get_or_create_wallet(db_session, student.id)
    tw = get_or_create_wallet(db_session, teacher.id)
    assert sw.balance == 140
    assert sw.locked_balance == 0
    assert tw.balance == 51

    # Duplicate settlement must be blocked
    with pytest.raises(ConflictError):
        settle_session_escrow(db_session, sess, charged_tokens=60, commission_rate=0.15)


def test_wallet_cancel_full_refund(db_session):
    student = User(name="Aluno2", email="st2@t.com", password_hash=hash_password("123456"), role=UserRole.STUDENT)
    teacher = User(name="Prof2", email="pr2@t.com", password_hash=hash_password("123456"), role=UserRole.TEACHER)
    subj = Subject(name="Física", slug="fisica", category="Exatas")
    db_session.add_all([student, teacher, subj])
    db_session.flush()

    top_up_wallet(db_session, student.id, 120, idempotency_key="topup-2")
    req = ServiceRequest(
        student_id=student.id,
        teacher_id=teacher.id,
        subject_id=subj.id,
        service_type=ServiceType.TIRA_DUVIDAS,
        title="Força",
        description="Descrição detalhada",
        duration_minutes=20,
        offered_tokens=80,
        agreed_tokens=80,
        status=RequestStatus.AGENDADA,
    )
    db_session.add(req)
    db_session.flush()
    sess = TutoringSession(
        request_id=req.id,
        student_id=student.id,
        teacher_id=teacher.id,
        subject_id=subj.id,
        status=RequestStatus.AGENDADA,
        agreed_tokens=80,
        planned_duration_minutes=20,
    )
    db_session.add(sess)
    db_session.flush()

    lock_escrow(db_session, student.id, 80, req.id, sess.id, idempotency_key="lock-2")
    refund_session_escrow(db_session, sess)
    sw = get_or_create_wallet(db_session, student.id)
    assert sw.balance == 120
    assert sw.locked_balance == 0
