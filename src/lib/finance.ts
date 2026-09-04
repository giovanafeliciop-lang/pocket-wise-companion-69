import { supabase } from "@/integrations/supabase/client";

export type Kind = "expense" | "income";

export type Category = {
  id: string;
  name: string;
  kind: string;
  color: string;
  icon: string;
};

export type Transaction = {
  id: string;
  kind: string;
  description: string;
  amount: number;
  occurred_on: string;
  category_id: string | null;
  payment_method: string;
  card_name: string | null;
  is_paid: boolean;
  paid_at: string | null;
  source: string;
  notes: string | null;
  created_at: string;
};

export type MonthlyHistory = {
  id: string;
  year: number;
  month: number;
  expenses: number;
  income: number;
};

export const CREDIT_CARDS = [
  "Nubank G",
  "Elo",
  "Santander GOL",
  "Amazon",
  "C6",
  "XP",
  "Mercado Pago",
  "Picpay",
  "Outro",
] as const;

export const PAYMENT_METHODS = [
  { value: "pix", label: "Pix" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "credito", label: "Cartão de crédito" },
  { value: "debito", label: "Cartão de débito" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
];

export const AVAILABLE_YEARS = [
  2023,
  2024,
  2025,
  2026,
  2027,
  2028,
  2029,
  2030,
] as const;

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const monthRange = (year: number, month: number) => {
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, month + 1, 0));
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
};

export function isInvoiceItem(t: Transaction): boolean {
  return (
    t.kind === "expense" &&
    t.payment_method === "credito" &&
    Boolean(t.card_name) &&
    (t.source === "fatura" || t.source === "invoice" || t.source === "invoice_import")
  );
}

export function isInvoicePaidWithCreditCard(t: Transaction): boolean {
  if (!t.is_paid || t.kind !== "expense") return false;
  if (!isInvoiceItem(t)) return false;
  const notesLower = (t.notes || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    notesLower.includes("via cartao") ||
    notesLower.includes("pago com cartao") ||
    notesLower.includes("pago no cartao")
  );
}

export function isCreditCardExpense(t: Transaction): boolean {
  if (t.kind !== "expense") return false;
  // 1. Compra manual no cartão de crédito (não é fatura)
  const isManual =
    t.payment_method === "credito" &&
    t.source !== "fatura" &&
    t.source !== "invoice" &&
    t.source !== "invoice_import";
  if (isManual) return true;

  // 2. Item de fatura que foi pago com outro cartão de crédito
  return isInvoicePaidWithCreditCard(t);
}

export function isDirectExpense(t: Transaction): boolean {
  if (t.kind !== "expense") return false;
  return !isCreditCardExpense(t);
}

export function calculateRecurringDates(startDateStr: string, totalMonths: number): string[] {
  if (totalMonths <= 1 || !startDateStr) return [startDateStr];
  const parts = startDateStr.split("-");
  if (parts.length < 3) return [startDateStr];
  const baseYear = parseInt(parts[0] || "", 10);
  const baseMonth = parseInt(parts[1] || "", 10);
  const baseDay = parseInt(parts[2] || "", 10);
  if (isNaN(baseYear) || isNaN(baseMonth) || isNaN(baseDay)) return [startDateStr];

  const dates: string[] = [];
  for (let i = 0; i < totalMonths; i++) {
    const totalMonthIndex = baseYear * 12 + (baseMonth - 1) + i;
    const y = Math.floor(totalMonthIndex / 12);
    const m = (totalMonthIndex % 12) + 1;
    const maxDaysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const d = Math.min(baseDay, maxDaysInMonth);
    const formatted = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    dates.push(formatted);
  }
  return dates;
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from("categories").select("*").order("name");
  if (error) throw error;
  const list = (data ?? []) as Category[];

  // Garante que categorias essenciais padrão existam no banco
  const requiredDefaults = [
    { name: "Mercado", kind: "expense", color: "#10b981", icon: "shopping-cart" },
    { name: "Doações", kind: "expense", color: "#0d9488", icon: "hand-heart" },
    { name: "Juros", kind: "expense", color: "#e11d48", icon: "percent" },
  ];

  const missingDefaults = requiredDefaults.filter(
    (req) =>
      !list.some(
        (c) =>
          c.name
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim() ===
          req.name
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim()
      )
  );

  if (missingDefaults.length > 0) {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      for (const missingCat of missingDefaults) {
        const { data: created, error: insertErr } = await supabase
          .from("categories")
          .insert({
            ...missingCat,
            ...(userId ? { user_id: userId } : {}),
          })
          .select("*")
          .maybeSingle();

        if (!insertErr && created) {
          list.push(created as Category);
        }
      }
      list.sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      console.warn("Nao foi possivel autoinserir categorias padrão:", e);
    }
  }

  return list;
}

export async function resolveCategoryId(idOrName: string | null | undefined): Promise<string | null> {
  if (!idOrName) return null;
  const trimmed = idOrName.trim();
  if (!trimmed) return null;

  // 1. Tenta achar categoria existente por ID exato
  const { data: byId } = await supabase
    .from("categories")
    .select("id")
    .eq("id", trimmed)
    .maybeSingle();

  if (byId?.id) return byId.id;

  // 2. Tenta achar categoria existente por Nome exato (case-insensitive)
  const { data: byName } = await supabase
    .from("categories")
    .select("id")
    .ilike("name", trimmed)
    .maybeSingle();

  if (byName?.id) return byName.id;

  // 3. Mapeamento de sinonimos comuns de importacao
  const upper = trimmed.toUpperCase();
  let searchName = trimmed;
  let defaultColor = "#64748b";
  let defaultIcon = "tag";

  if (
    upper.includes("MERCADO") ||
    upper.includes("SUPERMERCADO") ||
    upper.includes("HIPERMERCADO") ||
    upper.includes("ATACADAO") ||
    upper.includes("ASSAI") ||
    upper.includes("CARREFOUR") ||
    upper.includes("HORTIFRUTI") ||
    upper.includes("SACOLAO") ||
    upper.includes("ACOUGUE") ||
    upper.includes("PAO DE ACUCAR")
  ) {
    searchName = "Mercado";
    defaultColor = "#10b981";
    defaultIcon = "shopping-cart";
  } else if (
    upper.includes("TELEFONE") ||
    upper.includes("CELULAR") ||
    upper.includes("INTERNET") ||
    upper.includes("VIVO") ||
    upper.includes("CLARO") ||
    upper.includes("TIM")
  ) {
    searchName = "Telefone / Internet";
    defaultColor = "#0284c7";
    defaultIcon = "phone";
  } else if (
    upper.includes("CONTAS") ||
    upper.includes("LUZ") ||
    upper.includes("AGUA") ||
    upper.includes("ENERGIA") ||
    upper.includes("GAS")
  ) {
    searchName = "Contas Básicas";
    defaultColor = "#f43f5e";
    defaultIcon = "receipt";
  } else if (
    upper.includes("ALIMENTA") ||
    upper.includes("RESTAURANTE") ||
    upper.includes("IFOOD") ||
    upper.includes("PADARIA") ||
    upper.includes("LANCHONETE") ||
    upper.includes("BURGER") ||
    upper.includes("PIZZA") ||
    upper.includes("DELIVERY")
  ) {
    searchName = "Alimentação";
    defaultColor = "#f59e0b";
    defaultIcon = "utensils";
  } else if (
    upper.includes("TRANSPORTE") ||
    upper.includes("UBER") ||
    upper.includes("COMBUSTIVEL") ||
    upper.includes("GASOLINA") ||
    upper.includes("CARRO") ||
    upper.includes("POSTO")
  ) {
    searchName = "Transporte";
    defaultColor = "#0ea5e9";
    defaultIcon = "car";
  } else if (
    upper.includes("SAUDE") ||
    upper.includes("FARMACIA") ||
    upper.includes("MEDICO") ||
    upper.includes("HOSPITAL") ||
    upper.includes("DROGARIA")
  ) {
    searchName = "Saúde";
    defaultColor = "#ef4444";
    defaultIcon = "heart-pulse";
  } else if (
    upper.includes("LAZER") ||
    upper.includes("STREAMING") ||
    upper.includes("NETFLIX") ||
    upper.includes("VIAGEM") ||
    upper.includes("SHOW") ||
    upper.includes("CINEMA")
  ) {
    searchName = "Lazer";
    defaultColor = "#ec4899";
    defaultIcon = "party-popper";
  } else if (
    upper.includes("COMPRAS") ||
    upper.includes("ROUPA") ||
    upper.includes("AMAZON") ||
    upper.includes("MERCADOLIVRE") ||
    upper.includes("SHOPPING") ||
    upper.includes("SHEIN") ||
    upper.includes("SHOPEE")
  ) {
    searchName = "Compras";
    defaultColor = "#f97316";
    defaultIcon = "shopping-bag";
  } else if (
    upper.includes("CASA") ||
    upper.includes("MORADIA") ||
    upper.includes("ALUGUEL") ||
    upper.includes("CONDOMINIO")
  ) {
    searchName = "Moradia";
    defaultColor = "#6366f1";
    defaultIcon = "home";
  } else if (
    upper.includes("EDUCACAO") ||
    upper.includes("CURSO") ||
    upper.includes("LIVRO") ||
    upper.includes("FACULDADE") ||
    upper.includes("ESCOLA")
  ) {
    searchName = "Educação";
    defaultColor = "#8b5cf6";
    defaultIcon = "graduation-cap";
  } else if (
    upper.includes("DOACAO") ||
    upper.includes("DOACOES") ||
    upper.includes("DOAR") ||
    upper.includes("ONG") ||
    upper.includes("CARIDADE")
  ) {
    searchName = "Doações";
    defaultColor = "#0d9488";
    defaultIcon = "hand-heart";
  } else if (upper.includes("DIZIMO") || upper.includes("OFERTA")) {
    searchName = "Dízimo";
    defaultColor = "#059669";
    defaultIcon = "hand-heart";
  } else if (upper.includes("ASSINATURA") || upper.includes("MENSALIDADE") || upper.includes("SPOTIFY")) {
    searchName = "Assinaturas";
    defaultColor = "#14b8a6";
    defaultIcon = "repeat";
  } else if (upper.includes("MILHA") || upper.includes("SMILES") || upper.includes("LATAM") || upper.includes("AZUL") || upper.includes("LIVELO")) {
    searchName = "Milhas";
    defaultColor = "#eab308";
    defaultIcon = "plane";
  } else if (
    upper.includes("JUROS") ||
    upper.includes("ENCARGO") ||
    upper.includes("MULTA") ||
    upper.includes("IOF") ||
    upper.includes("ROTATIVO") ||
    upper.includes("MORA")
  ) {
    searchName = "Juros";
    defaultColor = "#e11d48";
    defaultIcon = "percent";
  }

  // Verifica novamente apos normalizacao de sinonimo
  const { data: bySynonym } = await supabase
    .from("categories")
    .select("id")
    .ilike("name", searchName)
    .maybeSingle();

  if (bySynonym?.id) return bySynonym.id;

  // 4. Se nao existe, cria dinamicamente a categoria
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;

  const { data: newCat, error } = await supabase
    .from("categories")
    .insert({
      name: searchName,
      kind: "expense",
      color: defaultColor,
      icon: defaultIcon,
      ...(userId ? { user_id: userId } : {}),
    })
    .select("id")
    .maybeSingle();

  if (error || !newCat?.id) {
    console.warn("Nao foi possivel criar categoria automatica:", error?.message);
    return null;
  }

  return newCat.id;
}

export async function fetchTransactions(year: number, month: number): Promise<Transaction[]> {
  const { start, end } = monthRange(year, month);
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .gte("occurred_on", start)
    .lte("occurred_on", end)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Transaction[];
}

export async function fetchMonthlyHistory(year: number): Promise<MonthlyHistory[]> {
  const { data, error } = await supabase
    .from("monthly_history")
    .select("*")
    .eq("year", year)
    .order("month");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    expenses: Number(r.expenses),
    income: Number(r.income),
  })) as MonthlyHistory[];
}

export async function fetchYearTransactions(year: number): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .gte("occurred_on", `${year}-01-01`)
    .lte("occurred_on", `${year}-12-31`);
  if (error) throw error;
  return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Transaction[];
}

export async function fetchAllYearsHistory(): Promise<MonthlyHistory[]> {
  const { data, error } = await supabase
    .from("monthly_history")
    .select("*")
    .order("year")
    .order("month");
  if (error) return [];
  return (data ?? []).map((r) => ({
    ...r,
    expenses: Number(r.expenses),
    income: Number(r.income),
  })) as MonthlyHistory[];
}

export async function fetchAllYearsTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("occurred_on");
  if (error) return [];
  return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) })) as Transaction[];
}

export type TransactionInput = {
  kind: Kind;
  description: string;
  amount: number;
  occurred_on: string;
  category_id: string | null;
  payment_method: string;
  card_name?: string | null;
  is_paid: boolean;
  source?: string;
  notes?: string | null;
};

export async function createTransactions(rows: TransactionInput[]) {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Sessão expirada. Entre novamente.");

  const payload = await Promise.all(
    rows.map(async (r) => {
      const validCatId = await resolveCategoryId(r.category_id);
      return {
        ...r,
        category_id: validCatId,
        user_id: userId,
        source: r.source ?? "manual",
        paid_at: r.is_paid ? new Date().toISOString() : null,
      };
    })
  );

  const { error } = await supabase.from("transactions").insert(payload);
  if (error) throw error;
}

export async function updateTransaction(id: string, patch: Partial<TransactionInput>) {
  const finalPatch = { ...patch };
  if (patch.category_id !== undefined) {
    finalPatch.category_id = await resolveCategoryId(patch.category_id);
  }
  const { error } = await supabase.from("transactions").update(finalPatch).eq("id", id);
  if (error) throw error;
}

export async function togglePaid(id: string, isPaid: boolean) {
  const { error } = await supabase
    .from("transactions")
    .update({ is_paid: isPaid, paid_at: isPaid ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

export async function toggleBatchPaid(ids: string[], isPaid: boolean) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("transactions")
    .update({ is_paid: isPaid, paid_at: isPaid ? new Date().toISOString() : null })
    .in("id", ids);
  if (error) throw error;
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteInvoice(ids: string[]) {
  if (ids.length === 0) return;
  const { error } = await supabase.from("transactions").delete().in("id", ids);
  if (error) throw error;
}

export type PayInvoiceParams = {
  items: Transaction[];
  isPartial: boolean;
  paidAmount: number;
  paymentMethod: string;
  otherCardName?: string | null;
  paidAtDate: string; // YYYY-MM-DD
};

export async function payInvoice(params: PayInvoiceParams) {
  const { items, isPartial, paidAmount, paymentMethod, otherCardName, paidAtDate } = params;
  if (items.length === 0) return;

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;

  const paidAtIso = `${paidAtDate}T12:00:00.000Z`;
  const paymentMethodLabel =
    paymentMethod === "credito"
      ? otherCardName
        ? `Cartão ${otherCardName}`
        : "Cartão de Crédito"
      : paymentMethod === "pix"
        ? "Pix"
        : paymentMethod === "debito"
          ? "Cartão de Débito"
          : paymentMethod === "boleto"
            ? "Boleto Bancário"
            : paymentMethod === "dinheiro"
              ? "Dinheiro / Conta"
              : paymentMethod;

  if (!isPartial) {
    // Pagamento integral
    const itemIds = items.map((i) => i.id);
    const noteText = `Fatura paga integralmente via ${paymentMethodLabel} em ${formatDate(paidAtDate)}`;
    const { error } = await supabase
      .from("transactions")
      .update({
        is_paid: true,
        paid_at: paidAtIso,
        notes: noteText,
      })
      .in("id", itemIds);
    if (error) throw error;
    return;
  }

  // Pagamento Parcial
  const total = items.reduce((s, i) => s + i.amount, 0);
  const actualPaid = Math.max(0, Math.min(paidAmount, total));
  let remainingToPay = actualPaid;

  for (const item of items) {
    if (remainingToPay <= 0) {
      // Itens não cobertos continuam em aberto com aviso de juros
      await supabase
        .from("transactions")
        .update({
          is_paid: false,
          paid_at: null,
          notes: "Saldo restante de fatura parcial — gerará juros na próxima fatura",
        })
        .eq("id", item.id);
    } else if (item.amount <= remainingToPay + 0.001) {
      // Item totalmente pago pelo valor parcial
      await supabase
        .from("transactions")
        .update({
          is_paid: true,
          paid_at: paidAtIso,
          notes: `Pago via ${paymentMethodLabel} em ${formatDate(paidAtDate)} (Pagamento Parcial da Fatura)`,
        })
        .eq("id", item.id);
      remainingToPay -= item.amount;
    } else {
      // Item divide entre o que foi pago e o que ficou pendente
      const paidPortion = Number(remainingToPay.toFixed(2));
      const unpaidPortion = Number((item.amount - paidPortion).toFixed(2));

      // Atualiza o item atual como a parte paga
      await supabase
        .from("transactions")
        .update({
          amount: paidPortion,
          is_paid: true,
          paid_at: paidAtIso,
          notes: `Pago ${brl(paidPortion)} via ${paymentMethodLabel} em ${formatDate(paidAtDate)} (Pagamento Parcial)`,
        })
        .eq("id", item.id);

      // Cria a parte restante como pendente
      if (unpaidPortion > 0 && userId) {
        await supabase.from("transactions").insert({
          user_id: userId,
          kind: "expense",
          description: `${item.description} (Saldo restante)`,
          amount: unpaidPortion,
          occurred_on: item.occurred_on,
          category_id: item.category_id,
          payment_method: "credito",
          card_name: item.card_name,
          source: item.source ?? "fatura",
          is_paid: false,
          notes: "Saldo devedor restante de fatura parcial — gerará juros e encargos na próxima fatura",
        });
      }

      remainingToPay = 0;
    }
  }
}

export async function clearYearData(year: number) {
  try {
    const { clearYearDataServerFn } = await import("./claim.functions");
    await clearYearDataServerFn({ data: { year } });
  } catch (err) {
    console.warn("Fallback de exclusão direta:", err);
    await supabase
      .from("transactions")
      .delete()
      .gte("occurred_on", `${year}-01-01`)
      .lte("occurred_on", `${year}-12-31`);

    await supabase
      .from("monthly_history")
      .delete()
      .eq("year", year);
  }
}
