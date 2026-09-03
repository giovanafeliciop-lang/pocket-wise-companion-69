import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const DEFAULT_CATEGORY_SEEDS = [
  { name: "Moradia", kind: "expense", color: "#6366f1", icon: "home" },
  { name: "Alimentação", kind: "expense", color: "#f59e0b", icon: "utensils" },
  { name: "Transporte", kind: "expense", color: "#0ea5e9", icon: "car" },
  { name: "Saúde", kind: "expense", color: "#ef4444", icon: "heart-pulse" },
  { name: "Educação", kind: "expense", color: "#8b5cf6", icon: "graduation-cap" },
  { name: "Lazer", kind: "expense", color: "#ec4899", icon: "party-popper" },
  { name: "Assinaturas", kind: "expense", color: "#14b8a6", icon: "repeat" },
  { name: "Compras", kind: "expense", color: "#f97316", icon: "shopping-bag" },
  { name: "Dízimo", kind: "expense", color: "#10b981", icon: "hand-heart" },
  { name: "Telefone", kind: "expense", color: "#06b6d4", icon: "phone" },
  { name: "Milhas", kind: "expense", color: "#eab308", icon: "plane" },
  { name: "Contas", kind: "expense", color: "#f43f5e", icon: "receipt" },
  { name: "Outros", kind: "expense", color: "#64748b", icon: "circle-dashed" },
  { name: "Salário", kind: "income", color: "#22c55e", icon: "wallet" },
  { name: "Freelance", kind: "income", color: "#10b981", icon: "briefcase" },
  { name: "Outras entradas", kind: "income", color: "#84cc16", icon: "plus-circle" },
];

export async function ensureDefaultCategoriesInDb() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: dbCats } = await supabaseAdmin.from("categories").select("*");
  const existing = new Set(
    (dbCats ?? []).map((c) =>
      c.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    )
  );

  const missing = DEFAULT_CATEGORY_SEEDS.filter(
    (c) =>
      !existing.has(
        c.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
      )
  );

  if (missing.length > 0) {
    const { error: insertErr } = await supabaseAdmin.from("categories").insert(missing);
    if (insertErr) {
      console.error("[Categories] Erro ao inserir categorias padrão:", insertErr);
    }
  }

  const { data: allCats } = await supabaseAdmin.from("categories").select("*").order("name");
  return allCats ?? [];
}

export const syncCategoriesServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return await ensureDefaultCategoriesInDb();
  });

/**
 * Assigns the legacy spreadsheet data (rows without an owner) to the first
 * user that signs in. Later accounts get a clean, empty workspace.
 */
export const claimLegacyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Garante que todas as categorias padrão existam no banco com IDs válidos
    await ensureDefaultCategoriesInDb();

    const { data: owned, error: ownedError } = await supabaseAdmin
      .from("monthly_history")
      .select("id")
      .not("user_id", "is", null)
      .limit(1);
    if (ownedError) throw ownedError;

    const { data: ownedTx, error: ownedTxError } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .not("user_id", "is", null)
      .limit(1);
    if (ownedTxError) throw ownedTxError;

    if ((owned?.length ?? 0) > 0 || (ownedTx?.length ?? 0) > 0) {
      return { claimed: false };
    }

    const userId = context.userId;
    const { error: historyError } = await supabaseAdmin
      .from("monthly_history")
      .update({ user_id: userId })
      .is("user_id", null);
    if (historyError) throw historyError;

    const { error: txError } = await supabaseAdmin
      .from("transactions")
      .update({ user_id: userId })
      .is("user_id", null);
    if (txError) throw txError;

    return { claimed: true };
  });
