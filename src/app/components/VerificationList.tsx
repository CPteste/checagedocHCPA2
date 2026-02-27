import { useState } from "react";
import { useNavigate } from "react-router";
import { useVerifications } from "./VerificationStore";
import { getStatusLabel, getStatusColor } from "./utils";
import { Search, Filter, ArrowRight, FilePlus } from "lucide-react";

export function VerificationList() {
  const { verifications } = useVerifications();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const filtered = verifications.filter((v) => {
    const matchSearch =
      !search ||
      v.formData.nome.toLowerCase().includes(search.toLowerCase()) ||
      v.formData.cpf.includes(search) ||
      v.formData.instituicao.toLowerCase().includes(search.toLowerCase()) ||
      v.id.toLowerCase().includes(search.toLowerCase());

    const matchStatus = statusFilter === "todos" || v.status === statusFilter;

    return matchSearch && matchStatus;
  });

  return (
    <div className="max-w-5xl space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CPF, instituição ou ID..."
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--input-background)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--input-background)] text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] appearance-none"
            >
              <option value="todos">Todos os Status</option>
              <option value="pendente">Pendente</option>
              <option value="em_analise">Em Análise</option>
              <option value="aprovado">Aprovado</option>
              <option value="reprovado">Reprovado</option>
            </select>
          </div>
          <button
            onClick={() => navigate("/nova-verificacao")}
            className="px-4 py-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 text-[14px] flex items-center gap-2 whitespace-nowrap"
          >
            <FilePlus className="w-4 h-4" />
            Nova
          </button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-[13px] text-[var(--muted-foreground)]">
        {filtered.length} verificação{filtered.length !== 1 ? "ões" : ""} encontrada{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Table */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-5 py-3 text-left text-[12px] text-[var(--muted-foreground)]">ID</th>
                <th className="px-5 py-3 text-left text-[12px] text-[var(--muted-foreground)]">Nome</th>
                <th className="px-5 py-3 text-left text-[12px] text-[var(--muted-foreground)]">Instituição</th>
                <th className="px-5 py-3 text-left text-[12px] text-[var(--muted-foreground)]">CPF</th>
                <th className="px-5 py-3 text-left text-[12px] text-[var(--muted-foreground)]">Data</th>
                <th className="px-5 py-3 text-left text-[12px] text-[var(--muted-foreground)]">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => navigate(`/verificacoes/${v.id}`)}
                  className="hover:bg-[var(--accent)] cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3 text-[13px] text-[var(--muted-foreground)]">{v.id}</td>
                  <td className="px-5 py-3 text-[14px]">{v.formData.nome}</td>
                  <td className="px-5 py-3 text-[13px]">{v.formData.instituicao}</td>
                  <td className="px-5 py-3 text-[13px] text-[var(--muted-foreground)]">{v.formData.cpf}</td>
                  <td className="px-5 py-3 text-[13px] text-[var(--muted-foreground)]">
                    {v.createdAt.toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[11px] px-2.5 py-1 rounded-full ${getStatusColor(v.status)}`}>
                      {getStatusLabel(v.status)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <ArrowRight className="w-4 h-4 text-[var(--muted-foreground)]" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-[var(--border)]">
          {filtered.map((v) => (
            <button
              key={v.id}
              onClick={() => navigate(`/verificacoes/${v.id}`)}
              className="w-full p-4 text-left hover:bg-[var(--accent)] transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[14px]">{v.formData.nome}</span>
                <span className={`text-[11px] px-2.5 py-1 rounded-full ${getStatusColor(v.status)}`}>
                  {getStatusLabel(v.status)}
                </span>
              </div>
              <p className="text-[12px] text-[var(--muted-foreground)]">
                {v.id} &middot; {v.formData.instituicao} &middot; {v.createdAt.toLocaleDateString("pt-BR")}
              </p>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-[var(--muted-foreground)] text-[14px]">
            Nenhuma verificação encontrada com os filtros aplicados.
          </div>
        )}
      </div>
    </div>
  );
}
