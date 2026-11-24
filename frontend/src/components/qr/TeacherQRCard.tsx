import { QRCodeSVG } from "qrcode.react";
import { Copy, ExternalLink, QrCode } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { useToast } from "@/contexts/ToastContext";

export function TeacherQRCard({
  teacherName,
  qrSlug,
  compact = false,
}: {
  teacherName: string;
  qrSlug: string;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const publicUrl = `${window.location.origin}/t/${qrSlug}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast("success", "Link copiado!", publicUrl);
    } catch {
      toast("info", "Copie o link do QR Code", publicUrl);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <QrCode className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">
              QR Code de Atendimento Direto
            </h4>
            <p className="text-xs text-slate-500">
              Escaneie para abrir o perfil de {teacherName}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <QRCodeSVG
            value={publicUrl}
            size={compact ? 136 : 168}
            bgColor="#ffffff"
            fgColor="#1e1b4b"
            level="M"
          />
        </div>
        <p className="mt-3 font-mono text-xs text-slate-500">/t/{qrSlug}</p>
        <div className="mt-3 flex w-full gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={copyLink}>
            <Copy className="h-3.5 w-3.5" />
            Copiar link
          </Button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir rota
          </a>
        </div>
      </div>
    </Card>
  );
}
