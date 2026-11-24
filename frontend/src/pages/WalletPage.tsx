import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Lock,
  PlusCircle,
  ShieldCheck,
  Wallet as WalletIcon,
} from "lucide-react";
import { apiRequest } from "@/api/client";
import { AppShell } from "@/components/layout/AppShell";
import { Badge, Button, Card, Input, Skeleton } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { formatDateTime } from "@/lib/utils";
import type { WalletDetail } from "@/types";

const TOPUP_PACKAGES = [
  { amount: 50, label: "Pacote Rápido", tag: "1 tira-dúvidas" },
  { amount: 150, label: "Pacote Estudante", tag: "Mais popular" },
  { amount: 300, label: "Pacote Semestre", tag: "Melhor flexibilidade" },
  { amount: 500, label: "Pacote Mentoria Pro", tag: "Projetos & TCC" },
];

const TX_LABELS: Record<string, { label: string; tone: string; sign: string }> = {
  TOPUP: { label: "Compra Simulada", tone: "text-emerald-700 bg-emerald-50 border-emerald-200", sign: "+" },
  ESCROW_LOCK: { label: "Bloqueio Escrow", tone: "text-amber-800 bg-amber-50 border-amber-200", sign: "-" },
  ESCROW_RELEASE: { label: "Liquidação Sessão", tone: "text-indigo-700 bg-indigo-50 border-indigo-200", sign: "•" },
  ESCROW_REFUND: { label: "Estorno Escrow", tone: "text-sky-700 bg-sky-50 border-sky-200", sign: "+" },
  SESSION_PAYMENT: { label: "Repasse Professor", tone: "text-emerald-700 bg-emerald-50 border-emerald-200", sign: "+" },
  PLATFORM_FEE: { label: "Taxa Plataforma", tone: "text-slate-600 bg-slate-100 border-slate-200", sign: "•" },
};

export function WalletPage() {
  const { user, refreshMe } = useAuth();
  const { toast } = useToast();

  const [detail, setDetail] = useState<WalletDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [customAmount, setCustomAmount] = useState(100);
  const [buying, setBuying] = useState(false);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<WalletDetail>("/api/wallet");
      setDetail(data);
    } catch (err: any) {
      toast("error", "Erro ao carregar carteira", err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const handleTopUp = async (amount: number) => {
    setBuying(true);
    try {
      const idempotencyKey = `web-topup-${user?.id}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const updated = await apiRequest<WalletDetail>("/api/wallet/topup", {
        method: "POST",
        body: JSON.stringify({ amount, idempotency_key: idempotencyKey }),
      });
      setDetail(updated);
      await refreshMe();
      toast(
        "success",
        `+${amount} tokens adicionados!`,
        "Recarga simulada registrada no extrato com idempotência."
      );
    } catch (err: any) {
      toast("error", "Erro na compra de tokens", err.message);
    } finally {
      setBuying(false);
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Carteira de Tokens & Extrato
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tokens fictícios para demonstração do MVP com bloqueio em garantia (escrow) e transações ACID.
          </p>
        </div>
        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">
          <ShieldCheck className="h-3.5 w-3.5" />
          Proteção contra saldo negativo e duplicidade
        </Badge>
      </div>

      {loading || !detail ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* Balance Summary Cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="border-indigo-100 bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white">
              <div className="flex items-center justify-between text-indigo-100">
                <span className="text-xs font-medium uppercase tracking-wider">
                  Saldo Disponível
                </span>
                <WalletIcon className="h-4 w-4" />
              </div>
              <p className="mt-3 font-mono text-3xl font-bold">
                {detail.wallet.balance}{" "}
                <span className="font-sans text-sm font-normal text-indigo-100">
                  tokens
                </span>
              </p>
              <p className="mt-1 text-xs text-indigo-100/90">
                Livre para novas propostas ou saques simulados
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium uppercase tracking-wider">
                  Bloqueado em Garantia
                </span>
                <Lock className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-3 font-mono text-3xl font-bold text-slate-900">
                {detail.wallet.locked_balance}{" "}
                <span className="font-sans text-sm font-normal text-slate-500">
                  tokens
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Reservado para sessões agendadas/em andamento
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium uppercase tracking-wider">
                  Patrimônio Total
                </span>
                <Coins className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="mt-3 font-mono text-3xl font-bold text-slate-900">
                {detail.wallet.balance + detail.wallet.locked_balance}{" "}
                <span className="font-sans text-sm font-normal text-slate-500">
                  tokens
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {detail.transactions.length} movimentações registradas
              </p>
            </Card>
          </div>

          {/* Simulated Token Top-up (Students only) */}
          {user?.role === "STUDENT" && (
            <Card className="mt-6 p-6">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Compra Simulada de Tokens
                  </h2>
                  <p className="text-xs text-slate-500">
                    Adicione tokens fictícios instantaneamente para testar solicitações e negociações (sem cobrança real).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={10}
                    max={10000}
                    value={customAmount}
                    onChange={(e) => setCustomAmount(Number(e.target.value))}
                    className="w-28 font-mono"
                  />
                  <Button
                    disabled={buying || customAmount < 10}
                    onClick={() => handleTopUp(customAmount)}
                  >
                    <PlusCircle className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {TOPUP_PACKAGES.map((pkg) => (
                  <button
                    key={pkg.amount}
                    type="button"
                    disabled={buying}
                    onClick={() => handleTopUp(pkg.amount)}
                    className="group flex flex-col items-start rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-left transition hover:border-indigo-400 hover:bg-indigo-50/50"
                  >
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-indigo-600 shadow-subtle">
                      {pkg.tag}
                    </span>
                    <p className="mt-2 font-mono text-2xl font-bold text-slate-900">
                      +{pkg.amount}{" "}
                      <span className="font-sans text-xs font-medium text-slate-500">
                        tokens
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-slate-600">
                      {pkg.label}
                    </p>
                    <span className="mt-3 text-xs font-semibold text-indigo-600 group-hover:underline">
                      Creditar agora →
                    </span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Ledger Table */}
          <Card className="mt-6 overflow-hidden">
            <div className="border-b border-slate-200/80 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">
                Extrato de Transações
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200/80 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Data</th>
                    <th className="px-6 py-3">Tipo</th>
                    <th className="px-6 py-3">Descrição</th>
                    <th className="px-6 py-3 text-right">Valor</th>
                    <th className="px-6 py-3 text-right">Saldo Após</th>
                    <th className="px-6 py-3 text-right">Bloqueado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detail.transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-8 text-center text-xs text-slate-400"
                      >
                        Nenhuma transação registrada ainda.
                      </td>
                    </tr>
                  ) : (
                    detail.transactions.map((tx) => {
                      const meta = TX_LABELS[tx.tx_type] || {
                        label: tx.tx_type,
                        tone: "text-slate-700 bg-slate-100 border-slate-200",
                        sign: "",
                      };
                      const isPositive = meta.sign === "+";
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/70">
                          <td className="whitespace-nowrap px-6 py-3.5 text-xs text-slate-500">
                            {formatDateTime(tx.created_at)}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${meta.tone}`}
                            >
                              {isPositive ? (
                                <ArrowDownLeft className="h-3 w-3" />
                              ) : (
                                <ArrowUpRight className="h-3 w-3" />
                              )}
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-xs text-slate-700">
                            {tx.description}
                          </td>
                          <td
                            className={`whitespace-nowrap px-6 py-3.5 text-right font-mono text-xs font-bold ${
                              isPositive ? "text-emerald-700" : "text-slate-900"
                            }`}
                          >
                            {meta.sign}
                            {tx.amount} tk
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-right font-mono text-xs text-slate-700">
                            {tx.balance_after} tk
                          </td>
                          <td className="whitespace-nowrap px-6 py-3.5 text-right font-mono text-xs text-slate-500">
                            {tx.locked_balance_after} tk
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </AppShell>
  );
}
