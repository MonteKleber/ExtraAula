import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Coins,
  Play,
  Send,
  ShieldCheck,
  Square,
  Star,
  Users,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { apiRequest, getToken, getWsUrl } from "@/api/client";
import { AppShell } from "@/components/layout/AppShell";
import {
  Badge,
  Button,
  Card,
  Input,
  Skeleton,
  StatusBadge,
  Textarea,
} from "@/components/ui/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { formatDuration, formatTime } from "@/lib/utils";
import type {
  ChatMessage,
  SessionTimerState,
  TutoringSession,
} from "@/types";

export function SessionRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, refreshMe } = useAuth();
  const { toast } = useToast();

  const [session, setSession] = useState<TutoringSession | null>(null);
  const [timer, setTimer] = useState<SessionTimerState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<
    { user_id: number; name: string; role: string }[]
  >([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  // Review state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [sess, msgs] = await Promise.all([
        apiRequest<TutoringSession>(`/api/sessions/${sessionId}`),
        apiRequest<ChatMessage[]>(`/api/sessions/${sessionId}/messages`),
      ]);
      setSession(sess);
      setTimer(sess.timer);
      setMessages(msgs);
    } catch (err: any) {
      toast("error", "Erro ao carregar sessão", err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId, toast]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Connect WebSocket for real-time chat, presence & authoritative server timer
  useEffect(() => {
    if (!sessionId) return;
    const token = getToken();
    if (!token) return;

    let closed = false;
    let reconnectTimer: number | undefined;

    const connect = () => {
      const url = getWsUrl(
        `/ws/sessions/${sessionId}?token=${encodeURIComponent(token)}`
      );
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!closed) setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "message" && data.message) {
            setMessages((prev) =>
              prev.some((m) => m.id === data.message.id)
                ? prev
                : [...prev, data.message]
            );
          } else if (data.type === "timer_tick" && data.timer) {
            setTimer(data.timer);
          } else if (data.type === "presence" && data.online_users) {
            setOnlineUsers(data.online_users);
          } else if (data.type === "session_status" && data.session) {
            setSession(data.session);
            setTimer(data.session.timer);
            refreshMe();
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!closed) {
          setWsConnected(false);
          reconnectTimer = window.setTimeout(connect, 2500);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [sessionId, refreshMe]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || !sessionId) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", content }));
      setText("");
      return;
    }

    // REST fallback if WS is reconnecting
    try {
      const msg = await apiRequest<ChatMessage>(
        `/api/sessions/${sessionId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ content }),
        }
      );
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
      setText("");
    } catch (err: any) {
      toast("error", "Erro ao enviar mensagem", err.message);
    }
  };

  const handleStart = async () => {
    if (!sessionId) return;
    setActionBusy(true);
    try {
      const updated = await apiRequest<TutoringSession>(
        `/api/sessions/${sessionId}/start`,
        { method: "POST" }
      );
      setSession(updated);
      setTimer(updated.timer);
      toast("success", "Sessão iniciada!", "Cronômetro oficial do servidor ativo.");
    } catch (err: any) {
      toast("error", "Erro ao iniciar sessão", err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleFinish = async () => {
    if (!sessionId) return;
    setActionBusy(true);
    try {
      const updated = await apiRequest<TutoringSession>(
        `/api/sessions/${sessionId}/finish`,
        { method: "POST" }
      );
      setSession(updated);
      setTimer(updated.timer);
      await refreshMe();
      toast(
        "success",
        "Sessão finalizada e liquidada!",
        `Valor cobrado: ${updated.charged_tokens} tokens.`
      );
    } catch (err: any) {
      toast("error", "Erro ao encerrar sessão", err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!sessionId) return;
    setActionBusy(true);
    try {
      const updated = await apiRequest<TutoringSession>(
        `/api/sessions/${sessionId}/cancel`,
        { method: "POST" }
      );
      setSession(updated);
      setTimer(updated.timer);
      await refreshMe();
      toast(
        "info",
        "Sessão cancelada",
        "Os tokens reservados foram estornados à carteira do aluno."
      );
    } catch (err: any) {
      toast("error", "Erro ao cancelar sessão", err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) return;
    setReviewBusy(true);
    try {
      await apiRequest(`/api/sessions/${sessionId}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating, comment: comment || undefined }),
      });
      toast("success", "Avaliação enviada com sucesso!");
      setComment("");
      await loadSession();
    } catch (err: any) {
      toast("error", "Erro ao enviar avaliação", err.message);
    } finally {
      setReviewBusy(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <Skeleton className="h-96 w-full" />
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell>
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-600">Sessão não encontrada.</p>
          <Link to="/sessions" className="mt-4 inline-block">
            <Button>Voltar aos atendimentos</Button>
          </Link>
        </Card>
      </AppShell>
    );
  }

  const myReview = session.reviews.find((r) => r.reviewer_id === user?.id);
  const canReview =
    session.status === "FINALIZADA" &&
    !myReview &&
    user &&
    (user.id === session.student_id || user.id === session.teacher_id);

  const progressPct = timer
    ? Math.min(
        100,
        Math.round(
          (timer.elapsed_seconds / Math.max(1, timer.planned_duration_seconds)) *
            100
        )
      )
    : 0;

  return (
    <AppShell>
      {/* Top Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/sessions"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900">
                {session.request_title}
              </h1>
              <StatusBadge status={session.status} />
            </div>
            <p className="text-xs text-slate-500">
              {session.subject_name} • Aluno: {session.student_name} • Professor:{" "}
              {session.teacher_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
              wsConnected
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {wsConnected ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            {wsConnected ? "WebSocket Conectado" : "Reconectando..."}
          </span>
          <Badge>
            <Users className="h-3 w-3 text-indigo-600" />
            {onlineUsers.length} na sala
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Chat Column */}
        <Card className="flex h-[580px] flex-col overflow-hidden lg:col-span-8">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Sala de Atendimento em Tempo Real
            </span>
            <span className="font-mono text-xs text-slate-400">
              Sessão #{session.id}
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-[#FAFAFB] p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                <p className="text-sm font-medium text-slate-500">
                  Sala pronta para o atendimento
                </p>
                <p className="mt-1 text-xs">
                  Envie uma mensagem para começar a conversar em tempo real.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isMine = m.sender_id === user?.id;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${
                      isMine ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="font-medium text-slate-700">
                        {m.sender_name}
                      </span>
                      <span className="rounded bg-slate-200/70 px-1 py-0.2 text-[9px] font-semibold uppercase">
                        {m.sender_role === "TEACHER" ? "Prof" : "Aluno"}
                      </span>
                      <span>{formatTime(m.created_at)}</span>
                    </div>
                    <div
                      className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm shadow-subtle ${
                        isMine
                          ? "rounded-tr-sm bg-indigo-600 text-white"
                          : "rounded-tl-sm border border-slate-200 bg-white text-slate-800"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words leading-relaxed">
                        {m.content}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
          >
            <Input
              placeholder={
                session.status === "CANCELADA"
                  ? "Sessão cancelada — chat somente leitura"
                  : "Digite sua mensagem..."
              }
              disabled={session.status === "CANCELADA"}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button
              type="submit"
              disabled={!text.trim() || session.status === "CANCELADA"}
            >
              <Send className="h-4 w-4" />
              Enviar
            </Button>
          </form>
        </Card>

        {/* Side Control Panel */}
        <div className="space-y-4 lg:col-span-4">
          {/* Server-Authoritative Timer Card */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Clock className="h-3.5 w-3.5 text-indigo-600" />
                Cronômetro Oficial (Servidor)
              </span>
              {session.status === "EM_ANDAMENTO" && (
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>

            <div className="mt-4 rounded-xl bg-slate-950 p-4 text-center text-white">
              <p className="font-mono text-3xl font-bold tracking-wider">
                {formatDuration(timer?.elapsed_seconds ?? 0)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Previsto: {session.planned_duration_minutes} min • Restante:{" "}
                <span className="font-mono text-slate-200">
                  {formatDuration(timer?.remaining_seconds ?? 0)}
                </span>
              </p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <p className="text-slate-500">Escrow bloqueado</p>
                <p className="mt-0.5 flex items-center gap-1 font-mono text-sm font-bold text-slate-900">
                  <Coins className="h-3.5 w-3.5 text-amber-500" />
                  {session.agreed_tokens} tk
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <p className="text-slate-500">
                  {session.status === "FINALIZADA"
                    ? "Total cobrado"
                    : "Estimado agora"}
                </p>
                <p className="mt-0.5 font-mono text-sm font-bold text-indigo-700">
                  {session.status === "FINALIZADA"
                    ? session.charged_tokens
                    : timer?.estimated_tokens_so_far ?? 0}{" "}
                  tk
                </p>
              </div>
            </div>

            {/* Session Controls */}
            <div className="mt-4 space-y-2">
              {session.status === "AGENDADA" && (
                <Button
                  className="w-full"
                  variant="success"
                  disabled={actionBusy}
                  onClick={handleStart}
                >
                  <Play className="h-4 w-4" />
                  Iniciar Atendimento
                </Button>
              )}

              {session.status === "EM_ANDAMENTO" && (
                <Button
                  className="w-full"
                  disabled={actionBusy}
                  onClick={handleFinish}
                >
                  <Square className="h-4 w-4" />
                  Finalizar e Liquidar Tokens
                </Button>
              )}

              {(session.status === "AGENDADA" ||
                session.status === "EM_ANDAMENTO") && (
                <Button
                  className="w-full"
                  variant="outlineDanger"
                  disabled={actionBusy}
                  onClick={handleCancel}
                >
                  <XCircle className="h-4 w-4" />
                  Cancelar e Estornar Escrow
                </Button>
              )}
            </div>
          </Card>

          {/* Financial Settlement Card (after finish) */}
          {session.status === "FINALIZADA" && (
            <Card className="border-emerald-200 bg-emerald-50/40 p-5">
              <div className="flex items-center gap-2 text-emerald-800">
                <ShieldCheck className="h-4 w-4" />
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  Liquidação ACID Concluída
                </h3>
              </div>
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-slate-600">Tempo oficial</dt>
                  <dd className="font-mono font-semibold text-slate-900">
                    {formatDuration(session.actual_duration_seconds)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Valor cobrado</dt>
                  <dd className="font-mono font-semibold text-slate-900">
                    {session.charged_tokens} tokens
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Estornado ao aluno</dt>
                  <dd className="font-mono font-semibold text-emerald-700">
                    +{session.agreed_tokens - session.charged_tokens} tokens
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-600">Taxa plataforma (15%)</dt>
                  <dd className="font-mono text-slate-700">
                    {session.platform_fee_tokens} tokens
                  </dd>
                </div>
                <div className="flex justify-between border-t border-emerald-200/70 pt-1.5">
                  <dt className="font-semibold text-slate-800">
                    Repasse líquido professor
                  </dt>
                  <dd className="font-mono font-bold text-emerald-800">
                    +{session.teacher_net_tokens} tokens
                  </dd>
                </div>
              </dl>
            </Card>
          )}

          {/* Mutual Review Card */}
          <Card className="p-5">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Star className="h-4 w-4 text-amber-500" />
              Avaliações da Sessão
            </h3>

            {canReview && (
              <form onSubmit={handleSubmitReview} className="mt-3 space-y-3">
                <p className="text-xs text-slate-500">
                  Avalie{" "}
                  <strong>
                    {user?.id === session.student_id
                      ? session.teacher_name
                      : session.student_name}
                  </strong>{" "}
                  de 1 a 5 estrelas:
                </p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1 transition hover:scale-110"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-300"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 font-mono text-xs font-bold text-slate-700">
                    {rating}/5
                  </span>
                </div>
                <Textarea
                  placeholder="Deixe um comentário opcional sobre o atendimento..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                <Button type="submit" size="sm" className="w-full" disabled={reviewBusy}>
                  <CheckCircle2 className="h-4 w-4" />
                  {reviewBusy ? "Enviando..." : "Enviar Avaliação"}
                </Button>
              </form>
            )}

            {session.status !== "FINALIZADA" && (
              <p className="mt-2 text-xs text-slate-500">
                As avaliações são liberadas automaticamente após a finalização da sessão.
              </p>
            )}

            {session.reviews.length > 0 && (
              <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3">
                {session.reviews.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        {r.reviewer_name}
                      </span>
                      <span className="font-mono font-bold text-amber-600">
                        ★ {r.rating}/5
                      </span>
                    </div>
                    {r.comment && (
                      <p className="mt-1 text-slate-600">{r.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
