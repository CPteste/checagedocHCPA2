import { useParams, useNavigate } from "react-router";
import { useVerifications } from "./VerificationStore";
import { getStatusLabel, getStatusColor } from "./utils";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Building,
  MapPin,
  FileText,
  ShieldCheck,
  Printer,
  Download,
  Trash2,
} from "lucide-react";

export function VerificationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getVerification, updateVerification, deleteVerification } = useVerifications();
  const v = getVerification(id || "");

  if (!v) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="w-12 h-12 text-[var(--muted-foreground)] mb-4" />
        <p className="text-[16px] mb-2">Verificação não encontrada</p>
        <button
          onClick={() => navigate("/verificacoes")}
          className="text-[14px] text-[var(--primary)] hover:underline"
        >
          Voltar para lista
        </button>
      </div>
    );
  }

  const checks = [
    {
      label: "Verificação de Instituição (OCR)",
      icon: Building,
      result: v.ocrResult,
      pass: v.ocrResult?.institutionMatch,
      details: v.ocrResult
        ? [
            { key: "Instituição no formulário", value: v.formData.instituicao },
            { key: "Instituição no documento", value: v.ocrResult.institutionFound || "Não identificada" },
            { key: "Confiança OCR", value: `${v.ocrResult.confidence?.toFixed(1)}%` },
          ]
        : [],
    },
    {
      label: "Validação de CEP (Correios/ViaCEP)",
      icon: MapPin,
      result: v.cepResult,
      pass: v.cepResult?.valid,
      details: v.cepResult
        ? v.cepResult.valid
          ? [
              { key: "CEP", value: v.cepResult.cep || "" },
              { key: "Logradouro", value: v.cepResult.logradouro || "" },
              { key: "Bairro", value: v.cepResult.bairro || "" },
              { key: "Cidade/UF", value: `${v.cepResult.localidade}/${v.cepResult.uf}` },
            ]
          : [{ key: "Erro", value: v.cepResult.error || "CEP inválido" }]
        : [],
    },
    {
      label: "Certidão de CPF (SEFAZ/Receita Federal)",
      icon: ShieldCheck,
      result: v.cpfResult,
      pass: v.cpfResult?.valid,
      details: v.cpfResult
        ? [
            { key: "CPF", value: v.cpfResult.cpf },
            { key: "Situação", value: v.cpfResult.situacao || "" },
            ...(v.cpfResult.nome ? [{ key: "Nome (Receita)", value: v.cpfResult.nome }] : []),
            ...(v.cpfResult.regiao ? [{ key: "Região fiscal", value: v.cpfResult.regiao }] : []),
            ...(v.cpfResult.dataConsulta ? [{ key: "Data da consulta", value: v.cpfResult.dataConsulta }] : []),
            ...(v.cpfResult.message ? [{ key: "Observação", value: v.cpfResult.message }] : []),
          ]
        : [],
    },
  ];

  const handleStatusChange = (newStatus: "aprovado" | "reprovado") => {
    updateVerification(v.id, { status: newStatus });
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => navigate("/verificacoes")}
          className="p-2 rounded-lg hover:bg-[var(--accent)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-[17px]">{v.formData.nome}</h2>
            <span className="text-[12px] text-[var(--muted-foreground)]">{v.id}</span>
            <span className={`text-[11px] px-2.5 py-1 rounded-full ${getStatusColor(v.status)}`}>
              {getStatusLabel(v.status)}
            </span>
          </div>
          <p className="text-[13px] text-[var(--muted-foreground)] mt-0.5">
            Criado em {v.createdAt.toLocaleDateString("pt-BR")} às {v.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] text-[13px] flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Personal data */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
        <h3 className="text-[15px] flex items-center gap-2 mb-4">
          <User className="w-4 h-4" /> Dados Pessoais
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          {[
            { label: "Nome", value: v.formData.nome },
            { label: "CPF", value: v.formData.cpf },
            { label: "E-mail", value: v.formData.email },
            { label: "Telefone", value: v.formData.telefone },
            { label: "Instituição", value: v.formData.instituicao },
            { label: "Curso", value: v.formData.curso },
            { label: "CEP", value: v.formData.cep },
            { label: "Endereço", value: v.formData.endereco },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[12px] text-[var(--muted-foreground)]">{item.label}</p>
              <p className="text-[14px]">{item.value || "—"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Verification Results */}
      <div className="space-y-4">
        <h3 className="text-[15px]">Resultados das Verificações</h3>

        {checks.map((check) => (
          <div
            key={check.label}
            className={`bg-[var(--card)] rounded-xl border p-5 ${
              !check.result
                ? "border-[var(--border)]"
                : check.pass
                ? "border-green-200"
                : "border-red-200"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  !check.result
                    ? "bg-gray-100"
                    : check.pass
                    ? "bg-green-100"
                    : "bg-red-100"
                }`}
              >
                {!check.result ? (
                  <AlertCircle className="w-5 h-5 text-gray-400" />
                ) : check.pass ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-[14px]">{check.label}</p>
                <p className="text-[12px] text-[var(--muted-foreground)]">
                  {!check.result
                    ? "Verificação não realizada"
                    : check.pass
                    ? "Verificação aprovada"
                    : "Verificação reprovada"}
                </p>
              </div>
            </div>

            {check.details.length > 0 && (
              <div className="bg-[var(--accent)]/50 rounded-lg p-3 space-y-1.5">
                {check.details.map((d) => (
                  <div key={d.key} className="flex gap-2 text-[13px]">
                    <span className="text-[var(--muted-foreground)] shrink-0">{d.key}:</span>
                    <span>{d.value}</span>
                  </div>
                ))}
              </div>
            )}

            {check.label.includes("OCR") && v.ocrResult?.text && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[12px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                  Ver texto completo do OCR
                </summary>
                <pre className="mt-2 text-[11px] bg-[var(--accent)] rounded-lg p-3 whitespace-pre-wrap max-h-40 overflow-auto">
                  {v.ocrResult.text}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>

      {/* Document preview */}
      {v.documentPreview && (
        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
          <h3 className="text-[15px] flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4" /> Documento Anexado
          </h3>
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <img
              src={v.documentPreview}
              alt="Comprovante de matrícula"
              className="max-h-80 mx-auto object-contain"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
        <h3 className="text-[15px] mb-3">Ações</h3>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => handleStatusChange("aprovado")}
            className="px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 text-[14px] flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            Aprovar Verificação
          </button>
          <button
            onClick={() => handleStatusChange("reprovado")}
            className="px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 text-[14px] flex items-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            Reprovar Verificação
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Excluir verificação ${v.id}? Esta ação não pode ser desfeita.`)) {
                deleteVerification(v.id);
                navigate("/verificacoes");
              }
            }}
            className="px-4 py-2.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-[14px] flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </button>
          <button
            onClick={() => navigate("/verificacoes")}
            className="px-4 py-2.5 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] text-[14px]"
          >
            Voltar à Lista
          </button>
        </div>
      </div>

      {/* CPF Certificate */}
      {v.cpfResult && (
        <div className="bg-[var(--card)] rounded-xl border-2 border-dashed border-[var(--border)] p-6" id="cpf-certificate">
          <div className="text-center mb-4">
            <ShieldCheck className="w-10 h-10 mx-auto text-[var(--primary)] mb-2" />
            <h3 className="text-[16px]">Certidão de Situação Cadastral do CPF</h3>
            <p className="text-[12px] text-[var(--muted-foreground)]">
              Emitida pelo Sistema ChecaDoc &middot; {v.cpfResult.dataConsulta || new Date().toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div className="border border-[var(--border)] rounded-lg p-4 space-y-2 max-w-md mx-auto">
            <div className="flex justify-between text-[14px]">
              <span className="text-[var(--muted-foreground)]">Nome:</span>
              <span>{v.cpfResult.nome || v.formData.nome}</span>
            </div>
            <div className="flex justify-between text-[14px]">
              <span className="text-[var(--muted-foreground)]">CPF:</span>
              <span>{v.cpfResult.cpf}</span>
            </div>
            <div className="flex justify-between text-[14px]">
              <span className="text-[var(--muted-foreground)]">Situação:</span>
              <span className={v.cpfResult.valid ? "text-green-600" : "text-red-600"}>
                {v.cpfResult.situacao}
              </span>
            </div>
            {v.cpfResult.regiao && (
              <div className="flex justify-between text-[14px]">
                <span className="text-[var(--muted-foreground)]">Região fiscal:</span>
                <span>{v.cpfResult.regiao}</span>
              </div>
            )}
            <div className="flex justify-between text-[14px]">
              <span className="text-[var(--muted-foreground)]">Data:</span>
              <span>{v.cpfResult.dataConsulta || new Date().toLocaleDateString("pt-BR")}</span>
            </div>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)] text-center mt-4">
            * Consulta realizada via validação algorítmica e ReceitaWS. Para integração oficial, utilize a API da Receita Federal/SEFAZ.
          </p>
          <div className="flex justify-center mt-4">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] text-[13px] flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              Imprimir / Salvar PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}