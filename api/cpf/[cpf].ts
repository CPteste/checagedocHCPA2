import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { cpf } = req.query;
  const cleanCpf = String(cpf).replace(/\D/g, "");

  if (cleanCpf.length !== 11) {
    return res.status(400).json({ error: "CPF deve ter 11 dígitos" });
  }

  // Tentar ReceitaWS primeiro
  try {
    console.log(`[CPF Proxy Vercel] Consultando ReceitaWS para CPF ${cleanCpf.slice(0, 3)}***`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `https://www.receitaws.com.br/v1/cpf/${cleanCpf}`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "ChecaDoc/1.4",
        },
      }
    );
    clearTimeout(timeout);

    const data = await response.json();
    console.log(`[CPF Proxy Vercel] ReceitaWS HTTP ${response.status} - situacao: ${data.situacao || data.message || "N/A"}`);

    if (!response.ok) {
      return res.status(502).json({
        error: "ReceitaWS indisponível",
        status: response.status,
        detail: data.message || data.type || JSON.stringify(data),
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[CPF Proxy Vercel] ReceitaWS falhou: ${msg}`);

    // Fallback: tentar BrasilAPI
    try {
      console.log(`[CPF Proxy Vercel] Tentando BrasilAPI como fallback...`);
      const response2 = await fetch(
        `https://brasilapi.com.br/api/cpf/v1/${cleanCpf}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "ChecaDoc/1.4",
          },
        }
      );

      const data2 = await response2.json();
      console.log(`[CPF Proxy Vercel] BrasilAPI HTTP ${response2.status}:`, JSON.stringify(data2).slice(0, 200));

      if (response2.ok && data2.name) {
        // BrasilAPI retorna { cpf, name, ... } — converter para formato ReceitaWS
        return res.status(200).json({
          situacao: "Regular",
          nome: data2.name,
          cpf: cleanCpf,
          source: "brasilapi",
        });
      }

      // BrasilAPI falhou também
      return res.status(502).json({
        error: `Ambos os serviços falharam. ReceitaWS: ${msg}. BrasilAPI: ${data2.message || response2.status}`,
      });
    } catch (err2) {
      const msg2 = err2 instanceof Error ? err2.message : String(err2);
      console.log(`[CPF Proxy Vercel] BrasilAPI também falhou: ${msg2}`);
      return res.status(502).json({
        error: `Ambos os serviços falharam. ReceitaWS: ${msg}. BrasilAPI: ${msg2}`,
      });
    }
  }
}
