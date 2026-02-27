import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { NewVerification } from "./components/NewVerification";
import { VerificationList } from "./components/VerificationList";
import { VerificationDetail } from "./components/VerificationDetail";
import { Configuracoes } from "./components/Configuracoes";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Dashboard },
      { path: "nova-verificacao", Component: NewVerification },
      { path: "verificacoes", Component: VerificationList },
      { path: "verificacoes/:id", Component: VerificationDetail },
      { path: "configuracoes", Component: Configuracoes },
    ],
  },
]);
