import { Outlet, useNavigate, useLocation } from "react-router";
import {
  LayoutDashboard,
  FilePlus,
  ClipboardCheck,
  Settings,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { VerificationProvider } from "./VerificationStore";
import { Toaster } from "sonner";

const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/nova-verificacao", label: "Nova Verificação", icon: FilePlus },
  { path: "/verificacoes", label: "Verificações", icon: ClipboardCheck },
  { path: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <VerificationProvider>
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[var(--card)] border-r border-[var(--border)] flex flex-col transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[var(--border)]">
          <div className="w-9 h-9 rounded-lg bg-[var(--primary)] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[var(--primary-foreground)]" />
          </div>
          <div>
            <h2 className="text-[15px]">ChecaDoc</h2>
            <p className="text-[12px] text-[var(--muted-foreground)]">Sistema de Verificação</p>
          </div>
          <button
            className="ml-auto lg:hidden p-1 rounded hover:bg-[var(--accent)]"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.path);
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-[14px] ${
                  isActive
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                }`}
              >
                <item.icon className="w-[18px] h-[18px]" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-[13px] text-[var(--foreground)]">
              AD
            </div>
            <div>
              <p className="text-[13px]">Administrador</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">admin@checadoc.com</p>
            </div>
          </div>
          <p className="text-[10px] text-[var(--muted-foreground)] text-center mt-3 opacity-60">
            v1.3.0 &middot; build 2025-02-27
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center px-4 lg:px-6 py-3 border-b border-[var(--border)] bg-[var(--card)]">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-[var(--accent)] mr-3"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-[16px]">
              {navItems.find(
                (i) =>
                  i.path === "/" ? location.pathname === "/" : location.pathname.startsWith(i.path)
              )?.label || "ChecaDoc"}
            </h1>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
    <Toaster position="top-right" />
    </VerificationProvider>
  );
}