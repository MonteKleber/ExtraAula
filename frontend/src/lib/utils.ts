import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "A combinar";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const DAY_NAMES = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];

export const STATUS_META: Record<
  string,
  { label: string; color: string; dot: string }
> = {
  CRIADA: { label: "Criada", color: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  PROPOSTA_ENVIADA: { label: "Em Negociação", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  ACEITA: { label: "Aceita", color: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500" },
  AGENDADA: { label: "Agendada", color: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500" },
  EM_ANDAMENTO: { label: "Em Andamento", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  FINALIZADA: { label: "Finalizada", color: "bg-zinc-100 text-zinc-700 border-zinc-200", dot: "bg-zinc-500" },
  RECUSADA: { label: "Recusada", color: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  CANCELADA: { label: "Cancelada", color: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  EXPIRADA: { label: "Expirada", color: "bg-stone-100 text-stone-600 border-stone-200", dot: "bg-stone-400" },
};
