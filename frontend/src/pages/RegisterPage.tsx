import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, Sparkles, UserCheck } from "lucide-react";
import { Button, Card, Input, Textarea } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import type { UserRole } from "@/types";
import { cn } from "@/lib/utils";

export function RegisterPage() {
  const { register } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [role, setRole] = useState<UserRole>("STUDENT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [institution, setInstitution] = useState("");
  const [course, setCourse] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [avgTokens, setAvgTokens] = useState(60);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await register({
        name,
        email,
        password,
        role,
        institution: role === "STUDENT" ? institution : undefined,
        course: role === "STUDENT" ? course : undefined,
        headline: role === "TEACHER" ? headline : undefined,
        bio: bio || undefined,
        avg_tokens_per_session: role === "TEACHER" ? Number(avgTokens) : undefined,
      });
      toast(
        "success",
        "Conta criada com sucesso!",
        role === "STUDENT"
          ? "Você recebeu 100 tokens de boas-vindas!"
          : "Configure suas disciplinas e disponibilidade."
      );
      navigate(res.user.role === "TEACHER" ? "/teacher" : "/marketplace");
    } catch (err: any) {
      toast("error", "Erro no cadastro", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAFB] px-4 py-10">
      <Link to="/" className="mb-6 flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
          <Sparkles className="h-5 w-5" />
        </div>
        <span className="text-xl font-bold tracking-tight text-slate-900">
          Extra<span className="text-indigo-600">Aula</span>
        </span>
      </Link>

      <Card className="w-full max-w-lg p-6 sm:p-8">
        <h1 className="text-xl font-bold text-slate-900">Criar conta gratuita</h1>
        <p className="mt-1 text-sm text-slate-500">
          Escolha seu perfil para começar no ExtraAula.
        </p>

        {/* Role Selector */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRole("STUDENT")}
            className={cn(
              "flex flex-col items-start rounded-xl border p-3.5 text-left transition",
              role === "STUDENT"
                ? "border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600"
                : "border-slate-200 hover:bg-slate-50"
            )}
          >
            <UserCheck className="h-5 w-5 text-indigo-600" />
            <span className="mt-2 text-sm font-semibold text-slate-900">
              Sou Aluno
            </span>
            <span className="text-xs text-slate-500">
              +100 tokens de boas-vindas
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRole("TEACHER")}
            className={cn(
              "flex flex-col items-start rounded-xl border p-3.5 text-left transition",
              role === "TEACHER"
                ? "border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-600"
                : "border-slate-200 hover:bg-slate-50"
            )}
          >
            <GraduationCap className="h-5 w-5 text-indigo-600" />
            <span className="mt-2 text-sm font-semibold text-slate-900">
              Sou Professor
            </span>
            <span className="text-xs text-slate-500">
              Defina horários, preço e QR Code
            </span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Nome completo
            </label>
            <Input
              required
              minLength={2}
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                E-mail
              </label>
              <Input
                type="email"
                required
                placeholder="nome@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Senha
              </label>
              <Input
                type="password"
                required
                minLength={6}
                placeholder="Mín. 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {role === "STUDENT" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Instituição (opcional)
                </label>
                <Input
                  placeholder="Ex: USP, UNICAMP..."
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Curso (opcional)
                </label>
                <Input
                  placeholder="Ex: Engenharia de Software"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Título profissional
                  </label>
                  <Input
                    required
                    placeholder="Ex: Mestre em Computação | Algoritmos & SQL"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Média (tokens)
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
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Resumo profissional
                </label>
                <Textarea
                  placeholder="Conte sua experiência acadêmica e como você ajuda os estudantes..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                />
              </div>
            </>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-500">
          Já possui conta?{" "}
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-700">
            Entrar agora
          </Link>
        </p>
      </Card>
    </div>
  );
}
