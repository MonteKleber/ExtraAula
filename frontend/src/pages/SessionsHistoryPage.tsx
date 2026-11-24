import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Clock,
  Coins,
  MessageSquare,
  Star,
} from "lucide-react";
import { apiRequest } from "@/api/client";
import { AppShell } from "@/components/layout/AppShell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  StatusBadge,
} from "@/components/ui/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime, formatDuration } from "@/lib/utils";
import type { TutoringSession } from "@/types";

export function SessionsHistoryPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<TutoringSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<TutoringSession[]>("/api/sessions")
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Meus Atendimentos & Histórico
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Acesse salas em andamento, sessões agendadas e o histórico com liquidação de tokens e avaliações.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {loading ? (
          [1, 2, 3].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-16 w-full" />
            </Card>
          ))
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="h-6 w-6" />}
            title="Nenhuma sessão registrada"
            description="Quando uma proposta for aceita nas negociações, sua sessão aparecerá aqui."
            action={
              <Link to="/requests">
                <Button>Ir para Negociações</Button>
              </Link>
            }
          />
        ) : (
          sessions.map((s) => {
            const myReview = s.reviews.find((r) => r.reviewer_id === user?.id);
            return (
              <Card
                key={s.id}
                className="flex flex-col justify-between gap-4 p-5 transition hover:border-indigo-200 sm:flex-row sm:items-center"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={s.status} />
                    <Badge className="border-indigo-100 bg-indigo-50/70 text-indigo-700">
                      {s.subject_name}
                    </Badge>
                    <span className="font-mono text-xs text-slate-400">
                      Sessão #{s.id}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    {s.request_title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span>
                      Aluno: <strong className="text-slate-700">{s.student_name}</strong>
                    </span>
                    <span>
                      Professor:{" "}
                      <strong className="text-slate-700">{s.teacher_name}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {s.status === "FINALIZADA"
                        ? `Duração real: ${formatDuration(s.actual_duration_seconds)}`
                        : `Previsto: ${s.planned_duration_minutes} min`}
                    </span>
                    <span>{formatDateTime(s.scheduled_at || s.created_at)}</span>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-slate-400">
                      {s.status === "FINALIZADA" ? "Cobrado" : "Acordado"}
                    </p>
                    <p className="flex items-center gap-1 font-mono text-sm font-bold text-slate-900">
                      <Coins className="h-3.5 w-3.5 text-amber-500" />
                      {s.status === "FINALIZADA" ? s.charged_tokens : s.agreed_tokens} tk
                    </p>
                  </div>

                  {s.status === "FINALIZADA" && !myReview && (
                    <Badge className="border-amber-200 bg-amber-50 text-amber-800">
                      <Star className="h-3 w-3" />
                      Avaliar pendente
                    </Badge>
                  )}

                  <Link to={`/sessions/${s.id}`}>
                    <Button
                      size="sm"
                      variant={
                        s.status === "EM_ANDAMENTO" || s.status === "AGENDADA"
                          ? "primary"
                          : "secondary"
                      }
                    >
                      {s.status === "FINALIZADA" || s.status === "CANCELADA"
                        ? "Ver detalhes"
                        : "Abrir sala"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
