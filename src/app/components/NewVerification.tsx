import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { useVerifications } from "./VerificationStore";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  MapPin,
  User,
  Building,
  GraduationCap,
  Mail,
  Phone,
  AlertCircle,
} from "lucide-react";
import { validateCep, consultCpfSefaz, matchInstitution, runTesseractOcr } from "./utils";
import type { Verification, OcrResult, CepResult, CpfResult } from "./VerificationStore";

export function NewVerification() {
  const navigate = useNavigate();
  const { addVerification } = useVerifications();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    instituicao: "",
    curso: "",
    cep: "",
    endereco: "",
  });

  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentPreview, setDocumentPreview] = useState<string>("");
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [cepResult, setCepResult] = useState<CepResult | null>(null);
  const [cpfResult, setCpfResult] = useState<CpfResult | null>(null);
  const [loadingOcr, setLoadingOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<{ status: string; progress: number } | null>(null);
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingCpf, setLoadingCpf] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocumentFile(file);
    setOcrResult(null);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setDocumentPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setDocumentPreview("");
    }
  };

  const runOcr = async () => {
    if (!documentFile) return;
    setLoadingOcr(true);
    setOcrResult(null);
    setOcrProgress(null);

    try {
      let text = "";
      let confidence = 0;

      try {
        // Tesseract.js v7 - real OCR
        const result = await runTesseractOcr(documentFile, (status, progress) => {
          setOcrProgress({ status, progress });
        });
        text = result.text;
        confidence = result.confidence;
      } catch (tesseractError) {
        console.error("Tesseract.js falhou:", tesseractError);
        const errorMsg = tesseractError instanceof Error ? tesseractError.message : String(tesseractError);
        console.error("[OCR] Erro detalhado:", errorMsg);
        console.error("[OCR] Stack:", tesseractError instanceof Error ? tesseractError.stack : "N/A");
        setOcrResult({
          text: "",
          confidence: 0,
          institutionMatch: false,
          institutionFound: undefined,
          errorDetail: errorMsg,
        });
        setLoadingOcr(false);
        setOcrProgress(null);
        return;
      }

      const institutionResult = matchInstitution(text, formData.instituicao);

      setOcrResult({
        text,
        confidence,
        institutionFound: institutionResult.found || undefined,
        institutionMatch: institutionResult.match,
      });
    } catch (err) {
      console.error("OCR Error:", err);
      setOcrResult({
        text: "Erro ao processar o documento. Tente novamente com uma imagem mais nítida.",
        confidence: 0,
        institutionMatch: false,
      });
    } finally {
      setLoadingOcr(false);
      setOcrProgress(null);
    }
  };

  const checkCep = async () => {
    if (!formData.cep) return;
    setLoadingCep(true);
    setCepResult(null);
    const result = await validateCep(formData.cep);
    setCepResult(result);
    if (result.valid && result.logradouro) {
      setFormData((prev) => ({
        ...prev,
        endereco: `${result.logradouro}, ${result.bairro} - ${result.localidade}/${result.uf}`,
      }));
    }
    setLoadingCep(false);
  };

  const checkCpf = async () => {
    if (!formData.cpf) return;
    setLoadingCpf(true);
    setCpfResult(null);
    const result = await consultCpfSefaz(formData.cpf);
    setCpfResult(result);
    setLoadingCpf(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const id = `VER-${String(Date.now()).slice(-6)}`;

    const verification: Verification = {
      id,
      createdAt: new Date(),
      status: ocrResult && cepResult && cpfResult ? (
        ocrResult.institutionMatch && cepResult.valid && cpfResult.valid
          ? "aprovado"
          : "reprovado"
      ) : "pendente",
      formData,
      documentFile: documentFile || undefined,
      documentPreview: documentPreview || undefined,
      ocrResult: ocrResult || undefined,
      cepResult: cepResult || undefined,
      cpfResult: cpfResult || undefined,
    };

    addVerification(verification);
    setTimeout(() => {
      setSubmitting(false);
      navigate(`/verificacoes/${id}`);
    }, 500);
  };

  const allChecked = ocrResult && cepResult && cpfResult;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
        <h2 className="text-[17px] mb-1">Nova Verificação</h2>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Preencha os dados do formulário e faça upload do comprovante de matrícula para iniciar a verificação.
        </p>
      </div>

      {/* Form Data Section */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 space-y-4">
        <h3 className="text-[15px] flex items-center gap-2">
          <User className="w-4 h-4" /> Dados do Formulário (Google Forms)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[13px] text-[var(--muted-foreground)] mb-1 block">Nome Completo</label>
            <input
              name="nome"
              value={formData.nome}
              onChange={handleInputChange}
              placeholder="Nome completo do aluno"
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--input-background)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          <div>
            <label className="text-[13px] text-[var(--muted-foreground)] mb-1 block">CPF</label>
            <div className="flex gap-2">
              <input
                name="cpf"
                value={formData.cpf}
                onChange={handleInputChange}
                placeholder="000.000.000-00"
                className="flex-1 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--input-background)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
              <button
                onClick={checkCpf}
                disabled={!formData.cpf || loadingCpf}
                className="px-3 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 text-[13px] flex items-center gap-1.5 whitespace-nowrap"
              >
                {loadingCpf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Consultar
              </button>
            </div>
            {cpfResult && (
              <div className={`mt-2 p-3 rounded-lg text-[12px] ${cpfResult.valid ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                <div className="flex items-center gap-1.5">
                  {cpfResult.valid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>CPF: {cpfResult.cpf} &mdash; Situação: {cpfResult.situacao}</span>
                </div>
                {cpfResult.message && <p className="mt-1 text-[11px] opacity-75">{cpfResult.message}</p>}
              </div>
            )}
          </div>
          <div>
            <label className="text-[13px] text-[var(--muted-foreground)] mb-1 block">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
              <input
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="email@exemplo.com"
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--input-background)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          </div>
          <div>
            <label className="text-[13px] text-[var(--muted-foreground)] mb-1 block">Telefone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
              <input
                name="telefone"
                value={formData.telefone}
                onChange={handleInputChange}
                placeholder="(00) 00000-0000"
                className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--input-background)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          </div>
          <div>
            <label className="text-[13px] text-[var(--muted-foreground)] mb-1 block">
              <Building className="w-3.5 h-3.5 inline mr-1" />
              Instituição de Ensino
            </label>
            <input
              name="instituicao"
              value={formData.instituicao}
              onChange={handleInputChange}
              placeholder="Ex: Universidade de São Paulo"
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--input-background)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          <div>
            <label className="text-[13px] text-[var(--muted-foreground)] mb-1 block">
              <GraduationCap className="w-3.5 h-3.5 inline mr-1" />
              Curso
            </label>
            <input
              name="curso"
              value={formData.curso}
              onChange={handleInputChange}
              placeholder="Ex: Engenharia de Computação"
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--input-background)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          <div>
            <label className="text-[13px] text-[var(--muted-foreground)] mb-1 block">
              <MapPin className="w-3.5 h-3.5 inline mr-1" />
              CEP
            </label>
            <div className="flex gap-2">
              <input
                name="cep"
                value={formData.cep}
                onChange={handleInputChange}
                placeholder="00000-000"
                className="flex-1 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--input-background)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
              <button
                onClick={checkCep}
                disabled={!formData.cep || loadingCep}
                className="px-3 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 text-[13px] flex items-center gap-1.5 whitespace-nowrap"
              >
                {loadingCep ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                Verificar
              </button>
            </div>
            {cepResult && (
              <div className={`mt-2 p-3 rounded-lg text-[12px] ${cepResult.valid ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                <div className="flex items-center gap-1.5">
                  {cepResult.valid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  <span>
                    {cepResult.valid
                      ? `${cepResult.logradouro}, ${cepResult.bairro} - ${cepResult.localidade}/${cepResult.uf}`
                      : cepResult.error}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="text-[13px] text-[var(--muted-foreground)] mb-1 block">Endereço</label>
            <input
              name="endereco"
              value={formData.endereco}
              onChange={handleInputChange}
              placeholder="Preenchido automaticamente pelo CEP"
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--input-background)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
        </div>
      </div>

      {/* Document Upload & OCR */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 space-y-4">
        <h3 className="text-[15px] flex items-center gap-2">
          <FileText className="w-4 h-4" /> Comprovante de Matrícula
        </h3>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center cursor-pointer hover:border-[var(--primary)] hover:bg-[var(--accent)]/30 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          {documentFile ? (
            <div className="flex items-center justify-center gap-3">
              <FileText className="w-8 h-8 text-[var(--primary)]" />
              <div className="text-left">
                <p className="text-[14px]">{documentFile.name}</p>
                <p className="text-[12px] text-[var(--muted-foreground)]">
                  {(documentFile.size / 1024).toFixed(1)} KB &middot; Clique para trocar
                </p>
              </div>
            </div>
          ) : (
            <>
              <Upload className="w-10 h-10 text-[var(--muted-foreground)] mx-auto mb-3" />
              <p className="text-[14px] text-[var(--muted-foreground)]">
                Arraste ou clique para fazer upload
              </p>
              <p className="text-[12px] text-[var(--muted-foreground)] mt-1">
                Suporta imagens (JPG, PNG) e PDF
              </p>
            </>
          )}
        </div>

        {documentPreview && (
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <img
              src={documentPreview}
              alt="Preview do documento"
              className="max-h-64 mx-auto object-contain"
            />
          </div>
        )}

        {documentFile && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={runOcr}
                disabled={loadingOcr || !formData.instituicao}
                className="px-4 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 text-[14px] flex items-center gap-2"
              >
                {loadingOcr ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando OCR...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Executar OCR (Tesseract.js)
                  </>
                )}
              </button>
              {!formData.instituicao && (
                <span className="text-[12px] text-[var(--muted-foreground)] flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Preencha a instituição primeiro
                </span>
              )}
            </div>

            {/* OCR Progress Bar */}
            {ocrProgress && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-[12px] text-blue-800">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {ocrProgress.status}
                  </span>
                  <span>{Math.round(ocrProgress.progress * 100)}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(ocrProgress.progress * 100, 2)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {ocrResult && (
          <div className="space-y-3">
            {ocrResult.confidence === 0 && !ocrResult.text ? (
              <div className="p-4 rounded-lg border bg-yellow-50 border-yellow-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <span className="text-[14px] text-yellow-800">
                    Falha no processamento OCR
                  </span>
                </div>
                <div className="text-[12px] text-yellow-700 space-y-1">
                  <p>O motor OCR (Tesseract.js) não conseguiu processar o documento. Possíveis causas:</p>
                  <ul className="list-disc list-inside ml-2 space-y-0.5">
                    <li>O arquivo é um PDF (use uma imagem JPG ou PNG)</li>
                    <li>A imagem está muito escura ou com baixa resolução</li>
                    <li>Erro ao carregar o modelo de idioma</li>
                  </ul>
                  {ocrResult.errorDetail && (
                    <div className="mt-3 p-2 bg-yellow-100 rounded border border-yellow-300">
                      <p className="text-[11px] font-mono break-all">
                        <strong>Erro técnico:</strong> {ocrResult.errorDetail}
                      </p>
                    </div>
                  )}
                  <p className="mt-2">Tente novamente com uma <strong>imagem nítida</strong> do comprovante.</p>
                </div>
              </div>
            ) : (
            <div className={`p-4 rounded-lg border ${ocrResult.institutionMatch ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-2 mb-2">
                {ocrResult.institutionMatch ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span className={`text-[14px] ${ocrResult.institutionMatch ? "text-green-800" : "text-red-800"}`}>
                  {ocrResult.institutionMatch
                    ? "Instituição CORRESPONDE ao formulário"
                    : "Instituição NÃO CORRESPONDE ao formulário"}
                </span>
              </div>
              <div className="text-[12px] space-y-1">
                <p><strong>Formulário:</strong> {formData.instituicao}</p>
                <p><strong>Encontrado no documento:</strong> {ocrResult.institutionFound || "Não identificado"}</p>
                <p><strong>Confiança do OCR:</strong> {ocrResult.confidence.toFixed(1)}%</p>
              </div>
            </div>
            )}

            <details className="bg-[var(--accent)] rounded-lg p-3">
              <summary className="cursor-pointer text-[13px] text-[var(--muted-foreground)]">
                Ver texto extraído pelo OCR
              </summary>
              <pre className="mt-2 text-[12px] whitespace-pre-wrap max-h-48 overflow-auto">
                {ocrResult.text}
              </pre>
            </details>
          </div>
        )}
      </div>

      {/* Submit */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-[15px]">Resumo da Verificação</h3>
            <div className="flex items-center gap-4 mt-2 text-[13px]">
              <span className={`flex items-center gap-1 ${ocrResult ? (ocrResult.institutionMatch ? "text-green-600" : "text-red-600") : "text-[var(--muted-foreground)]"}`}>
                {ocrResult ? (ocrResult.institutionMatch ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />) : <AlertCircle className="w-3.5 h-3.5" />}
                Instituição
              </span>
              <span className={`flex items-center gap-1 ${cepResult ? (cepResult.valid ? "text-green-600" : "text-red-600") : "text-[var(--muted-foreground)]"}`}>
                {cepResult ? (cepResult.valid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />) : <AlertCircle className="w-3.5 h-3.5" />}
                CEP
              </span>
              <span className={`flex items-center gap-1 ${cpfResult ? (cpfResult.valid ? "text-green-600" : "text-red-600") : "text-[var(--muted-foreground)]"}`}>
                {cpfResult ? (cpfResult.valid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />) : <AlertCircle className="w-3.5 h-3.5" />}
                CPF
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2.5 rounded-lg border border-[var(--border)] hover:bg-[var(--accent)] text-[14px]"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!formData.nome || submitting}
              className="px-5 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 text-[14px] flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Salvar Verificação
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}