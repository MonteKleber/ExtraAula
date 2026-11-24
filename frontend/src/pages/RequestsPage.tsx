import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Coins,
  Handshake,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { apiRequest } from "@/api/client";
import { AppShell } from "@/components/layout/AppShell";
import { RequestModal } from "@/components/marketplace/RequestModal";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Skeleton,
  StatusBadge,
  Textarea,
} from "@/components/ui/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { formatDateTime } from "@/lib/utils";
import type { Proposal, ServiceRequest, Subject, TutoringSession } from "@/types";

export function RequestsPage() {
  const { user, refreshMe } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modals
  const [newReqOpen, setNewReqOpen] = useState(false);
  const [counterTarget, setCounterTarget] = useState<ServiceRequest | null>(null);
  const [counterTokens, setCounterTokens] = useState<number>(60);
  const [counterDatetime, setCounterDatetime] = useState<string>("");
  const [counterMessage, setCounterMessage] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqs, subs] = await Promise.all([
        apiRequest<ServiceRequest[]>("/api/requests"),
        apiRequest<Subject[]>("/api/subjects"),
      ]);
      setRequests(reqs);
      setSubjects(subs);
    } catch (err: any) {
      toast("error", "Erro ao carregar negociações", err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAcceptProposal = async (proposal: Proposal) => {
    setBusyId(`accept-${proposal.id}`);
    try {
      const session = await apiRequest<TutoringSession>(
        `/api/proposals/${proposal.id}/accept`,
        { method: "POST" }
      );
      await refreshMe();
      toast(
        "success",
        "Acordo fechado!",
        `Sessão #${session.id} agendada por ${session.agreed_tokens} tokens (bloqueados em garantia).`
      );
      navigate(`/sessions/${session.id}`);
    } catch (err: any) {
      toast("error", "Não foi possível aceitar", err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectProposal = async (proposal: Proposal) => {
    setBusyId(`reject-${proposal.id}`);
    try {
      await apiRequest(`/api/proposals/${proposal.id}/reject`, {
        method: "POST",
      });
      toast("info", "Proposta recusada.");
      await loadData();
    } catch (err: any) {
      toast("error", "Erro ao recusar proposta", err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelRequest = async (reqId: number) => {
    setBusyId(`cancel-${reqId}`);
    try {
      await apiRequest(`/api/requests/${reqId}/cancel`, { method: "POST" });
      toast("info", "Solicitação cancelada.");
      await loadData();
    } catch (err: any) {
      toast("error", "Erro ao cancelar solicitação", err.message);
    } finally {
      setBusyId(null);
    }
  };

  const openCounterModal = (req: ServiceRequest) => {
    setCounterTarget(req);
    setCounterTokens(req.offered_tokens);
    setCounterDatetime("");
    setCounterMessage("");
  };

  const handleSendCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterTarget) return;
    setBusyId(`counter-${counterTarget.id}`);
    try {
      await apiRequest(`/api/requests/${counterTarget.id}/proposals`, {
        method: "POST",
        body: JSON.stringify({
          offered_tokens: Number(counterTokens),
          suggested_datetime: counterDatetime
            ? new Date(counterDatetime).toISOString()
            : null,
          message: counterMessage || undefined,
        }),
      });
      toast(
        "success",
        "Contraproposta enviada!",
        `Nova oferta de ${counterTokens} tokens registrada.`
      );
      setCounterTarget(null);
      await loadData();
    } catch (err: any) {
      toast("error", "Erro ao enviar contraproposta", err.message);
    } finally {
      setBusyId(null);
    }
  };

  const filtered = requests.filter((r) => {
    if (statusFilter === "ALL") return true;
    if (statusFilter === "OPEN")
      return r.status === "CRIADA" || r.status === "PROPOSTA_ENVIADA";
    if (statusFilter === "ACTIVE")
      return r.status === "AGENDADA" || r.status === "EM_ANDAMENTO";
    if (statusFilter === "CLOSED")
      return ["FINALIZADA", "RECUSADA", "CANCELADA", "EXPIRADA"].includes(
        r.status
      );
    return true;
  });

  return (
    <AppShell>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Central de Negociações (InDrive)
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {user?.role === "TEACHER"
              ? "Visualize solicitações direcionadas a você e pedidos abertos do marketplace. Aceite, recuse ou envie contrapropostas."
              : "Acompanhe suas solicitações, responda contrapropostas de professores e acesse suas sessões."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={loadData}>
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
          {user?.role === "STUDENT" && (
            <Button size="sm" onClick={() => setNewReqOpen(true)}>
              <Plus className="h-4 w-4" />
              Nova solicitação
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { key: "ALL", label: `Todas (${requests.length})` },
          {
            key: "OPEN",
            label: `Em negociação (${
              requests.filter((r) =>
                ["CRIADA", "PROPOSTA_ENVIADA"].includes(r.status)
              ).length
            })`,
          },
          {
            key: "ACTIVE",
            label: `Agendadas / Ativas (${
              requests.filter((r) =>
                ["AGENDADA", "EM_ANDAMENTO"].includes(r.status)
              ).length
            })`,
          },
          { key: "CLOSED", label: "Encerradas" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              statusFilter === tab.key
                ? "bg-indigo-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Request Cards */}
      <div className="mt-6 space-y-4">
        {loading ? (
          [1, 2].map((i) => (
            <Card key={i} className="p-5 space-y-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-14 w-full" />
            </Card>
          ))
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Handshake className="h-6 w-6" />}
            title="Nenhuma negociação neste filtro"
            description={
              user?.role === "STUDENT"
                ? "Crie uma nova solicitação no Marketplace para começar a negociar com professores."
                : "Quando alunos enviarem solicitações para suas disciplinas, elas aparecerão aqui."
            }
          />
        ) : (
          filtered.map((req) => {
            const canNegotiate =
              req.status === "CRIADA" || req.status === "PROPOSTA_ENVIADA";
            return (
              <Card key={req.id} className="p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={req.status} />
                      <Badge className="border-indigo-100 bg-indigo-50/70 text-indigo-700">
                        {req.subject_name}
                      </Badge>
                      <Badge>
                        {req.service_type === "TIRA_DUVIDAS"
                          ? "Tira-dúvidas"
                          : "Mentoria Profissional"}
                      </Badge>
                      {!req.teacher_id && (
                        <Badge className="border-violet-200 bg-violet-50 text-violet-700">
                          Solicitação Aberta
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      #{req.id} — {req.title}
                    </h3>
                    <p className="text-sm text-slate-600">{req.description}</p>
                    <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-500">
                      <span>
                        Aluno: <strong className="text-slate-700">{req.student_name}</strong>
                      </span>
                      {req.teacher_name && (
                        <span>
                          Professor:{" "}
                          <strong className="text-slate-700">{req.teacher_name}</strong>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {req.duration_minutes} min
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDateTime(req.proposed_scheduled_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3.5 py-2 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                        {req.agreed_tokens ? "Valor Fechado" : "Oferta Atual"}
                      </p>
                      <p className="flex items-center gap-1 font-mono text-lg font-bold text-amber-900">
                        <Coins className="h-4 w-4 text-amber-600" />
                        {req.agreed_tokens ?? req.offered_tokens}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {req.session_id && (
                        <Button
                          size="sm"
                          onClick={() => navigate(`/sessions/${req.session_id}`)}
                        >
                          Ir para sala
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canNegotiate && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openCounterModal(req)}
                        >
                          <Send className="h-3.5 w-3.5" />
                          Contraproposta
                        </Button>
                      )}
                      {canNegotiate && user?.role === "STUDENT" && (
                        <Button
                          size="sm"
                          variant="outlineDanger"
                          disabled={busyId === `cancel-${req.id}`}
                          onClick={() => handleCancelRequest(req.id)}
                        >
                          Cancelar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Proposal History */}
                {req.proposals.length > 0 && (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Histórico de Propostas ({req.proposals.length})
                    </p>
                    <div className="space-y-2">
                      {req.proposals.map((prop) => {
                        const isMine = prop.sender_id === user?.id;
                        const canRespond =
                          canNegotiate && prop.status === "PENDING" && !isMine;

                        return (
                          <div
                            key={prop.id}
                            className={`flex flex-col justify-between gap-3 rounded-xl border p-3 sm:flex-row sm:items-center ${
                              prop.status === "PENDING"
                                ? "border-indigo-200 bg-indigo-50/40"
                                : prop.status === "ACCEPTED"
                                ? "border-emerald-200 bg-emerald-50/40"
                                : "border-slate-200/70 bg-slate-50/50 opacity-80"
                            }`}
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-semibold text-slate-900">
                                  {prop.sender_name}
                                </span>
                                <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                                  {prop.sender_role === "TEACHER"
                                    ? "Professor"
                                    : "Aluno"}
                                </span>
                                <span className="font-mono font-bold text-indigo-700">
                                  {prop.offered_tokens} tokens
                                </span>
                                {prop.suggested_datetime && (
                                  <span className="text-slate-500">
                                    • {formatDateTime(prop.suggested_datetime)}
                                  </span>
                                )}
                                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                                  ({prop.status})
                                </span>
                              </div>
                              {prop.message && (
                                <p className="flex items-start gap-1.5 text-xs text-slate-600">
                                  <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                                  {prop.message}
                                </p>
                              )}
                            </div>

                            {canRespond && (
                              <div className="flex shrink-0 items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="success"
                                  disabled={busyId === `accept-${prop.id}`}
                                  onClick={() => handleAcceptProposal(prop)}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Aceitar ({prop.offered_tokens} tk)
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outlineDanger"
                                  disabled={busyId === `reject-${prop.id}`}
                                  onClick={() => handleRejectProposal(prop)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Recusar
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Counterproposal Modal */}
      <Modal
        open={Boolean(counterTarget)}
        onClose={() => setCounterTarget(null)}
        title="Enviar Contraproposta"
        description={
          counterTarget
            ? `Negociando "${counterTarget.title}" — oferta atual: ${counterTarget.offered_tokens} tokens.`
            : undefined
        }
      >
        <form onSubmit={handleSendCounter} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Novo valor (tokens)
              </label>
              <Input
                type="number"
                min={10}
                max={5000}
                required
                value={counterTokens}
                onChange={(e) => setCounterTokens(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Sugerir horário (opcional)
              </label>
              <Input
                type="datetime-local"
                value={counterDatetime}
                onChange={(e) => setCounterDatetime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Mensagem da contraproposta
            </label>
            <Textarea
              placeholder="Explique sua proposta de valor ou horário..."
              value={counterMessage}
              onChange={(e) => setCounterMessage(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCounterTarget(null)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={Boolean(busyId)}>
              <Send className="h-4 w-4" />
              Enviar Contraproposta
            </Button>
          </div>
        </form>
      </Modal>

      {newReqOpen && (
        <RequestModal
          open={newReqOpen}
          onClose={() => setNewReqOpen(false)}
          subjects={subjects}
          onCreated={() => loadData()}
        />
      )}
    </AppShell>
  );
}
