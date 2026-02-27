import { useState } from "react";
import { Settings, Globe, Database, FileText, AlertTriangle, CheckCircle2, ExternalLink, Shield, Loader2, CloudOff, Cloud, RefreshCw, Trash2 } from "lucide-react";
import { useVerifications } from "./VerificationStore";
import { kvGet, kvSet } from "./supabaseClient";
import { projectId } from "/utils/supabase/info";
import { toast } from "sonner";

export function Configuracoes() {
  const { verifications, loading, syncError, clearAllVerifications } = useVerifications();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [clearing, setClearing] = useState(false);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const testKey = "__checadoc_connection_test__";
      const testValue = { timestamp: new Date().toISOString(), test: true };
      await kvSet(testKey, testValue);
      const retrieved = await kvGet(testKey) as { timestamp: string; test: boolean } | null;
      if (retrieved && retrieved.test === true) {
        setTestResult({ ok: true, message: `Conexão OK! Escrita e leitura funcionando. (${retrieved.timestamp})` });
        toast.success("Conexão com o Supabase verificada com sucesso!");
      } else {
        setTestResult({ ok: false, message: "Escrita funcionou mas leitura retornou dados inesperados." });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({ ok: false, message: msg });
      toast.error("Falha no teste de conexão", { description: msg });
    } finally {
      setTesting(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm(
      `Tem certeza que deseja excluir todas as ${verifications.length} verificações?\n\nEsta ação é irreversível e removerá todos os dados do banco de dados.`
    )) return;
    setClearing(true);
    await clearAllVerifications();
    setClearing(false);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
        <h2 className="text-[17px] flex items-center gap-2 mb-1">
          <Settings className="w-5 h-5" /> Configurações
        </h2>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Configure as integrações e parâmetros do sistema de verificação.
        </p>
      </div>

      {/* ===== CONNECTION STATUS ===== */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${syncError ? "bg-red-100" : "bg-green-100"}`}>
            {syncError ? <CloudOff className="w-5 h-5 text-red-700" /> : <Cloud className="w-5 h-5 text-green-700" />}
          </div>
          <div>
            <h3 className="text-[15px]">Status da Conexão</h3>
            <p className="text-[12px] text-[var(--muted-foreground)]">Banco de dados Supabase</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-[var(--accent)]/50 text-center">
            <p className="text-[20px] font-semibold">{verifications.length}</p>
            <p className="text-[11px] text-[var(--muted-foreground)]">Verificações carregadas</p>
          </div>
          <div className="p-3 rounded-lg bg-[var(--accent)]/50 text-center">
            <p className={`text-[14px] font-medium ${syncError ? "text-red-600" : "text-green-600"}`}>
              {loading ? "Carregando..." : syncError ? "Desconectado" : "Conectado"}
            </p>
            <p className="text-[11px] text-[var(--muted-foreground)]">Estado do banco</p>
          </div>
          <div className="p-3 rounded-lg bg-[var(--accent)]/50 text-center">
            <p className="text-[14px] font-mono text-[var(--muted-foreground)]">{projectId.slice(0, 12)}...</p>
            <p className="text-[11px] text-[var(--muted-foreground)]">Project ID</p>
          </div>
        </div>

        {syncError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[12px] text-red-800">
            <p><strong>Erro:</strong> {syncError}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={testConnection}
            disabled={testing}
            className="px-4 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 text-[13px] flex items-center gap-2"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Testar Conexão
          </button>
          <a
            href={`https://supabase.com/dashboard/project/${projectId}/editor`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] text-[13px] flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Abrir Dashboard
          </a>
          {verifications.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearing}
              className="px-4 py-2.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 text-[13px] flex items-center gap-2"
            >
              {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Limpar Todas ({verifications.length})
            </button>
          )}
        </div>

        {testResult && (
          <div className={`p-3 rounded-lg text-[12px] border ${testResult.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
            <div className="flex items-center gap-2">
              {testResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
              <span>{testResult.message}</span>
            </div>
          </div>
        )}
      </div>

      {/* ===== GOOGLE FORMS ===== */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <h3 className="text-[15px]">Google Forms</h3>
            <p className="text-[12px] text-[var(--muted-foreground)]">Integração com formulários de entrada</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[13px] text-[var(--muted-foreground)] mb-1 block">ID do Formulário Google</label>
            <input
              placeholder="Ex: 1FAIpQLSe..."
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--input-background)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          <div>
            <label className="text-[13px] text-[var(--muted-foreground)] mb-1 block">URL do Webhook (Google Apps Script)</label>
            <input
              placeholder="https://script.google.com/macros/s/..."
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--input-background)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[12px] text-blue-800 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p>Configure o Google Apps Script com um trigger <code>onFormSubmit</code> para enviar os dados automaticamente ao ChecaDoc via webhook.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== OCR SETTINGS ===== */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <h3 className="text-[15px]">OCR (Tesseract.js)</h3>
            <p className="text-[12px] text-[var(--muted-foreground)]">Reconhecimento óptico de caracteres</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[13px] text-[var(--muted-foreground)] mb-1 block">Idioma do OCR</label>
            <select className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--input-background)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]">
              <option value="por">Português (por)</option>
              <option value="eng">Inglês (eng)</option>
              <option value="por+eng">Português + Inglês</option>
            </select>
          </div>
          <div>
            <label className="text-[13px] text-[var(--muted-foreground)] mb-1 block">Confiança mínima (%)</label>
            <input
              type="number"
              defaultValue={70}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--input-background)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
        </div>
      </div>

      {/* ===== APIs ===== */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <Globe className="w-5 h-5 text-purple-700" />
          </div>
          <div>
            <h3 className="text-[15px]">APIs Externas</h3>
            <p className="text-[12px] text-[var(--muted-foreground)]">Serviços de validação integrados</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-[var(--accent)]/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[14px]">ViaCEP (Correios)</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-800">Ativa</span>
            </div>
            <p className="text-[12px] text-[var(--muted-foreground)]">
              Validação de CEP via API pública dos Correios.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-[var(--accent)]/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[14px]">Validação de CPF</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-800">Ativa</span>
            </div>
            <p className="text-[12px] text-[var(--muted-foreground)]">
              Validação algorítmica + consulta ReceitaWS com fallback automático.
            </p>
          </div>
          <div className="p-3 rounded-lg bg-[var(--accent)]/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[14px]">Tesseract.js (OCR)</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-800">Ativa</span>
            </div>
            <p className="text-[12px] text-[var(--muted-foreground)]">
              Extração de texto de documentos via OCR no navegador.
            </p>
          </div>
        </div>
      </div>

      {/* ===== LGPD ===== */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-[12px] text-yellow-800 flex gap-2">
          <Shield className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p><strong>LGPD:</strong> Este sistema processa dados pessoais (CPF, nome, endereço). 
            Certifique-se de que as políticas de privacidade e segurança estejam configuradas 
            adequadamente no Supabase (RLS, backups) em conformidade com a Lei Geral de Proteção de Dados.</p>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button className="px-5 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 text-[14px]">
          Salvar Configurações
        </button>
      </div>
    </div>
  );
}