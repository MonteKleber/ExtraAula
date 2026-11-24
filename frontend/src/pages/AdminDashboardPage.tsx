import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BookOpen,
  CheckCircle2,
  Coins,
  GraduationCap,
  Plus,
  RefreshCw,
  Star,
  Users,
  XCircle,
} from "lucide-react";
import { apiRequest } from "@/api/client";
import { AppShell } from "@/components/layout/AppShell";
import {
  Badge,
  Button,
  Card,
  Input,
  Skeleton,
  StatusBadge,
} from "@/components/ui/primitives";
import { useToast } from "@/contexts/ToastContext";
import { formatDateTime } from "@/lib/utils";
import type {
  AdminOverview,
  Subject,
  TeacherCardData,
  TutoringSession,
  UserSummary,
} from "@/types";

const PIE_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#0ea5e9", "#f43f5e", "#8b5cf6", "#64748b"];

type AdminTab = "overview" | "users" | "teachers" | "subjects" | "sessions" | "transactions";

export function AdminDashboardPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [loading, setLoading] = useState(true);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [teachers, setTeachers] = useState<TeacherCardData[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sessions, setSessions] = useState<TutoringSession[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

  // New subject form
  const [newSubName, setNewSubName] = useState("");
  const [newSubCat, setNewSubCat] = useState("Exatas");
  const [newSubDesc, setNewSubDesc] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, us, ts, subs, sess, txs] = await Promise.all([
        apiRequest<AdminOverview>("/api/admin/overview"),
        apiRequest<UserSummary[]>("/api/admin/users"),
        apiRequest<TeacherCardData[]>("/api/admin/teachers"),
        apiRequest<Subject[]>("/api/subjects?include_inactive=true"),
        apiRequest<TutoringSession[]>("/api/admin/sessions"),
        apiRequest<any[]>("/api/admin/transactions"),
      ]);
      setOverview(ov);
      setUsers(us);
      setTeachers(ts);
      setSubjects(subs);
      setSessions(sess);
      setTransactions(txs);
    } catch (err: any) {
      toast("error", "Erro ao carregar dashboard admin", err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleToggleUser = async (userId: number) => {
    try {
      await apiRequest(`/api/admin/users/${userId}/toggle-active`, {
        method: "PATCH",
      });
      toast("success", "Status do usuário atualizado.");
      await loadAll();
    } catch (err: any) {
      toast("error", "Erro ao alterar usuário", err.message);
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/api/subjects", {
        method: "POST",
        body: JSON.stringify({
          name: newSubName,
          category: newSubCat,
          description: newSubDesc || undefined,
        }),
      });
      toast("success", "Disciplina criada!");
      setNewSubName("");
      setNewSubDesc("");
      await loadAll();
    } catch (err: any) {
      toast("error", "Erro ao criar disciplina", err.message);
    }
  };

  const handleToggleSubject = async (sub: Subject) => {
    try {
      await apiRequest(`/api/subjects/${sub.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !sub.is_active }),
      });
      toast("success", `Disciplina ${sub.is_active ? "desativada" : "ativada"}.`);
      await loadAll();
    } catch (err: any) {
      toast("error", "Erro ao atualizar disciplina", err.message);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Dashboard Administrativo
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Indicadores operacionais, volume de tokens, comissão simulada e gestão da plataforma ExtraAula.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={loadAll}>
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar indicadores
        </Button>
      </div>

      {/* Navigation Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["overview", "Visão Geral & Gráficos"],
            ["users", `Usuários (${users.length})`],
            ["teachers", `Professores (${teachers.length})`],
            ["subjects", `Disciplinas (${subjects.length})`],
            ["sessions", `Atendimentos (${sessions.length})`],
            ["transactions", `Transações (${transactions.length})`],
          ] as [AdminTab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              tab === key
                ? "bg-indigo-600 text-white shadow-sm"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading || !overview ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <div className="mt-6">
          {tab === "overview" && (
            <div className="space-y-6">
              {/* 8 KPI Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: "Alunos Cadastrados",
                    value: overview.total_students,
                    icon: Users,
                    tone: "text-indigo-600 bg-indigo-50",
                  },
                  {
                    label: "Professores (Online)",
                    value: `${overview.total_teachers} (${overview.available_teachers})`,
                    icon: GraduationCap,
                    tone: "text-emerald-600 bg-emerald-50",
                  },
                  {
                    label: "Sessões Realizadas",
                    value: overview.total_sessions_completed,
                    icon: CheckCircle2,
                    tone: "text-sky-600 bg-sky-50",
                  },
                  {
                    label: "Sessões Canceladas",
                    value: overview.total_sessions_cancelled,
                    icon: XCircle,
                    tone: "text-rose-600 bg-rose-50",
                  },
                  {
                    label: "Volume de Tokens",
                    value: `${overview.total_tokens_volume} tk`,
                    icon: Coins,
                    tone: "text-amber-600 bg-amber-50",
                  },
                  {
                    label: "Comissão Simulada (15%)",
                    value: `${overview.platform_commission_tokens} tk`,
                    icon: Activity,
                    tone: "text-violet-600 bg-violet-50",
                  },
                  {
                    label: "Avaliação Média Prof.",
                    value: `★ ${overview.avg_teacher_rating.toFixed(2)}`,
                    icon: Star,
                    tone: "text-amber-600 bg-amber-50",
                  },
                  {
                    label: "Sessões Ativas/Agendadas",
                    value: overview.total_sessions_active,
                    icon: BookOpen,
                    tone: "text-indigo-600 bg-indigo-50",
                  },
                ].map((kpi) => {
                  const Icon = kpi.icon;
                  return (
                    <Card key={kpi.label} className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">
                          {kpi.label}
                        </span>
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.tone}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <p className="mt-2 font-mono text-2xl font-bold text-slate-900">
                        {kpi.value}
                      </p>
                    </Card>
                  );
                })}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <Card className="p-5 lg:col-span-7">
                  <h3 className="text-sm font-bold text-slate-900">
                    Tokens Movimentados e Sessões por Disciplina
                  </h3>
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overview.sessions_by_subject}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="subject"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          interval={0}
                          angle={-15}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                        <Tooltip />
                        <Bar
                          dataKey="tokens"
                          name="Tokens cobrados"
                          fill="#4f46e5"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-5 lg:col-span-5">
                  <h3 className="text-sm font-bold text-slate-900">
                    Solicitações por Estado (Máquina de Estados)
                  </h3>
                  <div className="mt-4 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={overview.requests_by_status}
                          dataKey="count"
                          nameKey="status"
                          cx="50%"
                          cy="50%"
                          outerRadius={86}
                          label={({ status, count }) => `${status} (${count})`}
                        >
                          {overview.requests_by_status.map((_entry, index) => (
                            <Cell
                              key={index}
                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {tab === "users" && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Nome</th>
                      <th className="px-5 py-3">E-mail</th>
                      <th className="px-5 py-3">Perfil</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Cadastro</th>
                      <th className="px-5 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3 font-semibold text-slate-900">{u.name}</td>
                        <td className="px-5 py-3 font-mono text-slate-600">{u.email}</td>
                        <td className="px-5 py-3">
                          <Badge>{u.role}</Badge>
                        </td>
                        <td className="px-5 py-3">
                          <Badge
                            className={
                              u.is_active
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-rose-200 bg-rose-50 text-rose-700"
                            }
                          >
                            {u.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {formatDateTime(u.created_at)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {u.role !== "ADMIN" && (
                            <Button
                              size="sm"
                              variant={u.is_active ? "outlineDanger" : "secondary"}
                              onClick={() => handleToggleUser(u.id)}
                            >
                              {u.is_active ? "Desativar" : "Reativar"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "teachers" && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Professor</th>
                      <th className="px-5 py-3">Disciplinas</th>
                      <th className="px-5 py-3">Disponibilidade</th>
                      <th className="px-5 py-3">Avaliação</th>
                      <th className="px-5 py-3">Sessões</th>
                      <th className="px-5 py-3">Rota QR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teachers.map((t) => (
                      <tr key={t.user_id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900">{t.name}</p>
                          <p className="text-slate-500">{t.email}</p>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap gap-1">
                            {t.subjects.map((s) => (
                              <Badge key={s.id}>{s.subject_name}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge
                            className={
                              t.is_available
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : ""
                            }
                          >
                            {t.is_available ? "Online" : "Offline"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 font-mono font-semibold text-amber-700">
                          ★ {t.rating_avg.toFixed(1)} ({t.rating_count})
                        </td>
                        <td className="px-5 py-3 font-mono">
                          {t.completed_sessions_count}
                        </td>
                        <td className="px-5 py-3">
                          <Link
                            to={`/t/${t.qr_code_slug}`}
                            className="font-mono text-indigo-600 hover:underline"
                          >
                            /t/{t.qr_code_slug}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "subjects" && (
            <div className="space-y-4">
              <Card className="p-5">
                <h3 className="text-sm font-bold text-slate-900">
                  Cadastrar Nova Disciplina
                </h3>
                <form
                  onSubmit={handleCreateSubject}
                  className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12"
                >
                  <div className="sm:col-span-4">
                    <Input
                      required
                      placeholder="Nome da disciplina"
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      required
                      placeholder="Categoria"
                      value={newSubCat}
                      onChange={(e) => setNewSubCat(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <Input
                      placeholder="Descrição resumida"
                      value={newSubDesc}
                      onChange={(e) => setNewSubDesc(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit" className="w-full">
                      <Plus className="h-4 w-4" />
                      Adicionar
                    </Button>
                  </div>
                </form>
              </Card>

              <Card className="overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Disciplina</th>
                      <th className="px-5 py-3">Categoria</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subjects.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900">{sub.name}</p>
                          <p className="text-slate-500">{sub.description}</p>
                        </td>
                        <td className="px-5 py-3">
                          <Badge>{sub.category}</Badge>
                        </td>
                        <td className="px-5 py-3">
                          <Badge
                            className={
                              sub.is_active
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-rose-200 bg-rose-50 text-rose-700"
                            }
                          >
                            {sub.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleToggleSubject(sub)}
                          >
                            {sub.is_active ? "Desativar" : "Ativar"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {tab === "sessions" && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Sessão</th>
                      <th className="px-5 py-3">Aluno / Professor</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Acordado</th>
                      <th className="px-5 py-3 text-right">Cobrado</th>
                      <th className="px-5 py-3 text-right">Comissão</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sessions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3">
                          <Link
                            to={`/sessions/${s.id}`}
                            className="font-semibold text-indigo-600 hover:underline"
                          >
                            #{s.id} — {s.request_title}
                          </Link>
                          <p className="text-slate-500">{s.subject_name}</p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-slate-800">{s.student_name}</p>
                          <p className="text-slate-500">{s.teacher_name}</p>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="px-5 py-3 text-right font-mono">
                          {s.agreed_tokens} tk
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-semibold">
                          {s.charged_tokens} tk
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-indigo-700">
                          {s.platform_fee_tokens} tk
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "transactions" && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Data</th>
                      <th className="px-5 py-3">Usuário</th>
                      <th className="px-5 py-3">Tipo</th>
                      <th className="px-5 py-3">Descrição</th>
                      <th className="px-5 py-3 text-right">Valor</th>
                      <th className="px-5 py-3 text-right">Saldo Após</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                          {formatDateTime(tx.created_at)}
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-800">{tx.user_name}</p>
                          <p className="text-[11px] text-slate-400">{tx.user_role}</p>
                        </td>
                        <td className="px-5 py-3">
                          <Badge>{tx.tx_type}</Badge>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{tx.description}</td>
                        <td className="whitespace-nowrap px-5 py-3 text-right font-mono font-bold text-slate-900">
                          {tx.amount} tk
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right font-mono text-slate-600">
                          {tx.balance_after} tk
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </AppShell>
  );
}
