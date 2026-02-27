import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-a86ed2e4/health", (c) => {
  return c.json({ status: "ok" });
});

// ===== CPF Proxy - consulta ReceitaWS sem CORS =====
app.get("/make-server-a86ed2e4/cpf/:cpf", async (c) => {
  const cpf = c.req.param("cpf").replace(/\D/g, "");

  if (cpf.length !== 11) {
    return c.json({ error: "CPF deve ter 11 dígitos" }, 400);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `https://www.receitaws.com.br/v1/cpf/${cpf}`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "ChecaDoc/1.0",
        },
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`[CPF Proxy] ReceitaWS retornou status ${response.status} para CPF ${cpf.slice(0, 3)}***`);
      return c.json({
        error: "ReceitaWS indisponível",
        status: response.status,
      }, 502);
    }

    const data = await response.json();
    console.log(`[CPF Proxy] Consulta OK para CPF ${cpf.slice(0, 3)}*** - situação: ${data.situacao || data.message || "N/A"}`);
    return c.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[CPF Proxy] Erro ao consultar ReceitaWS: ${msg}`);
    return c.json({ error: `Falha na consulta: ${msg}` }, 502);
  }
});

Deno.serve(app.fetch);