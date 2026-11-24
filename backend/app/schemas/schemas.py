from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.state_machine import RequestStatus
from app.models.models import ProposalStatus, ServiceType, UserRole, WalletTxType


# ---------- Auth & Users ----------
class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=100)
    role: UserRole = UserRole.STUDENT
    institution: str | None = None
    course: str | None = None
    headline: str | None = None
    bio: str | None = None
    avg_tokens_per_session: int | None = Field(default=60, ge=10, le=5000)

    @field_validator("role")
    @classmethod
    def restrict_admin_signup(cls, v: UserRole) -> UserRole:
        if v == UserRole.ADMIN:
            raise ValueError("Cadastro público não permite perfil ADMIN.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class PasswordRecoveryRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=8)
    new_password: str = Field(min_length=6, max_length=100)


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    role: UserRole
    avatar_url: str | None = None
    is_active: bool = True
    created_at: datetime


class WalletOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    balance: int
    locked_balance: int
    updated_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserSummary
    wallet: WalletOut | None = None


# ---------- Subjects ----------
class SubjectBase(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    category: str = Field(default="Exatas", max_length=80)
    description: str | None = None


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    category: str | None = None
    description: str | None = None
    is_active: bool | None = None


class SubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    slug: str
    category: str
    description: str | None = None
    is_active: bool


# ---------- Teacher Profiles & Marketplace ----------
class AvailabilitySlotIn(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    is_active: bool = True


class AvailabilitySlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    day_of_week: int
    start_time: str
    end_time: str
    is_active: bool


class TeacherSubjectItem(BaseModel):
    subject_id: int
    specialty_note: str | None = None


class TeacherSubjectOut(BaseModel):
    id: int
    subject_id: int
    subject_name: str
    subject_category: str
    specialty_note: str | None = None


class TeacherProfileUpdate(BaseModel):
    headline: str | None = Field(default=None, max_length=180)
    bio: str | None = None
    education: str | None = Field(default=None, max_length=220)
    experience_years: int | None = Field(default=None, ge=0, le=60)
    avg_tokens_per_session: int | None = Field(default=None, ge=10, le=5000)
    is_available: bool | None = None
    subjects: list[TeacherSubjectItem] | None = None
    availability_slots: list[AvailabilitySlotIn] | None = None


class TeacherMarketplaceCard(BaseModel):
    user_id: int
    teacher_profile_id: int
    name: str
    email: str
    avatar_url: str | None = None
    headline: str
    bio: str | None = None
    education: str | None = None
    experience_years: int
    avg_tokens_per_session: int
    is_available: bool
    rating_avg: float
    rating_count: int
    completed_sessions_count: int
    qr_code_slug: str
    qr_public_url: str
    subjects: list[TeacherSubjectOut] = []
    availability_slots: list[AvailabilitySlotOut] = []


# ---------- Requests & Proposals (InDrive) ----------
class ServiceRequestCreate(BaseModel):
    subject_id: int
    service_type: ServiceType
    title: str = Field(min_length=4, max_length=180)
    description: str = Field(min_length=10, max_length=2000)
    duration_minutes: int = Field(ge=15, le=60)
    offered_tokens: int = Field(ge=10, le=5000)
    teacher_id: int | None = None
    proposed_scheduled_at: datetime | None = None


class ProposalCreate(BaseModel):
    offered_tokens: int = Field(ge=10, le=5000)
    suggested_datetime: datetime | None = None
    message: str | None = Field(default=None, max_length=600)


class ProposalOut(BaseModel):
    id: int
    request_id: int
    sender_id: int
    sender_name: str
    sender_role: UserRole
    teacher_id: int | None = None
    teacher_name: str | None = None
    offered_tokens: int
    suggested_datetime: datetime | None = None
    message: str | None = None
    status: ProposalStatus
    created_at: datetime


class ServiceRequestOut(BaseModel):
    id: int
    student_id: int
    student_name: str
    teacher_id: int | None = None
    teacher_name: str | None = None
    subject_id: int
    subject_name: str
    service_type: ServiceType
    title: str
    description: str
    duration_minutes: int
    offered_tokens: int
    agreed_tokens: int | None = None
    proposed_scheduled_at: datetime | None = None
    status: RequestStatus
    session_id: int | None = None
    proposals: list[ProposalOut] = []
    created_at: datetime
    updated_at: datetime


# ---------- Sessions & Chat ----------
class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


class MessageOut(BaseModel):
    id: int
    session_id: int
    sender_id: int
    sender_name: str
    sender_role: UserRole
    content: str
    created_at: datetime


class SessionTimerState(BaseModel):
    session_id: int
    status: RequestStatus
    server_now: datetime
    started_at: datetime | None = None
    ended_at: datetime | None = None
    planned_duration_seconds: int
    elapsed_seconds: int
    remaining_seconds: int
    estimated_tokens_so_far: int
    agreed_tokens: int


class ReviewOut(BaseModel):
    id: int
    session_id: int
    reviewer_id: int
    reviewer_name: str
    reviewer_role: UserRole
    reviewee_id: int
    reviewee_name: str
    rating: int
    comment: str | None = None
    created_at: datetime


class SessionOut(BaseModel):
    id: int
    request_id: int
    request_title: str
    service_type: ServiceType
    student_id: int
    student_name: str
    teacher_id: int
    teacher_name: str
    subject_id: int
    subject_name: str
    status: RequestStatus
    agreed_tokens: int
    planned_duration_minutes: int
    scheduled_at: datetime | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    actual_duration_seconds: int
    charged_tokens: int
    platform_fee_tokens: int
    teacher_net_tokens: int
    timer: SessionTimerState
    reviews: list[ReviewOut] = []
    created_at: datetime


# ---------- Wallet ----------
class TopUpRequest(BaseModel):
    amount: int = Field(ge=10, le=10000)
    idempotency_key: str | None = Field(default=None, max_length=120)


class WalletTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    wallet_id: int
    session_id: int | None = None
    request_id: int | None = None
    tx_type: WalletTxType
    amount: int
    balance_after: int
    locked_balance_after: int
    description: str
    created_at: datetime


class WalletDetailOut(BaseModel):
    wallet: WalletOut
    transactions: list[WalletTransactionOut]


# ---------- Reviews ----------
class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


# ---------- Notifications ----------
class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    message: str
    kind: str
    link: str | None = None
    is_read: bool
    created_at: datetime


# ---------- Admin Dashboard ----------
class StatusCount(BaseModel):
    status: str
    count: int


class SubjectMetric(BaseModel):
    subject: str
    sessions: int
    tokens: int


class AdminOverview(BaseModel):
    total_students: int
    total_teachers: int
    available_teachers: int
    total_sessions_completed: int
    total_sessions_cancelled: int
    total_sessions_active: int
    total_tokens_volume: int
    platform_commission_tokens: int
    avg_teacher_rating: float
    requests_by_status: list[StatusCount]
    sessions_by_subject: list[SubjectMetric]
