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

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-moradia", name: "Moradia", kind: "expense", color: "#6366f1", icon: "home" },
  { id: "cat-alimentacao", name: "Alimentação", kind: "expense", color: "#f59e0b", icon: "utensils" },
  { id: "cat-transporte", name: "Transporte", kind: "expense", color: "#0ea5e9", icon: "car" },
  { id: "cat-saude", name: "Saúde", kind: "expense", color: "#ef4444", icon: "heart-pulse" },
  { id: "cat-educacao", name: "Educação", kind: "expense", color: "#8b5cf6", icon: "graduation-cap" },
  { id: "cat-lazer", name: "Lazer", kind: "expense", color: "#ec4899", icon: "party-popper" },
  { id: "cat-assinaturas", name: "Assinaturas", kind: "expense", color: "#14b8a6", icon: "repeat" },
  { id: "cat-compras", name: "Compras", kind: "expense", color: "#f97316", icon: "shopping-bag" },
  { id: "cat-dizimo", name: "Dízimo", kind: "expense", color: "#10b981", icon: "hand-heart" },
  { id: "cat-telefone", name: "Telefone", kind: "expense", color: "#06b6d4", icon: "phone" },
  { id: "cat-milhas", name: "Milhas", kind: "expense", color: "#eab308", icon: "plane" },
  { id: "cat-contas", name: "Contas", kind: "expense", color: "#f43f5e", icon: "receipt" },
  { id: "cat-outros", name: "Outros", kind: "expense", color: "#64748b", icon: "circle-dashed" },
  { id: "cat-salario", name: "Salário", kind: "income", color: "#22c55e", icon: "wallet" },
  { id: "cat-freelance", name: "Freelance", kind: "income", color: "#10b981", icon: "briefcase" },
  { id: "cat-outras-entradas", name: "Outras entradas", kind: "income", color: "#84cc16", icon: "plus-circle" },
];

export async function fetchCategories(): Promise<Category[]> {
  try {
    const { data, error } = await supabase.from("categories").select("*").order("name");
    if (error) {
      console.warn("Aviso ao buscar categorias do Supabase, usando padrão:", error);
      return DEFAULT_CATEGORIES;
    }

    const dbCategories = (data ?? []) as Category[];
    if (dbCategories.length === 0) {
      return DEFAULT_CATEGORIES;
    }

    // Identifica se alguma das categorias padrão (ex: Dízimo, Telefone, Milhas, Contas) ainda não está no banco
    const existingNames = new Set(
      dbCategories.map((c) =>
        c.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
      )
    );
    const missingDefaults = DEFAULT_CATEGORIES.filter(
      (c) =>
        !existingNames.has(
          c.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
        )
    );

    if (missingDefaults.length > 0) {
      // Tenta inserir automaticamente no banco em segundo plano
      void (async () => {
        try {
          const toInsert = missingDefaults.map(({ name, kind, color, icon }) => ({
            name,
            kind,
            color,
            icon,
          }));
          await supabase.from("categories").insert(toInsert);
        } catch {
          // Ignora caso de permissão de RLS
        }
      })();

      return [...dbCategories, ...missingDefaults].sort((a, b) => a.name.localeCompare(b.name));
    }

    return dbCategories;
  } catch {
    return DEFAULT_CATEGORIES;
  }
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
  const payload = rows.map((r) => ({
    ...r,
    user_id: userId,
    source: r.source ?? "manual",
    paid_at: r.is_paid ? new Date().toISOString() : null,
  }));
  const { error } = await supabase.from("transactions").insert(payload);
  if (error) throw error;
}

export async function updateTransaction(id: string, patch: Partial<TransactionInput>) {
  const { error } = await supabase.from("transactions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function togglePaid(id: string, isPaid: boolean) {
  const { error } = await supabase
    .from("transactions")
    .update({ is_paid: isPaid, paid_at: isPaid ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTransaction(id: string) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}
