import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Coins,
  Filter,
  Plus,
  QrCode,
  Search,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { apiRequest } from "@/api/client";
import { AppShell } from "@/components/layout/AppShell";
import { RequestModal } from "@/components/marketplace/RequestModal";
import { TeacherQRCard } from "@/components/qr/TeacherQRCard";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Skeleton,
} from "@/components/ui/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import type { Subject, TeacherCardData } from "@/types";

export function MarketplacePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<TeacherCardData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [minRating, setMinRating] = useState("");

  // Modals
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherCardData | null>(null);
  const [qrTeacher, setQrTeacher] = useState<TeacherCardData | null>(null);

  useEffect(() => {
    apiRequest<Subject[]>("/api/subjects").then(setSubjects).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchTeachers = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (subjectId) params.set("subject_id", subjectId);
        if (availableOnly) params.set("available_only", "true");
        if (minRating) params.set("min_rating", minRating);
        if (search.trim()) params.set("q", search.trim());
        const data = await apiRequest<TeacherCardData[]>(
          `/api/marketplace/teachers?${params.toString()}`
        );
        setTeachers(data);
      } catch (err: any) {
        toast("error", "Erro ao carregar professores", err.message);
      } finally {
        setLoading(false);
      }
    };
    const timer = setTimeout(fetchTeachers, 180);
    return () => clearTimeout(timer);
  }, [subjectId, availableOnly, minRating, search, toast]);

  const openRequest = (teacher: TeacherCardData | null) => {
    if (!user) {
      toast("info", "Faça login como aluno para solicitar atendimento.");
      navigate("/login");
      return;
    }
    if (user.role !== "STUDENT") {
      toast("info", "Apenas perfis de Aluno podem enviar solicitações.");
      return;
    }
    setSelectedTeacher(teacher);
    setRequestModalOpen(true);
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
            <Sparkles className="h-3.5 w-3.5" />
            Marketplace em tempo real
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Professores & Mentores Disponíveis
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Escolha um especialista ou publique uma solicitação aberta para receber propostas em tokens.
          </p>
        </div>

        <Button onClick={() => openRequest(null)} size="lg">
          <Plus className="h-4 w-4" />
          Solicitação Aberta (InDrive)
        </Button>
      </div>

      {/* Filters Bar */}
      <Card className="mt-6 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, disciplina ou especialidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="md:col-span-3">
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Todas as disciplinas</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
              <option value="">Qualquer nota</option>
              <option value="4.5">★ 4.5 ou mais</option>
              <option value="4.0">★ 4.0 ou mais</option>
              <option value="3.5">★ 3.5 ou mais</option>
            </Select>
          </div>
          <div className="flex items-center md:col-span-2">
            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(e) => setAvailableOnly(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Online agora
            </label>
          </div>
        </div>
      </Card>

      {/* Teachers Grid */}
      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <Card key={n} className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-9 w-full" />
              </Card>
            ))}
          </div>
        ) : teachers.length === 0 ? (
          <EmptyState
            icon={<Filter className="h-6 w-6" />}
            title="Nenhum professor encontrado"
            description="Tente limpar os filtros ou publique uma solicitação aberta para receber ofertas de professores disponíveis."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setSubjectId("");
                  setAvailableOnly(false);
                  setMinRating("");
                }}
              >
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {teachers.map((t) => (
              <Card
                key={t.user_id}
                className="flex flex-col justify-between p-5 transition duration-150 hover:border-indigo-200 hover:shadow-elevated"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <img
                          src={
                            t.avatar_url ||
                            `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
                              t.name
                            )}`
                          }
                          alt={t.name}
                          className="h-12 w-12 rounded-full border border-slate-200 object-cover"
                        />
                        <span
                          className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${
                            t.is_available ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                          title={t.is_available ? "Disponível agora" : "Indisponível"}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-slate-900">
                          {t.name}
                        </h3>
                        <p className="line-clamp-1 text-xs text-slate-500">
                          {t.education || `${t.experience_years} anos de experiência`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setQrTeacher(t)}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                      title="Ver QR Code direto"
                    >
                      <QrCode className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Status + Rating + Avg tokens */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        t.is_available
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      {t.is_available ? "Disponível agora" : "Offline"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200/80">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {t.rating_avg.toFixed(1)} ({t.rating_count})
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                      <Users className="h-3 w-3" />
                      {t.completed_sessions_count} aulas
                    </span>
                  </div>

                  <p className="mt-3 text-xs font-medium text-slate-800">
                    {t.headline}
                  </p>
                  <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-500">
                    {t.bio}
                  </p>

                  {/* Subjects */}
                  <div className="mt-3.5 flex flex-wrap gap-1.5">
                    {t.subjects.map((s) => (
                      <Badge
                        key={s.id}
                        className="border-indigo-100 bg-indigo-50/70 text-[11px] text-indigo-700"
                      >
                        {s.subject_name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                  <div>
                    <p className="text-[11px] text-slate-400">Valor médio</p>
                    <p className="flex items-center gap-1 font-mono text-sm font-bold text-slate-900">
                      <Coins className="h-3.5 w-3.5 text-amber-500" />
                      {t.avg_tokens_per_session}{" "}
                      <span className="font-sans text-xs font-normal text-slate-500">
                        tokens
                      </span>
                    </p>
                  </div>
                  <Button size="sm" onClick={() => openRequest(t)}>
                    Solicitar atendimento
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Request Modal */}
      {requestModalOpen && (
        <RequestModal
          open={requestModalOpen}
          onClose={() => setRequestModalOpen(false)}
          subjects={subjects}
          teacher={selectedTeacher}
          onCreated={() => navigate("/requests")}
        />
      )}

      {/* Teacher QR Modal */}
      <Modal
        open={Boolean(qrTeacher)}
        onClose={() => setQrTeacher(null)}
        title={qrTeacher ? `QR Code — ${qrTeacher.name}` : "QR Code"}
      >
        {qrTeacher && (
          <TeacherQRCard
            teacherName={qrTeacher.name}
            qrSlug={qrTeacher.qr_code_slug}
          />
        )}
      </Modal>
    </AppShell>
  );
}
