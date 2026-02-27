import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { kvSet, kvGetByPrefix, kvDel } from "./supabaseClient";
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
  nome?: string;
  regiao?: string;
  dataConsulta?: string;
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
  clearAllVerifications: () => Promise<void>;
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

// Load verifications from Supabase on mount
export function VerificationProvider({ children }: { children: React.ReactNode }) {
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

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
        }
        // Empty DB = empty list (no more mock seeding)
        setSyncError(null);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("[ChecaDoc] Erro ao carregar do Supabase:", errorMsg);
        setSyncError(errorMsg);

        // Fallback to empty list if DB is unreachable
        setVerifications([]);
        toast.error("Erro ao conectar ao banco. Nenhum dado disponível.", {
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

  const clearAllVerifications = useCallback(async () => {
    setSyncing(true);
    try {
      const deletePromises = verifications.map((v) => kvDel(`${KV_PREFIX}${v.id}`));
      await Promise.all(deletePromises);
      setVerifications([]);
      setSyncError(null);
      toast.success("Todos os dados de verificação foram removidos.");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[ChecaDoc] Erro ao limpar verificações:", errorMsg);
      setSyncError(errorMsg);
      toast.error("Erro ao limpar dados", { description: errorMsg });
    } finally {
      setSyncing(false);
    }
  }, [verifications]);

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
        clearAllVerifications,
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