import React, { useState } from "react";
import { Coins, Clock, Sparkles } from "lucide-react";
import { apiRequest } from "@/api/client";
import { Button, Input, Modal, Select, Textarea } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import type { ServiceRequest, ServiceType, Subject, TeacherCardData } from "@/types";

export function RequestModal({
  open,
  onClose,
  subjects,
  teacher,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  subjects: Subject[];
  teacher?: TeacherCardData | null;
  onCreated?: (req: ServiceRequest) => void;
}) {
  const { wallet, refreshMe } = useAuth();
  const { toast } = useToast();

  const defaultSubjectId =
    teacher?.subjects?.[0]?.subject_id || subjects[0]?.id || 1;

  const [subjectId, setSubjectId] = useState<number>(defaultSubjectId);
  const [serviceType, setServiceType] = useState<ServiceType>("TIRA_DUVIDAS");
  const [duration, setDuration] = useState<number>(25);
  const [offeredTokens, setOfferedTokens] = useState<number>(
    teacher?.avg_tokens_per_session || 60
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleTypeChange = (next: ServiceType) => {
    setServiceType(next);
    if (next === "TIRA_DUVIDAS" && duration > 30) setDuration(25);
    if (next === "MENTORIA_PROFISSIONAL" && duration < 30) setDuration(45);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await apiRequest<ServiceRequest>("/api/requests", {
        method: "POST",
        body: JSON.stringify({
          subject_id: Number(subjectId),
          service_type: serviceType,
          title,
          description,
          duration_minutes: Number(duration),
          offered_tokens: Number(offeredTokens),
          teacher_id: teacher ? teacher.user_id : null,
          proposed_scheduled_at: scheduledAt
            ? new Date(scheduledAt).toISOString()
            : null,
        }),
      });
      await refreshMe();
      toast(
        "success",
        "Solicitação enviada!",
        teacher
          ? `Proposta de ${offeredTokens} tokens enviada para ${teacher.name}.`
          : `Solicitação aberta publicada com oferta de ${offeredTokens} tokens.`
      );
      setTitle("");
      setDescription("");
      onCreated?.(created);
      onClose();
    } catch (err: any) {
      toast("error", "Erro ao criar solicitação", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const minDur = serviceType === "TIRA_DUVIDAS" ? 15 : 30;
  const maxDur = serviceType === "TIRA_DUVIDAS" ? 30 : 60;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        teacher
          ? `Solicitar atendimento com ${teacher.name}`
          : "Nova solicitação aberta no Marketplace"
      }
      description={
        teacher
          ? `Proponha seu valor em tokens (referência do professor: ${teacher.avg_tokens_per_session} tokens).`
          : "Professores disponíveis na disciplina poderão aceitar sua oferta ou enviar uma contraproposta estilo InDrive."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Disciplina
            </label>
            <Select
              value={subjectId}
              onChange={(e) => setSubjectId(Number(e.target.value))}
            >
              {(teacher && teacher.subjects.length > 0
                ? teacher.subjects.map((s) => ({
                    id: s.subject_id,
                    name: s.subject_name,
                  }))
                : subjects
              ).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Modalidade
            </label>
            <Select
              value={serviceType}
              onChange={(e) => handleTypeChange(e.target.value as ServiceType)}
            >
              <option value="TIRA_DUVIDAS">Tira-dúvidas (15 a 30 min)</option>
              <option value="MENTORIA_PROFISSIONAL">
                Mentoria Profissional (30 a 60 min)
              </option>
            </Select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Título da dúvida ou objetivo
          </label>
          <Input
            required
            minLength={4}
            placeholder="Ex: Resolução de lista de Integrais Duplas"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Descreva sua dúvida em detalhes
          </label>
          <Textarea
            required
            minLength={10}
            placeholder="Informe os tópicos, exercícios ou o que deseja revisar durante a sessão..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-700">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              Duração ({minDur}-{maxDur}m)
            </label>
            <Input
              type="number"
              min={minDur}
              max={maxDur}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-700">
              <Coins className="h-3.5 w-3.5 text-amber-500" />
              Sua oferta (tokens)
            </label>
            <Input
              type="number"
              min={10}
              max={5000}
              value={offeredTokens}
              onChange={(e) => setOfferedTokens(Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Horário sugerido
            </label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
        </div>

        {wallet && (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-600">Seu saldo disponível:</span>
            <span className="font-mono font-semibold text-slate-900">
              {wallet.balance} tokens
            </span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            <Sparkles className="h-4 w-4" />
            {submitting ? "Enviando..." : "Enviar Proposta"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
