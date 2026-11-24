import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Clock,
  Coins,
  Handshake,
  MessageSquare,
  QrCode,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";

export function LandingPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const quickDemo = async (email: string, password: string, dest: string) => {
    try {
      await login(email, password);
      toast("success", "Sessão demonstrativa iniciada!");
      navigate(dest);
    } catch (err: any) {
      toast("error", "Falha no login demo", err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      {/* Header */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Extra<span className="text-indigo-600">Aula</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/marketplace"
              className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:block"
            >
              Explorar professores
            </Link>
            {user ? (
              <Link to={user.role === "ADMIN" ? "/admin" : user.role === "TEACHER" ? "/teacher" : "/marketplace"}>
                <Button>Ir para plataforma</Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="secondary">Entrar</Button>
                </Link>
                <Link to="/register">
                  <Button>Começar grátis</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-200/70 bg-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(79,70,229,0.08),transparent_60%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3.5 py-1 text-xs font-semibold text-indigo-700">
              <Zap className="h-3.5 w-3.5" />
              EdTech Marketplace • Negociação InDrive em Tokens • Tempo Real
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-[54px] lg:leading-[1.1]">
              Reforço acadêmico e mentoria{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                sob demanda
              </span>{" "}
              com preço negociado.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Encontre professores disponíveis em tempo real, faça sua proposta em tokens,
              negocie livremente e entre na sala de atendimento com cronômetro oficial e
              garantia automática.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/marketplace">
                <Button size="lg">
                  Explorar professores
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/register">
                <Button size="lg" variant="secondary">
                  Quero ser aluno ou professor
                </Button>
              </Link>
            </div>
          </div>

          {/* Demo Quick Access Banner */}
          <div className="mx-auto mt-14 max-w-4xl">
            <Card className="border-indigo-100 bg-gradient-to-br from-white to-indigo-50/40 p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                    Demonstração instantânea (1 clique)
                  </p>
                  <h2 className="mt-0.5 text-base font-semibold text-slate-900">
                    Teste todos os perfis com dados reais populados no banco
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      quickDemo("aluno1@extraaula.com", "Aluno123!", "/marketplace")
                    }
                  >
                    Entrar como Aluno
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      quickDemo("prof.carlos@extraaula.com", "Prof123!", "/teacher")
                    }
                  >
                    Entrar como Professor
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      quickDemo("admin@extraaula.com", "Admin123!", "/admin")
                    }
                  >
                    Entrar como Admin
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Feature Pillars */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Clock,
              title: "Disponibilidade estilo Uber",
              desc: "Filtre professores online agora por disciplina, avaliação média e especialidade.",
            },
            {
              icon: Handshake,
              title: "Negociação livre estilo InDrive",
              desc: "Proponha o valor em tokens, receba contrapropostas de preço ou horário e feche acordo.",
            },
            {
              icon: Coins,
              title: "Carteira com Escrow ACID",
              desc: "Tokens ficam bloqueados ao agendar e são liberados ou estornados com proteção contra saldo negativo.",
            },
            {
              icon: MessageSquare,
              title: "Sala WebSocket + Cronômetro",
              desc: "Chat em tempo real com indicador de presença e cronômetro oficial calculado pelo servidor.",
            },
            {
              icon: Star,
              title: "Reputação verificada",
              desc: "Avaliações mútuas de 1 a 5 estrelas liberadas somente após a finalização da sessão.",
            },
            {
              icon: QrCode,
              title: "QR Code de atendimento direto",
              desc: "Cada professor gera seu QR Code público exclusivo para acesso instantâneo ao perfil.",
            },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title} className="p-5 transition hover:border-indigo-200">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {f.desc}
                </p>
              </Card>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-500">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4">
          <ShieldCheck className="h-4 w-4 text-indigo-600" />
          ExtraAula MVP • FastAPI + SQLAlchemy + WebSockets + React + TypeScript
        </div>
      </footer>
    </div>
  );
}
