import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ConflictError, DomainError, UnauthorizedError
from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.models.models import StudentProfile, TeacherProfile, User, UserRole
from app.schemas.schemas import (
    AuthResponse,
    LoginRequest,
    PasswordRecoveryRequest,
    PasswordResetConfirm,
    RegisterRequest,
    UserSummary,
    WalletOut,
)
from app.services.wallet_service import get_or_create_wallet, top_up_wallet

router = APIRouter(prefix="/api/auth", tags=["Autenticação"])


def _slugify(text: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    return f"{clean[:24]}-{secrets.token_hex(3)}"


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        raise ConflictError("Já existe uma conta cadastrada com este e-mail.")

    avatar_seed = payload.name.strip().replace(" ", "+")
    user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        avatar_url=f"https://api.dicebear.com/9.x/initials/svg?seed={avatar_seed}&backgroundColor=4f46e5",
    )
    db.add(user)
    db.flush()

    if user.role == UserRole.STUDENT:
        db.add(
            StudentProfile(
                user_id=user.id,
                institution=payload.institution,
                course=payload.course,
                bio=payload.bio,
            )
        )
        # Welcome bonus tokens for new students so they can try the platform immediately
        wallet, _ = top_up_wallet(
            db,
            user_id=user.id,
            amount=100,
            description="Bônus de boas-vindas ExtraAula",
            idempotency_key=f"welcome_bonus:user:{user.id}",
        )
    elif user.role == UserRole.TEACHER:
        db.add(
            TeacherProfile(
                user_id=user.id,
                headline=payload.headline or "Professor & Mentor Acadêmico",
                bio=payload.bio,
                avg_tokens_per_session=payload.avg_tokens_per_session or 60,
                qr_code_slug=_slugify(user.name),
            )
        )
        wallet = get_or_create_wallet(db, user.id)
    else:
        wallet = get_or_create_wallet(db, user.id)

    db.commit()
    db.refresh(user)
    db.refresh(wallet)

    token = create_access_token(user.id, user.role.value)
    return AuthResponse(
        access_token=token,
        user=UserSummary.model_validate(user),
        wallet=WalletOut.model_validate(wallet),
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise UnauthorizedError("E-mail ou senha incorretos.")
    if not user.is_active:
        raise UnauthorizedError("Conta desativada. Contate o suporte.")

    wallet = get_or_create_wallet(db, user.id)
    db.commit()
    db.refresh(wallet)

    token = create_access_token(user.id, user.role.value)
    return AuthResponse(
        access_token=token,
        user=UserSummary.model_validate(user),
        wallet=WalletOut.model_validate(wallet),
    )


@router.get("/me", response_model=AuthResponse)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wallet = get_or_create_wallet(db, current_user.id)
    db.commit()
    db.refresh(wallet)
    token = create_access_token(current_user.id, current_user.role.value)
    return AuthResponse(
        access_token=token,
        user=UserSummary.model_validate(current_user),
        wallet=WalletOut.model_validate(wallet),
    )


@router.post("/password-recovery")
def request_password_recovery(payload: PasswordRecoveryRequest, db: Session = Depends(get_db)):
    """
    Estrutura preparada para recuperação de senha.
    Em ambiente de demonstração, gera o token e o registra sem disparar SMTP real.
    """
    email = payload.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email))
    demo_token = None
    if user:
        demo_token = secrets.token_urlsafe(24)
        user.password_reset_token = demo_token
        user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
        db.commit()
    return {
        "message": "Se o e-mail estiver cadastrado, enviamos instruções de recuperação de acesso.",
        "demo_reset_token": demo_token,
    }


@router.post("/password-reset")
def confirm_password_reset(payload: PasswordResetConfirm, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.password_reset_token == payload.token))
    if not user or not user.password_reset_expires_at:
        raise DomainError("Token de recuperação inválido ou expirado.")
    exp = user.password_reset_expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise DomainError("Token de recuperação expirado.")

    user.password_hash = hash_password(payload.new_password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    db.commit()
    return {"message": "Senha redefinida com sucesso."}
