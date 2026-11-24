from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.exceptions import ConflictError, DomainError, InsufficientBalanceError
from app.models.models import TutoringSession, Wallet, WalletTransaction, WalletTxType


def get_or_create_wallet(db: Session, user_id: int) -> Wallet:
    wallet = db.scalar(select(Wallet).where(Wallet.user_id == user_id))
    if not wallet:
        wallet = Wallet(user_id=user_id, balance=0, locked_balance=0)
        db.add(wallet)
        db.flush()
    return wallet


def _check_idempotency(db: Session, idempotency_key: str | None) -> WalletTransaction | None:
    if not idempotency_key:
        return None
    return db.scalar(
        select(WalletTransaction).where(WalletTransaction.idempotency_key == idempotency_key)
    )


def top_up_wallet(
    db: Session,
    user_id: int,
    amount: int,
    description: str = "Compra simulada de pacotes de tokens",
    idempotency_key: str | None = None,
) -> tuple[Wallet, WalletTransaction]:
    if amount <= 0:
        raise DomainError("O valor da recarga deve ser maior que zero.")

    existing = _check_idempotency(db, idempotency_key)
    if existing:
        wallet = db.get(Wallet, existing.wallet_id)
        return wallet, existing

    wallet = get_or_create_wallet(db, user_id)
    wallet.balance += amount
    tx = WalletTransaction(
        wallet_id=wallet.id,
        tx_type=WalletTxType.TOPUP,
        amount=amount,
        balance_after=wallet.balance,
        locked_balance_after=wallet.locked_balance,
        description=description,
        idempotency_key=idempotency_key,
    )
    db.add(tx)
    db.flush()
    return wallet, tx


def lock_escrow(
    db: Session,
    student_id: int,
    amount: int,
    request_id: int,
    session_id: int | None = None,
    idempotency_key: str | None = None,
) -> WalletTransaction:
    if amount <= 0:
        raise DomainError("Valor de bloqueio inválido.")

    existing = _check_idempotency(db, idempotency_key)
    if existing:
        return existing

    wallet = get_or_create_wallet(db, student_id)
    if wallet.balance < amount:
        raise InsufficientBalanceError(required=amount, available=wallet.balance)

    wallet.balance -= amount
    wallet.locked_balance += amount

    tx = WalletTransaction(
        wallet_id=wallet.id,
        request_id=request_id,
        session_id=session_id,
        tx_type=WalletTxType.ESCROW_LOCK,
        amount=amount,
        balance_after=wallet.balance,
        locked_balance_after=wallet.locked_balance,
        description=f"Bloqueio em garantia para solicitação #{request_id}",
        idempotency_key=idempotency_key,
    )
    db.add(tx)
    db.flush()
    return tx


def settle_session_escrow(
    db: Session,
    session: TutoringSession,
    charged_tokens: int,
    commission_rate: float | None = None,
) -> tuple[int, int, int]:
    """
    Settles locked escrow after session completion inside caller's ACID transaction.
    Returns (charged_tokens, platform_fee_tokens, teacher_net_tokens).
    """
    settings = get_settings()
    rate = settings.PLATFORM_COMMISSION_RATE if commission_rate is None else commission_rate

    settle_key = f"session:{session.id}:settle"
    if _check_idempotency(db, settle_key):
        raise ConflictError("Esta sessão já teve liquidação financeira processada.")

    agreed = session.agreed_tokens
    charged = max(1, min(agreed, charged_tokens))
    refund_amount = agreed - charged

    platform_fee = max(1, round(charged * rate)) if charged >= 5 else 0
    teacher_net = charged - platform_fee

    student_wallet = get_or_create_wallet(db, session.student_id)
    if student_wallet.locked_balance < agreed:
        raise ConflictError("Saldo bloqueado inconsistente para liquidação da sessão.")

    # Release charged amount from student's locked balance
    student_wallet.locked_balance -= charged
    db.add(
        WalletTransaction(
            wallet_id=student_wallet.id,
            session_id=session.id,
            request_id=session.request_id,
            tx_type=WalletTxType.ESCROW_RELEASE,
            amount=charged,
            balance_after=student_wallet.balance,
            locked_balance_after=student_wallet.locked_balance,
            description=f"Pagamento da sessão #{session.id} ({charged} tokens)",
            idempotency_key=settle_key,
        )
    )

    # Refund any unused portion of escrowed tokens to student
    if refund_amount > 0:
        student_wallet.locked_balance -= refund_amount
        student_wallet.balance += refund_amount
        db.add(
            WalletTransaction(
                wallet_id=student_wallet.id,
                session_id=session.id,
                request_id=session.request_id,
                tx_type=WalletTxType.ESCROW_REFUND,
                amount=refund_amount,
                balance_after=student_wallet.balance,
                locked_balance_after=student_wallet.locked_balance,
                description=f"Estorno parcial de tempo não utilizado na sessão #{session.id}",
                idempotency_key=f"session:{session.id}:partial_refund",
            )
        )

    # Credit teacher net earnings
    teacher_wallet = get_or_create_wallet(db, session.teacher_id)
    if teacher_net > 0:
        teacher_wallet.balance += teacher_net
        db.add(
            WalletTransaction(
                wallet_id=teacher_wallet.id,
                session_id=session.id,
                request_id=session.request_id,
                tx_type=WalletTxType.SESSION_PAYMENT,
                amount=teacher_net,
                balance_after=teacher_wallet.balance,
                locked_balance_after=teacher_wallet.locked_balance,
                description=f"Repasse líquido da sessão #{session.id} (comissão {int(rate * 100)}%)",
                idempotency_key=f"session:{session.id}:teacher_payout",
            )
        )

    # Record simulated platform commission entry on teacher wallet ledger (0 net effect on balance)
    if platform_fee > 0:
        db.add(
            WalletTransaction(
                wallet_id=teacher_wallet.id,
                session_id=session.id,
                request_id=session.request_id,
                tx_type=WalletTxType.PLATFORM_FEE,
                amount=platform_fee,
                balance_after=teacher_wallet.balance,
                locked_balance_after=teacher_wallet.locked_balance,
                description=f"Taxa da plataforma ExtraAula ({int(rate * 100)}%) sobre sessão #{session.id}",
                idempotency_key=f"session:{session.id}:platform_fee",
            )
        )

    db.flush()
    return charged, platform_fee, teacher_net


def refund_session_escrow(db: Session, session: TutoringSession) -> WalletTransaction:
    refund_key = f"session:{session.id}:cancel_refund"
    existing = _check_idempotency(db, refund_key)
    if existing:
        return existing

    student_wallet = get_or_create_wallet(db, session.student_id)
    amount = session.agreed_tokens
    if student_wallet.locked_balance < amount:
        raise ConflictError("Saldo bloqueado insuficiente para estorno.")

    student_wallet.locked_balance -= amount
    student_wallet.balance += amount
    tx = WalletTransaction(
        wallet_id=student_wallet.id,
        session_id=session.id,
        request_id=session.request_id,
        tx_type=WalletTxType.ESCROW_REFUND,
        amount=amount,
        balance_after=student_wallet.balance,
        locked_balance_after=student_wallet.locked_balance,
        description=f"Estorno integral por cancelamento da sessão #{session.id}",
        idempotency_key=refund_key,
    )
    db.add(tx)
    db.flush()
    return tx
