import { useNavigate } from "react-router";
import { useVerifications } from "./VerificationStore";
import { getStatusLabel, getStatusColor } from "./utils";
import {
  ClipboardCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  FilePlus,
  Loader2,
  CloudOff,
  Cloud,
} from "lucide-react";

export function Dashboard() {
  const { verifications, loading, syncing, syncError } = useVerifications();
  const navigate = useNavigate();

  const counts = {
    total: verifications.length,
    pendente: verifications.filter((v) => v.status === "pendente").length,
    em_analise: verifications.filter((v) => v.status === "em_analise").length,
    aprovado: verifications.filter((v) => v.status === "aprovado").length,
    reprovado: verifications.filter((v) => v.status === "reprovado").length,
  };

  const recent = verifications.slice(0, 5);

  const stats = [
    { label: "Total", value: counts.total, icon: ClipboardCheck, color: "bg-[var(--primary)]", textColor: "text-[var(--primary-foreground)]" },
    { label: "Pendentes", value: counts.pendente, icon: Clock, color: "bg-yellow-500", textColor: "text-white" },
    { label: "Em Análise", value: counts.em_analise, icon: AlertTriangle, color: "bg-blue-500", textColor: "text-white" },
    { label: "Aprovados", value: counts.aprovado, icon: CheckCircle2, color: "bg-green-500", textColor: "text-white" },
    { label: "Reprovados", value: counts.reprovado, icon: XCircle, color: "bg-red-500", textColor: "text-white" },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Connection status */}
      {syncError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <CloudOff className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <p className="text-[14px] text-red-800 font-medium">Erro de conexão com o banco de dados</p>
            <p className="text-[12px] text-red-600 mt-0.5">{syncError}</p>
            {syncError.includes("permission denied") && (
              <p className="text-[12px] text-red-600 mt-1">
                <strong>Dica:</strong> Desabilite o RLS na tabela <code>kv_store_a86ed2e4</code> no Supabase ou adicione uma política permissiva.
              </p>
            )}
          </div>
        </div>
      )}

      {!syncError && !loading && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
          <Cloud className="w-4 h-4 text-green-600" />
          <span className="text-[13px] text-green-800">
            Conectado ao Supabase — dados persistidos
            {syncing && <span className="ml-2 text-green-600">(sincronizando...)</span>}
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--primary)]" />
          <p className="text-[14px] text-[var(--muted-foreground)]">Carregando verificações do banco de dados...</p>
        </div>
      ) : (
        <>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-4 flex items-center gap-3"
          >
            <div className={`w-10 h-10 rounded-lg ${s.color} flex items-center justify-center`}>
              <s.icon className={`w-5 h-5 ${s.textColor}`} />
            </div>
            <div>
              <p className="text-[24px]">{s.value}</p>
              <p className="text-[12px] text-[var(--muted-foreground)]">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-3">
        <button
          onClick={() => navigate("/nova-verificacao")}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 transition-opacity text-[14px]"
        >
          <FilePlus className="w-4 h-4" />
          Nova Verificação
        </button>
        <button
          onClick={() => navigate("/verificacoes")}
          className="flex items-center gap-2 px-4 py-2.5 border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] transition-colors text-[14px]"
        >
          <ClipboardCheck className="w-4 h-4" />
          Ver Todas
        </button>
      </div>

      {/* Recent verifications */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-[15px]">Verificações Recentes</h3>
          <button
            onClick={() => navigate("/verificacoes")}
            className="flex items-center gap-1 text-[13px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            Ver todas <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recent.length === 0 ? (
          <div className="px-5 py-10 text-center text-[var(--muted-foreground)] text-[14px]">
            Nenhuma verificação encontrada. Crie a primeira!
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {recent.map((v) => (
              <button
                key={v.id}
                onClick={() => navigate(`/verificacoes/${v.id}`)}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--accent)] transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] truncate">{v.formData.nome}</span>
                    <span className="text-[11px] text-[var(--muted-foreground)]">{v.id}</span>
                  </div>
                  <p className="text-[12px] text-[var(--muted-foreground)] truncate mt-0.5">
                    {v.formData.instituicao} &middot; {v.formData.curso}
                  </p>
                </div>
                <span
                  className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap ${getStatusColor(v.status)}`}
                >
                  {getStatusLabel(v.status)}
                </span>
                <ArrowRight className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h4 className="text-[14px] text-blue-900 mb-2">Verificações do Sistema</h4>
        <div className="space-y-2 text-[13px] text-blue-800">
          <p><strong>OCR de Documentos:</strong> Extração de texto de comprovantes de matrícula via Tesseract.js.</p>
          <p><strong>Validação de CEP:</strong> Consulta à API ViaCEP (Correios) para confirmar endereço.</p>
          <p><strong>Validação de CPF:</strong> Verificação algorítmica e consulta ReceitaWS.</p>
          <p><strong>Verificação de Instituição:</strong> Comparação do comprovante com os dados informados.</p>
        </div>
      </div>
        </>
      )}
    </div>
  );
}