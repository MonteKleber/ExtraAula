from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.models import User, UserRole, WalletTransaction
from app.schemas.schemas import TopUpRequest, WalletDetailOut, WalletOut, WalletTransactionOut
from app.services.wallet_service import get_or_create_wallet, top_up_wallet

router = APIRouter(prefix="/api/wallet", tags=["Carteira de Tokens"])


@router.get("", response_model=WalletDetailOut)
def get_wallet(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wallet = get_or_create_wallet(db, current_user.id)
    db.commit()
    db.refresh(wallet)

    txs = db.scalars(
        select(WalletTransaction)
        .where(WalletTransaction.wallet_id == wallet.id)
        .order_by(WalletTransaction.created_at.desc(), WalletTransaction.id.desc())
        .limit(100)
    ).all()

    return WalletDetailOut(
        wallet=WalletOut.model_validate(wallet),
        transactions=[WalletTransactionOut.model_validate(tx) for tx in txs],
    )


@router.post("/topup", response_model=WalletDetailOut, status_code=201)
def topup_tokens(
    payload: TopUpRequest,
    student: User = Depends(require_roles([UserRole.STUDENT])),
    db: Session = Depends(get_db),
):
    wallet, _ = top_up_wallet(
        db=db,
        user_id=student.id,
        amount=payload.amount,
        description=f"Compra simulada de {payload.amount} tokens ExtraAula",
        idempotency_key=payload.idempotency_key,
    )
    db.commit()
    db.refresh(wallet)

    txs = db.scalars(
        select(WalletTransaction)
        .where(WalletTransaction.wallet_id == wallet.id)
        .order_by(WalletTransaction.created_at.desc(), WalletTransaction.id.desc())
        .limit(100)
    ).all()
    return WalletDetailOut(
        wallet=WalletOut.model_validate(wallet),
        transactions=[WalletTransactionOut.model_validate(tx) for tx in txs],
    )
