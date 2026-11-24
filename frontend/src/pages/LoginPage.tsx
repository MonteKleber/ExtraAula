import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, KeyRound, Sparkles } from "lucide-react";
import { apiRequest } from "@/api/client";
import { Button, Card, Input, Modal } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

const DEMO_ACCOUNTS = [
  { label: "Aluno (Lucas Andrade)", email: "aluno1@extraaula.com", pass: "Aluno123!", role: "STUDENT" },
  { label: "Profa. Ana Clara", email: "prof.ana@extraaula.com", pass: "Prof123!", role: "TEACHER" },
  { label: "Prof. Carlos Lima", email: "prof.carlos@extraaula.com", pass: "Prof123!", role: "TEACHER" },
  { label: "Admin (Beatriz)", email: "admin@extraaula.com", pass: "Admin123!", role: "ADMIN" },
];

export function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const redirectByRole = (role: string) => {
    if (role === "ADMIN") navigate("/admin");
    else if (role === "TEACHER") navigate("/teacher");
    else navigate("/marketplace");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(email, password);
      toast("success", `Bem-vindo(a), ${res.user.name}!`);
      redirectByRole(res.user.role);
    } catch (err: any) {
      toast("error", "Falha ao entrar", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPass: string) => {
    setLoading(true);
    try {
      const res = await login(demoEmail, demoPass);
      toast("success", `Logado como ${res.user.name}`);
      redirectByRole(res.user.role);
    } catch (err: any) {
      toast("error", "Falha no login demo", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ message: string; demo_reset_token?: string }>(
        "/api/auth/password-recovery",
        {
          method: "POST",
          body: JSON.stringify({ email: recoveryEmail }),
        }
      );
      setResetToken(res.demo_reset_token || null);
      toast("info", "Solicitação registrada", res.message);
    } catch (err: any) {
      toast("error", "Erro na recuperação", err.message);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetToken) return;
    try {
      await apiRequest("/api/auth/password-reset", {
        method: "POST",
        body: JSON.stringify({ token: resetToken, new_password: newPassword }),
      });
      toast("success", "Senha redefinida com sucesso! Faça login.");
      setRecoveryOpen(false);
      setResetToken(null);
      setNewPassword("");
    } catch (err: any) {
      toast("error", "Erro ao redefinir senha", err.message);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFB] px-4 py-12">
      <Link to="/" className="mb-6 flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
          <Sparkles className="h-5 w-5" />
        </div>
        <span className="text-xl font-bold tracking-tight text-slate-900">
          Extra<span className="text-indigo-600">Aula</span>
        </span>
      </Link>

      <Card className="w-full max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-bold text-slate-900">Entrar na plataforma</h1>
        <p className="mt-1 text-sm text-slate-500">
          Acesse suas aulas, negociações e carteira de tokens.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              E-mail
            </label>
            <Input
              type="email"
              required
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-700">Senha</label>
              <button
                type="button"
                onClick={() => setRecoveryOpen(true)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
              >
                Esqueci minha senha
              </button>
            </div>
            <Input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>

        <div className="mt-6 border-t border-slate-200 pt-5">
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Acesso rápido (Demonstração)
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                disabled={loading}
                onClick={() => handleDemoLogin(acc.email, acc.pass)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs transition hover:border-indigo-300 hover:bg-indigo-50/50"
              >
                <p className="font-semibold text-slate-800">{acc.label}</p>
                <p className="truncate font-mono text-[10px] text-slate-500">
                  {acc.email}
                </p>
              </button>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Ainda não tem conta?{" "}
          <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Cadastre-se grátis
          </Link>
        </p>
      </Card>

      <Modal
        open={recoveryOpen}
        onClose={() => {
          setRecoveryOpen(false);
          setResetToken(null);
        }}
        title="Recuperação de acesso"
        description="Estrutura preparada para recuperação via e-mail (em modo MVP, o token demonstrativo é exibido na tela)."
      >
        {!resetToken ? (
          <form onSubmit={handleRequestRecovery} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Informe seu e-mail cadastrado
              </label>
              <Input
                type="email"
                required
                placeholder="aluno1@extraaula.com"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              <KeyRound className="h-4 w-4" />
              Gerar token de recuperação
            </Button>
          </form>
        ) : (
          <form onSubmit={handleConfirmReset} className="space-y-4">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs">
              <p className="font-semibold text-indigo-900">Token gerado (modo demo):</p>
              <p className="mt-1 break-all font-mono text-indigo-700">{resetToken}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Nova senha
              </label>
              <Input
                type="password"
                required
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              Confirmar nova senha
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
