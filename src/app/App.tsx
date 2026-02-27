import { RouterProvider } from "react-router";
import { router } from "./routes";
import { VerificationProvider } from "./components/VerificationStore";
import { Toaster } from "sonner";

export default function App() {
  return (
    <VerificationProvider>
      <RouterProvider router={router} />
      <Toaster position="top-right" />
    </VerificationProvider>
  );
}
