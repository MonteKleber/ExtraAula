import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Coins,
  GraduationCap,
  Sparkles,
  Star,
} from "lucide-react";
import { apiRequest } from "@/api/client";
import { RequestModal } from "@/components/marketplace/RequestModal";
import { Badge, Button, Card, Skeleton } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { DAY_NAMES, formatDateTime } from "@/lib/utils";
import type { Review, Subject, TeacherCardData } from "@/types";

export function PublicTeacherPage() {
  const { qrSlug } = useParams<{ qrSlug: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [teacher, setTeacher] = useState<TeacherCardData | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!qrSlug) return;
    setLoading(true);
    Promise.all([
      apiRequest<TeacherCardData>(`/api/marketplace/qr/${qrSlug}`),
      apiRequest<Subject[]>("/api/subjects"),
    ])
      .then(async ([t, subs]) => {
        setTeacher(t);
        setSubjects(subs);
        const revs = await apiRequest<Review[]>(
          `/api/marketplace/teachers/${t.user_id}/reviews`
        );
        setReviews(revs);
      })
      .catch((err: any) => setError(err.message))
      .finally(() => setLoading(false));
  }, [qrSlug]);

  const handleRequestClick = () => {
    if (!user) {
      toast("info", "Faça login como aluno para solicitar este atendimento.");
      navigate("/login");
      return;
    }
    if (user.role !== "STUDENT") {
      toast("info", "Apenas alunos podem solicitar atendimentos.");
      return;
    }
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB] px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Marketplace
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-bold text-slate-900">ExtraAula • Acesso QR Direto</span>
          </div>
        </div>

        {loading ? (
          <Card className="p-6 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </Card>
        ) : error || !teacher ? (
          <Card className="p-8 text-center">
            <h2 className="text-lg font-semibold text-slate-900">
              QR Code não encontrado
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {error || "O link informado é inválido ou o professor está inativo."}
            </p>
            <Link to="/marketplace" className="mt-4 inline-block">
              <Button>Explorar professores</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-5">
            <Card className="p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <img
                    src={teacher.avatar_url || ""}
                    alt={teacher.name}
                    className="h-16 w-16 rounded-2xl border border-slate-200 object-cover"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl font-bold text-slate-900">
                        {teacher.name}
                      </h1>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          teacher.is_available
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {teacher.is_available ? "Disponível agora" : "Offline"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{teacher.headline}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {teacher.rating_avg.toFixed(1)} ({teacher.rating_count} avaliações)
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5" />
                        {teacher.education || `${teacher.experience_years} anos exp.`}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-800">
                        <Coins className="h-3.5 w-3.5 text-amber-500" />
                        ~{teacher.avg_tokens_per_session} tokens
                      </span>
                    </div>
                  </div>
                </div>
                <Button size="lg" onClick={handleRequestClick}>
                  Solicitar atendimento
                </Button>
              </div>

              {teacher.bio && (
                <p className="mt-5 text-sm leading-relaxed text-slate-600">
                  {teacher.bio}
                </p>
              )}

              <div className="mt-6 grid grid-cols-1 gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Disciplinas & Especialidades
                  </h3>
                  <div className="mt-2.5 space-y-2">
                    {teacher.subjects.map((s) => (
                      <div key={s.id} className="rounded-lg border border-slate-200/70 bg-slate-50/70 px-3 py-2">
                        <p className="text-xs font-semibold text-slate-800">
                          {s.subject_name}
                        </p>
                        {s.specialty_note && (
                          <p className="text-[11px] text-slate-500">
                            {s.specialty_note}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Horários habituais
                  </h3>
                  <div className="mt-2.5 space-y-2">
                    {teacher.availability_slots.length === 0 ? (
                      <p className="text-xs text-slate-500">Sob consulta direta.</p>
                    ) : (
                      teacher.availability_slots.map((slot, i) => (
                        <div
                          key={slot.id ?? i}
                          className="flex items-center justify-between rounded-lg border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-xs"
                        >
                          <span className="flex items-center gap-1.5 font-medium text-slate-700">
                            <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                            {DAY_NAMES[slot.day_of_week]}
                          </span>
                          <span className="font-mono text-slate-600">
                            {slot.start_time} – {slot.end_time}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Reviews */}
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-slate-900">
                Avaliações de alunos ({reviews.length})
              </h3>
              <div className="mt-4 space-y-3">
                {reviews.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Ainda sem avaliações registradas.
                  </p>
                ) : (
                  reviews.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-800">
                          {r.reviewer_name}
                        </span>
                        <Badge className="border-amber-200 bg-amber-50 text-amber-800">
                          ★ {r.rating}/5
                        </Badge>
                      </div>
                      {r.comment && (
                        <p className="mt-1.5 text-xs text-slate-600">{r.comment}</p>
                      )}
                      <p className="mt-1 text-[10px] text-slate-400">
                        {formatDateTime(r.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {teacher && modalOpen && (
        <RequestModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          subjects={subjects}
          teacher={teacher}
          onCreated={() => navigate("/requests")}
        />
      )}
    </div>
  );
}
