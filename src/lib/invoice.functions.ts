import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  mode: z.enum(["text", "file"]),
  text: z.string().optional(),
  fileData: z.string().optional(),
  mimeType: z.string().optional(),
  categories: z.array(z.string()),
});

export type ParsedInvoiceItem = {
  description: string;
  amount: number;
  occurred_on: string;
  category: string;
};

export const parseInvoice = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }): Promise<{ items: ParsedInvoiceItem[] }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("A IA não está configurada neste projeto.");

    const today = new Date().toISOString().slice(0, 10);
    const system = `Você extrai lançamentos de faturas de cartão de crédito brasileiras.
Responda SOMENTE com JSON válido no formato:
{"items":[{"description":"string","amount":number,"occurred_on":"YYYY-MM-DD","category":"string"}]}
Regras:
- amount sempre positivo, em reais, usando ponto decimal.
- Ignore pagamentos da fatura anterior, estornos e saldos/totais.
- occurred_on: use a data da compra. Se o ano não aparecer, assuma o ano de ${today.slice(0, 4)}. Se a data for ilegível, use ${today}.
- category deve ser exatamente uma destas: ${data.categories.join(", ")}.
- Classificação: Gastos com combustível (gasolina, etanol, diesel, abastecimento, postos) e corridas (Uber, 99, táxi) devem ser categorizados como "Transporte". Gastos com oficina mecânica, conserto, pneus e peças do veículo devem ser "Carro".
- Não invente lançamentos que não estejam no documento.`;

    const content: Array<Record<string, unknown>> = [
      { type: "text", text: "Extraia todos os lançamentos desta fatura." },
    ];

    if (data.mode === "text") {
      content.push({ type: "text", text: data.text ?? "" });
    } else {
      const mime = data.mimeType ?? "application/pdf";
      const dataUrl = `data:${mime};base64,${data.fileData}`;
      if (mime.startsWith("image/")) {
        content.push({ type: "image_url", image_url: { url: dataUrl } });
      } else {
        content.push({
          type: "file",
          file: { filename: "fatura.pdf", file_data: dataUrl },
        });
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
      }),
    });

    if (response.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (response.status === 402) throw new Error("Créditos de IA insuficientes no workspace.");
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Falha ao ler a fatura: ${detail.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = payload.choices?.[0]?.message?.content ?? "";
    const jsonText = raw.replace(/```json|```/g, "").trim();
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("Não consegui identificar lançamentos nesse arquivo.");

    const parsed = JSON.parse(jsonText.slice(start, end + 1)) as { items?: ParsedInvoiceItem[] };
    const items = (parsed.items ?? [])
      .map((item) => ({
        description: String(item.description ?? "Lançamento"),
        amount: Math.abs(Number(item.amount) || 0),
        occurred_on: /^\d{4}-\d{2}-\d{2}$/.test(String(item.occurred_on))
          ? String(item.occurred_on)
          : today,
        category: String(item.category ?? "Outros"),
      }))
      .filter((item) => item.amount > 0);

    return { items };
  });
