import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { kvSet, kvGet, kvGetByPrefix, kvDel } from "./supabaseClient";
import { toast } from "sonner";

export type VerificationStatus = "pendente" | "em_analise" | "aprovado" | "reprovado";

export interface CepResult {
  valid: boolean;
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  error?: string;
}

export interface CpfResult {
  valid: boolean;
  cpf: string;
  situacao?: string;
  message?: string;
}

export interface OcrResult {
  text: string;
  confidence: number;
  institutionFound?: string;
  institutionMatch?: boolean;
  errorDetail?: string;
}

export interface Verification {
  id: string;
  createdAt: Date;
  status: VerificationStatus;
  formData: {
    nome: string;
    cpf: string;
    email: string;
    telefone: string;
    instituicao: string;
    curso: string;
    cep: string;
    endereco: string;
  };
  documentFile?: File;
  documentPreview?: string;
  ocrResult?: OcrResult;
  cepResult?: CepResult;
  cpfResult?: CpfResult;
}

// Serializable version (no File, Date as string)
interface StoredVerification {
  id: string;
  createdAt: string;
  status: VerificationStatus;
  formData: Verification["formData"];
  documentPreview?: string;
  ocrResult?: OcrResult;
  cepResult?: CepResult;
  cpfResult?: CpfResult;
}

const KV_PREFIX = "checadoc:ver:";
const KV_INDEX = "checadoc:index";

function toStored(v: Verification): StoredVerification {
  return {
    id: v.id,
    createdAt: v.createdAt instanceof Date ? v.createdAt.toISOString() : String(v.createdAt),
    status: v.status,
    formData: v.formData,
    documentPreview: v.documentPreview,
    ocrResult: v.ocrResult,
    cepResult: v.cepResult,
    cpfResult: v.cpfResult,
  };
}

function fromStored(s: StoredVerification): Verification {
  return {
    ...s,
    createdAt: new Date(s.createdAt),
  };
}

interface VerificationContextType {
  verifications: Verification[];
  addVerification: (v: Verification) => void;
  updateVerification: (id: string, updates: Partial<Verification>) => void;
  getVerification: (id: string) => Verification | undefined;
  deleteVerification: (id: string) => void;
  loading: boolean;
  syncing: boolean;
  syncError: string | null;
}

const VerificationContext = createContext<VerificationContextType | null>(null);

export function useVerifications() {
  const ctx = useContext(VerificationContext);
  if (!ctx) throw new Error("useVerifications must be used within VerificationProvider");
  return ctx;
}

// Mock data for initial seeding
const mockVerifications: Verification[] = [
  {
    id: "VER-001",
    createdAt: new Date(2026, 1, 25),
    status: "aprovado",
    formData: {
      nome: "Maria Silva Santos",
      cpf: "123.456.789-09",
      email: "maria.silva@email.com",
      telefone: "(11) 98765-4321",
      instituicao: "Universidade de São Paulo",
      curso: "Engenharia de Computação",
      cep: "05508-010",
      endereco: "Rua do Matão, 1010 - Butantã",
    },
    ocrResult: { text: "Universidade de São Paulo - Comprovante de Matrícula", confidence: 94, institutionFound: "Universidade de São Paulo", institutionMatch: true },
    cepResult: { valid: true, cep: "05508-010", logradouro: "Rua do Matão", bairro: "Butantã", localidade: "São Paulo", uf: "SP" },
    cpfResult: { valid: true, cpf: "123.456.789-09", situacao: "Regular" },
  },
  {
    id: "VER-002",
    createdAt: new Date(2026, 1, 26),
    status: "reprovado",
    formData: {
      nome: "João Pedro Oliveira",
      cpf: "987.654.321-00",
      email: "joao.pedro@email.com",
      telefone: "(21) 91234-5678",
      instituicao: "Universidade Federal do Rio de Janeiro",
      curso: "Administração",
      cep: "00000-000",
      endereco: "Av. Pedro Calmon, 550",
    },
    ocrResult: { text: "PUC-Rio - Comprovante de Matrícula", confidence: 87, institutionFound: "PUC-Rio", institutionMatch: false },
    cepResult: { valid: false, error: "CEP não encontrado na base dos Correios" },
    cpfResult: { valid: false, cpf: "987.654.321-00", situacao: "Inexistente", message: "CPF não encontrado na base da Receita Federal" },
  },
  {
    id: "VER-003",
    createdAt: new Date(2026, 1, 27),
    status: "em_analise",
    formData: {
      nome: "Ana Beatriz Costa",
      cpf: "456.789.123-45",
      email: "ana.costa@email.com",
      telefone: "(31) 99876-5432",
      instituicao: "UFMG",
      curso: "Medicina",
      cep: "31270-901",
      endereco: "Av. Antônio Carlos, 6627 - Pampulha",
    },
    ocrResult: { text: "Universidade Federal de Minas Gerais - Declaração de Vínculo", confidence: 91, institutionFound: "Universidade Federal de Minas Gerais", institutionMatch: true },
    cepResult: { valid: true, cep: "31270-901", logradouro: "Avenida Presidente Antônio Carlos", bairro: "Pampulha", localidade: "Belo Horizonte", uf: "MG" },
  },
  {
    id: "VER-004",
    createdAt: new Date(2026, 1, 27),
    status: "pendente",
    formData: {
      nome: "Carlos Eduardo Lima",
      cpf: "321.654.987-12",
      email: "carlos.lima@email.com",
      telefone: "(41) 98765-1234",
      instituicao: "UTFPR",
      curso: "Ciência da Computação",
      cep: "80230-901",
      endereco: "Av. Sete de Setembro, 3165",
    },
  },
];

export function VerificationProvider({ children }: { children: React.ReactNode }) {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  // Load verifications from Supabase on mount
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    async function loadFromDb() {
      try {
        const results = await kvGetByPrefix(KV_PREFIX);

        if (results.length > 0) {
          const loaded = results
            .map((r) => fromStored(r.value as StoredVerification))
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          setVerifications(loaded);
        } else {
          // First time: seed with sample data
          const seedPromises = mockVerifications.map((v) =>
            kvSet(`${KV_PREFIX}${v.id}`, toStored(v))
          );
          await Promise.all(seedPromises);
          setVerifications(mockVerifications);
          toast.success("Banco de dados conectado! Dados iniciais carregados.");
        }
        setSyncError(null);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("[ChecaDoc] Erro ao carregar do Supabase:", errorMsg);
        setSyncError(errorMsg);

        // Fallback to sample data if DB is unreachable
        setVerifications(mockVerifications);
        toast.error("Erro ao conectar ao banco. Usando dados locais.", {
          description: errorMsg,
        });
      } finally {
        setLoading(false);
      }
    }

    loadFromDb();
  }, []);

  const persistVerification = useCallback(async (v: Verification) => {
    setSyncing(true);
    try {
      await kvSet(`${KV_PREFIX}${v.id}`, toStored(v));
      setSyncError(null);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[ChecaDoc] Erro ao salvar ${v.id}:`, errorMsg);
      setSyncError(errorMsg);
      toast.error(`Erro ao salvar ${v.id} no banco`, { description: errorMsg });
    } finally {
      setSyncing(false);
    }
  }, []);

  const addVerification = useCallback((v: Verification) => {
    setVerifications((prev) => [v, ...prev]);
    persistVerification(v);
  }, [persistVerification]);

  const updateVerification = useCallback((id: string, updates: Partial<Verification>) => {
    setVerifications((prev) => {
      const updated = prev.map((v) => {
        if (v.id !== id) return v;
        const merged = { ...v, ...updates };
        persistVerification(merged);
        return merged;
      });
      return updated;
    });
  }, [persistVerification]);

  const deleteVerification = useCallback((id: string) => {
    setVerifications((prev) => prev.filter((v) => v.id !== id));
    kvDel(`${KV_PREFIX}${id}`).catch((err) => {
      console.error(`[ChecaDoc] Erro ao deletar ${id}:`, err);
      toast.error(`Erro ao deletar ${id} do banco`);
    });
  }, []);

  const getVerification = useCallback(
    (id: string) => verifications.find((v) => v.id === id),
    [verifications]
  );

  return (
    <VerificationContext.Provider
      value={{
        verifications,
        addVerification,
        updateVerification,
        deleteVerification,
        getVerification,
        loading,
        syncing,
        syncError,
      }}
    >
      {children}
    </VerificationContext.Provider>
  );
}