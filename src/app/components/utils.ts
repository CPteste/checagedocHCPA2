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

// Região fiscal do CPF (baseado no 9º dígito)
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

// Consulta real de CPF via API pública (BrasilAPI/ReceitaWS com fallback)
export async function consultCpfSefaz(cpf: string): Promise<{
  valid: boolean;
  cpf: string;
  situacao: string;
  message?: string;
  regiao?: string;
  nome?: string;
  dataConsulta?: string;
}> {
  const cleanDigits = cpf.replace(/\D/g, "");
  const cleanCpf = formatCpf(cleanDigits);
  const regiao = getCpfRegion(cleanDigits);
  const dataConsulta = new Date().toLocaleString("pt-BR");

  // Step 1: Validação algorítmica (dígitos verificadores)
  if (!validateCpfAlgorithm(cpf)) {
    return {
      valid: false,
      cpf: cleanCpf,
      situacao: "Inválido",
      message: "CPF com dígitos verificadores inválidos. Não passa na validação matemática da Receita Federal.",
      regiao,
      dataConsulta,
    };
  }

  // Step 2: Tentar consulta real via backend proxy (evita CORS)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(
      `${BACKEND_URL}/functions/v1/make-server-a86ed2e4/cpf/${cleanDigits}`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${ANON_KEY}`,
        },
      }
    );
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();

      if (data.status === 0) {
        return {
          valid: data.situacao === "Regular",
          cpf: cleanCpf,
          situacao: data.situacao || "Regular",
          nome: data.nome || undefined,
          message: data.situacao === "Regular"
            ? `CPF consultado com sucesso na Receita Federal. Contribuinte: ${data.nome || "N/D"}`
            : `CPF com situação "${data.situacao}" na Receita Federal. ${data.message || ""}`,
          regiao,
          dataConsulta,
        };
      } else if (data.message) {
        console.warn("[CPF] ReceitaWS via proxy:", data.message);
      }
    }
  } catch (err) {
    console.warn("[CPF] Backend proxy indisponível, usando validação local:", err);
  }

  // Step 3: Fallback - validação algorítmica aprovada + info regional
  return {
    valid: true,
    cpf: cleanCpf,
    situacao: "Regular (validação local)",
    message: `CPF válido algoritmicamente. Região fiscal: ${regiao}. A consulta online à Receita Federal não está disponível no momento — usando validação matemática dos dígitos verificadores.`,
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
    return { valid: false, error: "CEP deve ter 8 dígitos" };
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    const data = await response.json();

    if (data.erro) {
      return { valid: false, error: "CEP não encontrado na base dos Correios" };
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
    return { valid: false, error: "Erro ao consultar ViaCEP. Verifique sua conexão." };
  }
}

// ========== Institution matching ==========
const institutionAliases: Record<string, string[]> = {
  "universidade de são paulo": ["usp", "universidade de sao paulo"],
  "universidade federal do rio de janeiro": ["ufrj"],
  "universidade estadual de campinas": ["unicamp"],
  "universidade federal de minas gerais": ["ufmg"],
  "universidade federal do paraná": ["ufpr"],
  "universidade tecnológica federal do paraná": ["utfpr"],
  "pontifícia universidade católica": ["puc", "puc-rio", "puc-sp", "puc-mg", "puc-pr"],
  "universidade federal de santa catarina": ["ufsc"],
  "universidade federal do rio grande do sul": ["ufrgs"],
  "universidade de brasília": ["unb"],
  "universidade federal da bahia": ["ufba"],
  "universidade federal de pernambuco": ["ufpe"],
  "universidade federal do ceará": ["ufc"],
  "universidade federal fluminense": ["uff"],
  "universidade federal de goiás": ["ufg"],
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
    const allNames = [fullNameNorm, ...aliases.map(a => normalize(a))];

    const ocrHasIt = allNames.some((name) => ocrNorm.includes(name));
    const declaredHasIt = allNames.some((name) => declaredNorm.includes(name) || name.includes(declaredNorm));

    if (ocrHasIt && declaredHasIt) {
      return { found: fullName, match: true };
    }

    if (ocrHasIt) {
      // Found an institution in the document, but it doesn't match what was declared
      return { found: fullName, match: false };
    }
  }

  // Heuristic: try to extract any institution name from OCR text
  const keywords = ["universidade", "faculdade", "instituto", "centro universitario", "escola superior", "college", "university"];
  for (const kw of keywords) {
    const idx = ocrNorm.indexOf(kw);
    if (idx !== -1) {
      // Extract the line containing the keyword
      const lineStart = ocrNorm.lastIndexOf("\n", idx) + 1;
      const lineEnd = ocrNorm.indexOf("\n", idx);
      const foundLine = ocrText.substring(lineStart, lineEnd === -1 ? Math.min(idx + 100, ocrText.length) : lineEnd).trim();
      if (foundLine.length > 3) {
        return { found: foundLine, match: false };
      }
    }
  }

  return { found: null, match: false };
}

// ========== OCR with Tesseract.js ==========
export async function runTesseractOcr(
  file: File,
  onProgress?: (status: string, progress: number) => void
): Promise<{ text: string; confidence: number }> {
  const Tesseract = await import("tesseract.js");

  // Create image source
  const imageSource = file.type.startsWith("image/")
    ? URL.createObjectURL(file)
    : file;

  try {
    onProgress?.("Carregando motor OCR...", 0);

    const result = await Tesseract.recognize(imageSource, "por", {
      logger: (m: { status: string; progress: number }) => {
        const statusMap: Record<string, string> = {
          "loading tesseract core": "Carregando Tesseract...",
          "initializing tesseract": "Inicializando...",
          "loading language traineddata": "Baixando modelo português...",
          "initializing api": "Preparando API...",
          "recognizing text": "Reconhecendo texto...",
        };
        const label = statusMap[m.status] || m.status;
        onProgress?.(label, m.progress);
      },
    });

    return {
      text: result.data.text,
      confidence: result.data.confidence,
    };
  } finally {
    if (typeof imageSource === "string") {
      URL.revokeObjectURL(imageSource);
    }
  }
}

// ========== Status helpers ==========
export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pendente: "Pendente",
    em_analise: "Em Análise",
    aprovado: "Aprovado",
    reprovado: "Reprovado",
  };
  return map[status] || status;
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    pendente: "bg-yellow-100 text-yellow-800",
    em_analise: "bg-blue-100 text-blue-800",
    aprovado: "bg-green-100 text-green-800",
    reprovado: "bg-red-100 text-red-800",
  };
  return map[status] || "bg-gray-100 text-gray-800";
}