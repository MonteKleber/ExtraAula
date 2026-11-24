import React, { useCallback, useEffect, useState } from "react";
import {
  Calendar,
  Coins,
  Plus,
  Power,
  Save,
  Star,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { apiRequest } from "@/api/client";
import { AppShell } from "@/components/layout/AppShell";
import { TeacherQRCard } from "@/components/qr/TeacherQRCard";
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui/primitives";
import { useToast } from "@/contexts/ToastContext";
import { DAY_NAMES, formatDateTime } from "@/lib/utils";
import type {
  AvailabilitySlot,
  Review,
  Subject,
  TeacherCardData,
  TeacherEarnings,
} from "@/types";

export function TeacherDashboardPage() {
  const { toast } = useToast();

  const [profile, setProfile] = useState<TeacherCardData | null>(null);
  const [earnings, setEarnings] = useState<TeacherEarnings | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable form state
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [education, setEducation] = useState("");
  const [experienceYears, setExperienceYears] = useState(1);
  const [avgTokens, setAvgTokens] = useState(60);
  const [isAvailable, setIsAvailable] = useState(true);
  const [selectedSubjects, setSelectedSubjects] = useState<
    { subject_id: number; specialty_note: string }[]
  >([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prof, earn, revs, subs] = await Promise.all([
        apiRequest<TeacherCardData>("/api/teachers/me/profile"),
        apiRequest<TeacherEarnings>("/api/teachers/me/earnings"),
        apiRequest<Review[]>("/api/teachers/me/reviews"),
        apiRequest<Subject[]>("/api/subjects"),
      ]);
      setProfile(prof);
      setEarnings(earn);
      setReviews(revs);
      setAllSubjects(subs);

      setHeadline(prof.headline);
      setBio(prof.bio || "");
      setEducation(prof.education || "");
      setExperienceYears(prof.experience_years);
      setAvgTokens(prof.avg_tokens_per_session);
      setIsAvailable(prof.is_available);
      setSelectedSubjects(
        prof.subjects.map((s) => ({
          subject_id: s.subject_id,
          specialty_note: s.specialty_note || "",
        }))
      );
      setSlots(prof.availability_slots);
    } catch (err: any) {
      toast("error", "Erro ao carregar painel do professor", err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleAvailabilityQuick = async () => {
    const next = !isAvailable;
    setIsAvailable(next);
    try {
      const updated = await apiRequest<TeacherCardData>(
        "/api/teachers/me/profile",
        {
          method: "PUT",
          body: JSON.stringify({ is_available: next }),
        }
      );
      setProfile(updated);
      toast(
        "success",
        next ? "Você está ONLINE no Marketplace!" : "Status alterado para Offline"
      );
    } catch (err: any) {
      setIsAvailable(!next);
      toast("error", "Erro ao atualizar disponibilidade", err.message);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await apiRequest<TeacherCardData>(
        "/api/teachers/me/profile",
        {
          method: "PUT",
          body: JSON.stringify({
            headline,
            bio,
            education,
            experience_years: Number(experienceYears),
            avg_tokens_per_session: Number(avgTokens),
            is_available: isAvailable,
            subjects: selectedSubjects,
            availability_slots: slots.map((s) => ({
              day_of_week: Number(s.day_of_week),
              start_time: s.start_time,
              end_time: s.end_time,
              is_active: s.is_active ?? true,
            })),
          }),
        }
      );
      setProfile(updated);
      toast("success", "Perfil profissional salvo com sucesso!");
    } catch (err: any) {
      toast("error", "Erro ao salvar perfil", err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSubject = (subjectId: number) => {
    setSelectedSubjects((prev) =>
      prev.some((s) => s.subject_id === subjectId)
        ? prev.filter((s) => s.subject_id !== subjectId)
        : [...prev, { subject_id: subjectId, specialty_note: "" }]
    );
  };

  const addSlot = () => {
    setSlots((prev) => [
      ...prev,
      { day_of_week: 0, start_time: "18:00", end_time: "21:00", is_active: true },
    ]);
  };

  if (loading || !profile) {
    return (
      <AppShell>
        <Skeleton className="h-96 w-full" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Header + Uber-style Online Switch */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Painel do Professor
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Gerencie sua disponibilidade em tempo real, disciplinas, ganhos e QR Code direto.
          </p>
        </div>

        <button
          onClick={toggleAvailabilityQuick}
          className={`inline-flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-subtle transition ${
            isAvailable
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Power
            className={`h-4 w-4 ${
              isAvailable ? "text-emerald-600" : "text-slate-400"
            }`}
          />
          {isAvailable ? "Online — Recebendo alunos" : "Offline — Indisponível"}
        </button>
      </div>

      {/* Earnings KPIs */}
      {earnings && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Saldo Disponível</p>
            <p className="mt-1.5 flex items-center gap-1.5 font-mono text-2xl font-bold text-slate-900">
              <Coins className="h-5 w-5 text-amber-500" />
              {earnings.available_balance} tk
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Ganhos Líquidos</p>
            <p className="mt-1.5 flex items-center gap-1.5 font-mono text-2xl font-bold text-emerald-700">
              <TrendingUp className="h-5 w-5" />
              {earnings.total_net_tokens} tk
            </p>
            <p className="text-[11px] text-slate-400">
              Bruto: {earnings.total_gross_tokens} tk • Taxa: {earnings.total_platform_fee_tokens} tk
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Agendadas (Escrow)</p>
            <p className="mt-1.5 font-mono text-2xl font-bold text-indigo-700">
              {earnings.scheduled_escrow_tokens} tk
            </p>
            <p className="text-[11px] text-slate-400">
              {earnings.completed_sessions} sessões finalizadas
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium text-slate-500">Reputação Média</p>
            <p className="mt-1.5 flex items-center gap-1.5 font-mono text-2xl font-bold text-amber-600">
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
              {profile.rating_avg.toFixed(1)}
            </p>
            <p className="text-[11px] text-slate-400">
              {profile.rating_count} avaliações recebidas
            </p>
          </Card>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Profile Editor */}
        <form onSubmit={handleSaveProfile} className="space-y-5 lg:col-span-8">
          <Card className="p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              Perfil Profissional
            </h2>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Título / Headline
              </label>
              <Input
                required
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Biografia & Metodologia
              </label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Formação acadêmica
                </label>
                <Input
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Anos de experiência
                </label>
                <Input
                  type="number"
                  min={0}
                  max={60}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Valor médio (tokens)
                </label>
                <Input
                  type="number"
                  min={10}
                  max={5000}
                  value={avgTokens}
                  onChange={(e) => setAvgTokens(Number(e.target.value))}
                />
              </div>
            </div>
          </Card>

          {/* Subjects & Specialties */}
          <Card className="p-6">
            <h2 className="text-base font-bold text-slate-900">
              Disciplinas & Especialidades
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Selecione as disciplinas em que você atende no Marketplace.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {allSubjects.map((sub) => {
                const chosen = selectedSubjects.find(
                  (s) => s.subject_id === sub.id
                );
                return (
                  <div
                    key={sub.id}
                    className={`rounded-xl border p-3 transition ${
                      chosen
                        ? "border-indigo-300 bg-indigo-50/40"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={Boolean(chosen)}
                        onChange={() => toggleSubject(sub.id)}
                        className="h-3.5 w-3.5 rounded text-indigo-600"
                      />
                      {sub.name}
                    </label>
                    {chosen && (
                      <Input
                        className="mt-2 h-8 text-xs"
                        placeholder="Especialidade (ex: Integrais, Grafos...)"
                        value={chosen.specialty_note}
                        onChange={(e) =>
                          setSelectedSubjects((prev) =>
                            prev.map((item) =>
                              item.subject_id === sub.id
                                ? { ...item, specialty_note: e.target.value }
                                : item
                            )
                          )
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Availability Slots */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Janelas de Disponibilidade
                </h2>
                <p className="text-xs text-slate-500">
                  Informe seus horários preferenciais de atendimento.
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={addSlot}>
                <Plus className="h-3.5 w-3.5" />
                Adicionar horário
              </Button>
            </div>

            <div className="mt-4 space-y-2.5">
              {slots.map((slot, idx) => (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                >
                  <Calendar className="h-4 w-4 text-slate-400" />
                  <Select
                    className="w-36"
                    value={slot.day_of_week}
                    onChange={(e) =>
                      setSlots((prev) =>
                        prev.map((s, i) =>
                          i === idx
                            ? { ...s, day_of_week: Number(e.target.value) }
                            : s
                        )
                      )
                    }
                  >
                    {DAY_NAMES.map((name, dow) => (
                      <option key={dow} value={dow}>
                        {name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="time"
                    className="w-28"
                    value={slot.start_time}
                    onChange={(e) =>
                      setSlots((prev) =>
                        prev.map((s, i) =>
                          i === idx ? { ...s, start_time: e.target.value } : s
                        )
                      )
                    }
                  />
                  <span className="text-xs text-slate-400">até</span>
                  <Input
                    type="time"
                    className="w-28"
                    value={slot.end_time}
                    onChange={(e) =>
                      setSlots((prev) =>
                        prev.map((s, i) =>
                          i === idx ? { ...s, end_time: e.target.value } : s
                        )
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSlots((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <Button type="submit" size="lg" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </Card>
        </form>

        {/* Right column: QR Code + Reviews */}
        <div className="space-y-5 lg:col-span-4">
          <TeacherQRCard
            teacherName={profile.name}
            qrSlug={profile.qr_code_slug}
          />

          <Card className="p-5">
            <h3 className="text-sm font-bold text-slate-900">
              Avaliações Recebidas ({reviews.length})
            </h3>
            <div className="mt-3 space-y-2.5">
              {reviews.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Você ainda não recebeu avaliações.
                </p>
              ) : (
                reviews.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">
                        {r.reviewer_name}
                      </span>
                      <Badge className="border-amber-200 bg-amber-50 text-amber-800">
                        ★ {r.rating}/5
                      </Badge>
                    </div>
                    {r.comment && (
                      <p className="mt-1.5 text-slate-600">{r.comment}</p>
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
      </div>
    </AppShell>
  );
}
