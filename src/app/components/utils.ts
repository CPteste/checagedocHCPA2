// ========== CPF Validation ==========
import { projectId, publicAnonKey } from "/utils/supabase/info";

const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || publicAnonKey;

export function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function validateCpfAlgorithm(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[10])) return false;

  return true;
}

// Regiao fiscal do CPF (baseado no 9 digito)
function getCpfRegion(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length < 10) return "Desconhecida";
  const regionDigit = parseInt(digits[8]);
  const regions: Record<number, string> = {
    0: "RS",
    1: "DF, GO, MS, MT, TO",
    2: "AC, AM, AP, PA, RO, RR",
    3: "CE, MA, PI",
    4: "AL, PB, PE, RN",
    5: "BA, SE",
    6: "MG",
    7: "ES, RJ",
    8: "SP",
    9: "PR, SC",
  };
  return regions[regionDigit] || "Desconhecida";
}

// ========== CPF Log Types ==========
export type CpfLogEntry = {
  time: string;
  level: "info" | "ok" | "warn" | "error";
  msg: string;
};

// Helper: tenta fetch em uma URL com timeout e retorna parsed JSON ou null
async function tryProxyFetch(
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
  log: (level: CpfLogEntry["level"], msg: string) => void,
  label: string,
): Promise<{ data: any; status: number } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const t0 = Date.now();

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", ...headers },
    });
    clearTimeout(timeout);
    const elapsed = Date.now() - t0;
    log("info", `${label}: resposta em ${elapsed}ms — HTTP ${response.status}`);

    let data: any;
    try {
      data = await response.json();
      log("info", `${label} body: ${JSON.stringify(data).slice(0, 300)}`);
    } catch {
      log("error", `${label}: resposta não é JSON válido (HTTP ${response.status})`);
      return null;
    }

    return { data, status: response.status };
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    log("error", `${label} falhou — ${msg}`);
    return null;
  }
}

// Consulta real de CPF (Vercel API -> Supabase proxy -> fallback local)
export async function consultCpfSefaz(
  cpf: string,
  onLog?: (entry: CpfLogEntry) => void,
): Promise<{
  valid: boolean;
  cpf: string;
  situacao: string;
  message?: string;
  regiao?: string;
  nome?: string;
  dataConsulta?: string;
}> {
  const VERSION = "v1.5.0";
  const log = (level: CpfLogEntry["level"], msg: string) => {
    const time = new Date().toLocaleTimeString("pt-BR", { hour12: false });
    console.log(`[CPF][${level}] ${msg}`);
    onLog?.({ time, level, msg });
  };

  const cleanDigits = cpf.replace(/\D/g, "");
  const cleanCpf = formatCpf(cleanDigits);
  const regiao = getCpfRegion(cleanDigits);
  const dataConsulta = new Date().toLocaleString("pt-BR");

  log("info", `ChecaDoc ${VERSION} — Iniciando verificação do CPF ${cleanCpf}`);

  // ── Passo 1: Validação algorítmica ──
  log("info", "Passo 1 — Validação algorítmica dos dígitos verificadores...");
  if (!validateCpfAlgorithm(cpf)) {
    log("error", "CPF INVÁLIDO — dígitos verificadores não conferem");
    return {
      valid: false,
      cpf: cleanCpf,
      situacao: "Invalido",
      message: "CPF com digitos verificadores invalidos. Nao passa na validacao matematica da Receita Federal.",
      regiao,
      dataConsulta,
    };
  }
  log("ok", `Dígitos verificadores OK. Região fiscal: ${regiao}`);

  // Helper para interpretar resposta bem-sucedida de qualquer proxy
  const parseSuccess = (data: any, source: string) => {
    if (data?.situacao) {
      const nome = data.nome || undefined;
      log("ok", `${source} retornou situação: "${data.situacao}" | Nome: ${nome || "N/D"}`);
      return {
        valid: data.situacao === "Regular",
        cpf: cleanCpf,
        situacao: data.situacao,
        nome,
        message: data.situacao === "Regular"
          ? `CPF consultado com sucesso na Receita Federal (${source}). Contribuinte: ${nome || "N/D"}`
          : `CPF com situação "${data.situacao}" na Receita Federal. ${data.message || ""}`,
        regiao,
        dataConsulta,
      };
    }
    return null;
  };

  // ── Passo 2: Vercel Serverless Function (proxy primário) ──
  const vercelUrl = `/api/cpf/${cleanDigits}`;
  log("info", `Passo 2 — Consultando via Vercel Serverless Function...`);
  log("info", `URL: ${vercelUrl}`);

  const vercelResult = await tryProxyFetch(vercelUrl, {}, 15000, log, "Vercel API");

  if (vercelResult) {
    const { data, status } = vercelResult;
    if (status >= 200 && status < 300) {
      const parsed = parseSuccess(data, "Vercel→ReceitaWS");
      if (parsed) return parsed;
    }
    log("warn", `Vercel API erro HTTP ${status}: ${data?.error || data?.message || JSON.stringify(data)}`);
  }

  // ── Passo 3: Supabase Edge Function (proxy secundário) ──
  const supabaseUrl = `${BACKEND_URL}/functions/v1/make-server-a86ed2e4/cpf/${cleanDigits}`;
  log("info", `Passo 3 — Tentando Supabase Edge Function como fallback...`);
  log("info", `URL: ${supabaseUrl}`);

  const supabaseResult = await tryProxyFetch(
    supabaseUrl,
    { Authorization: `Bearer ${ANON_KEY}` },
    12000,
    log,
    "Supabase proxy",
  );

  if (supabaseResult) {
    const { data, status } = supabaseResult;
    if (status >= 200 && status < 300) {
      const parsed = parseSuccess(data, "Supabase→ReceitaWS");
      if (parsed) return parsed;
    }
    log("warn", `Supabase proxy HTTP ${status}: ${data?.error || data?.message || JSON.stringify(data)}`);
  }

  // ── Passo 4: Fallback local ──
  log("warn", "Passo 4 — Nenhum proxy disponível, usando validação local");
  log("info", `Resultado: CPF válido algoritmicamente, região ${regiao}`);

  return {
    valid: true,
    cpf: cleanCpf,
    situacao: "Regular (validação local)",
    message: `CPF válido algoritmicamente. Região fiscal: ${regiao}. Nenhum proxy de consulta à Receita Federal respondeu — usando validação matemática dos dígitos verificadores.`,
    regiao,
    dataConsulta,
  };
}

// ========== CEP Validation via ViaCEP ==========
export async function validateCep(cep: string): Promise<{
  valid: boolean;
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  error?: string;
}> {
  const cleanCep = cep.replace(/\D/g, "");
  if (cleanCep.length !== 8) {
    return { valid: false, error: "CEP deve ter 8 digitos" };
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    const data = await response.json();

    if (data.erro) {
      return { valid: false, error: "CEP nao encontrado na base dos Correios" };
    }

    return {
      valid: true,
      cep: data.cep,
      logradouro: data.logradouro,
      bairro: data.bairro,
      localidade: data.localidade,
      uf: data.uf,
    };
  } catch {
    return { valid: false, error: "Erro ao consultar ViaCEP. Verifique sua conexao." };
  }
}

// ========== Institution matching ==========
const institutionAliases: Record<string, string[]> = {
  "universidade de sao paulo": ["usp", "universidade de sao paulo"],
  "universidade federal do rio de janeiro": ["ufrj"],
  "universidade estadual de campinas": ["unicamp"],
  "universidade federal de minas gerais": ["ufmg"],
  "universidade federal do parana": ["ufpr"],
  "universidade tecnologica federal do parana": ["utfpr"],
  "pontificia universidade catolica": ["puc", "puc-rio", "puc-sp", "puc-mg", "puc-pr"],
  "universidade federal de santa catarina": ["ufsc"],
  "universidade federal do rio grande do sul": ["ufrgs"],
  "universidade de brasilia": ["unb"],
  "universidade federal da bahia": ["ufba"],
  "universidade federal de pernambuco": ["ufpe"],
  "universidade federal do ceara": ["ufc"],
  "universidade federal fluminense": ["uff"],
  "universidade federal de goias": ["ufg"],
};

export function matchInstitution(ocrText: string, declaredInstitution: string): {
  found: string | null;
  match: boolean;
} {
  if (!ocrText || ocrText.trim().length < 10 || !declaredInstitution) {
    return { found: null, match: false };
  }

  const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const ocrNorm = normalize(ocrText);
  const declaredNorm = normalize(declaredInstitution);

  // Direct match: declared institution name appears in OCR text
  // Only check if OCR contains the declared name (NOT the reverse)
  if (declaredNorm.length >= 4 && ocrNorm.includes(declaredNorm)) {
    return { found: declaredInstitution, match: true };
  }

  // Check aliases - both OCR and declared must resolve to the same institution
  for (const [fullName, aliases] of Object.entries(institutionAliases)) {
    const fullNameNorm = normalize(fullName);
    const allNames = [fullNameNorm, ...aliases.map(normalize)];

    const declaredMatches = allNames.some(
      (name) => declaredNorm.includes(name) || name.includes(declaredNorm)
    );
    if (!declaredMatches) continue;

    const ocrMatches = allNames.some((name) => ocrNorm.includes(name));
    if (ocrMatches) {
      return { found: fullName, match: true };
    }
  }

  // Word-based partial matching (at least 2 significant words must match)
  const significantWords = declaredNorm
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["de", "do", "da", "dos", "das", "e"].includes(w));

  if (significantWords.length >= 2) {
    const matchCount = significantWords.filter((word) => ocrNorm.includes(word)).length;
    if (matchCount >= Math.ceil(significantWords.length * 0.6)) {
      return { found: declaredInstitution, match: true };
    }
  }

  return { found: null, match: false };
}

// ========== OCR via Tesseract.js ==========
export async function runTesseractOcr(
  file: File,
  onProgress?: (status: string, progress: number) => void,
): Promise<{ text: string; confidence: number }> {
  let imageFile = file;

  // Se for PDF, converter primeira pagina em imagem
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    onProgress?.("Convertendo PDF para imagem...", 0.05);
    imageFile = await convertPdfToImage(file);
    onProgress?.("PDF convertido, iniciando OCR...", 0.1);
  }

  const Tesseract = await import("tesseract.js");
  const worker = await Tesseract.createWorker("por", undefined, {
    logger: (m: any) => {
      if (m.status && typeof m.progress === "number") {
        const statusMap: Record<string, string> = {
          "loading tesseract core": "Carregando motor OCR...",
          "initializing tesseract": "Inicializando Tesseract...",
          "loading language traineddata": "Carregando idioma português...",
          "initializing api": "Preparando API...",
          "recognizing text": "Reconhecendo texto...",
        };
        onProgress?.(statusMap[m.status] || m.status, m.progress);
      }
    },
  });

  const {
    data: { text, confidence },
  } = await worker.recognize(imageFile);
  await worker.terminate();

  return { text: text.trim(), confidence };
}

// ========== PDF to Image conversion ==========
async function convertPdfToImage(file: File): Promise<File> {
  const pdfjsLib = await import("pdfjs-dist");

  // Configurar worker do PDF.js via CDN
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const scale = 2;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d")!;

  await page.render({ canvasContext: context, viewport }).promise;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Falha ao converter canvas para blob"));
          return;
        }
        const imageFile = new File([blob], "pdf-page-1.png", { type: "image/png" });
        resolve(imageFile);
      },
      "image/png",
      1.0,
    );
  });
}

// ========== Status helpers ==========
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pendente: "Pendente",
    em_analise: "Em Análise",
    aprovado: "Aprovado",
    reprovado: "Reprovado",
  };
  return labels[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pendente: "bg-yellow-100 text-yellow-800",
    em_analise: "bg-blue-100 text-blue-800",
    aprovado: "bg-green-100 text-green-800",
    reprovado: "bg-red-100 text-red-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}