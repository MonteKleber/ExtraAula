export type UserRole = "STUDENT" | "TEACHER" | "ADMIN";
export type ServiceType = "TIRA_DUVIDAS" | "MENTORIA_PROFISSIONAL";
export type RequestStatus =
  | "CRIADA"
  | "PROPOSTA_ENVIADA"
  | "ACEITA"
  | "AGENDADA"
  | "EM_ANDAMENTO"
  | "FINALIZADA"
  | "RECUSADA"
  | "CANCELADA"
  | "EXPIRADA";

export type ProposalStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "SUPERSEDED";

export interface UserSummary {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Wallet {
  id: number;
  user_id: number;
  balance: number;
  locked_balance: number;
  updated_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserSummary;
  wallet?: Wallet | null;
}

export interface Subject {
  id: number;
  name: string;
  slug: string;
  category: string;
  description?: string | null;
  is_active: boolean;
}

export interface TeacherSubject {
  id: number;
  subject_id: number;
  subject_name: string;
  subject_category: string;
  specialty_note?: string | null;
}

export interface AvailabilitySlot {
  id?: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface TeacherCardData {
  user_id: number;
  teacher_profile_id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  headline: string;
  bio?: string | null;
  education?: string | null;
  experience_years: number;
  avg_tokens_per_session: number;
  is_available: boolean;
  rating_avg: number;
  rating_count: number;
  completed_sessions_count: number;
  qr_code_slug: string;
  qr_public_url: string;
  subjects: TeacherSubject[];
  availability_slots: AvailabilitySlot[];
}

export interface Proposal {
  id: number;
  request_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: UserRole;
  teacher_id?: number | null;
  teacher_name?: string | null;
  offered_tokens: number;
  suggested_datetime?: string | null;
  message?: string | null;
  status: ProposalStatus;
  created_at: string;
}

export interface ServiceRequest {
  id: number;
  student_id: number;
  student_name: string;
  teacher_id?: number | null;
  teacher_name?: string | null;
  subject_id: number;
  subject_name: string;
  service_type: ServiceType;
  title: string;
  description: string;
  duration_minutes: number;
  offered_tokens: number;
  agreed_tokens?: number | null;
  proposed_scheduled_at?: string | null;
  status: RequestStatus;
  session_id?: number | null;
  proposals: Proposal[];
  created_at: string;
  updated_at: string;
}

export interface SessionTimerState {
  session_id: number;
  status: RequestStatus;
  server_now: string;
  started_at?: string | null;
  ended_at?: string | null;
  planned_duration_seconds: number;
  elapsed_seconds: number;
  remaining_seconds: number;
  estimated_tokens_so_far: number;
  agreed_tokens: number;
}

export interface Review {
  id: number;
  session_id: number;
  reviewer_id: number;
  reviewer_name: string;
  reviewer_role: UserRole;
  reviewee_id: number;
  reviewee_name: string;
  rating: number;
  comment?: string | null;
  created_at: string;
}

export interface TutoringSession {
  id: number;
  request_id: number;
  request_title: string;
  service_type: ServiceType;
  student_id: number;
  student_name: string;
  teacher_id: number;
  teacher_name: string;
  subject_id: number;
  subject_name: string;
  status: RequestStatus;
  agreed_tokens: number;
  planned_duration_minutes: number;
  scheduled_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  actual_duration_seconds: number;
  charged_tokens: number;
  platform_fee_tokens: number;
  teacher_net_tokens: number;
  timer: SessionTimerState;
  reviews: Review[];
  created_at: string;
}

export interface ChatMessage {
  id: number;
  session_id: number;
  sender_id: number;
  sender_name: string;
  sender_role: UserRole;
  content: string;
  created_at: string;
}

export interface WalletTransaction {
  id: number;
  wallet_id: number;
  session_id?: number | null;
  request_id?: number | null;
  tx_type: string;
  amount: number;
  balance_after: number;
  locked_balance_after: number;
  description: string;
  created_at: string;
}

export interface WalletDetail {
  wallet: Wallet;
  transactions: WalletTransaction[];
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  kind: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AdminOverview {
  total_students: number;
  total_teachers: number;
  available_teachers: number;
  total_sessions_completed: number;
  total_sessions_cancelled: number;
  total_sessions_active: number;
  total_tokens_volume: number;
  platform_commission_tokens: number;
  avg_teacher_rating: number;
  requests_by_status: { status: string; count: number }[];
  sessions_by_subject: { subject: string; sessions: number; tokens: number }[];
}

export interface TeacherEarnings {
  available_balance: number;
  total_gross_tokens: number;
  total_platform_fee_tokens: number;
  total_net_tokens: number;
  completed_sessions: number;
  scheduled_escrow_tokens: number;
}
