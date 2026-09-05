import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const DEFAULT_CATEGORY_SEEDS = [
  { name: "Moradia", kind: "expense", color: "#6366f1", icon: "home" },
  { name: "Mercado", kind: "expense", color: "#10b981", icon: "shopping-cart" },
  { name: "Alimentação", kind: "expense", color: "#f59e0b", icon: "utensils" },
  { name: "Transporte", kind: "expense", color: "#0ea5e9", icon: "car" },
  { name: "Carro", kind: "expense", color: "#2563eb", icon: "wrench" },
  { name: "Saúde", kind: "expense", color: "#ef4444", icon: "heart-pulse" },
  { name: "Educação", kind: "expense", color: "#8b5cf6", icon: "graduation-cap" },
  { name: "Lazer", kind: "expense", color: "#ec4899", icon: "party-popper" },
  { name: "Assinaturas", kind: "expense", color: "#14b8a6", icon: "repeat" },
  { name: "Compras", kind: "expense", color: "#f97316", icon: "shopping-bag" },
  { name: "Doações", kind: "expense", color: "#0d9488", icon: "hand-heart" },
  { name: "Dízimo", kind: "expense", color: "#059669", icon: "hand-heart" },
  { name: "Telefone", kind: "expense", color: "#06b6d4", icon: "phone" },
  { name: "Milhas", kind: "expense", color: "#eab308", icon: "plane" },
  { name: "Contas", kind: "expense", color: "#f43f5e", icon: "receipt" },
  { name: "Juros", kind: "expense", color: "#e11d48", icon: "percent" },
  { name: "Viagem", kind: "expense", color: "#38bdf8", icon: "plane" },
  { name: "Outros", kind: "expense", color: "#64748b", icon: "circle-dashed" },
  { name: "Salário", kind: "income", color: "#22c55e", icon: "wallet" },
  { name: "Freelance", kind: "income", color: "#10b981", icon: "briefcase" },
  { name: "Outras entradas", kind: "income", color: "#84cc16", icon: "plus-circle" },
];

type AuthenticatedClient = Parameters<
  Parameters<typeof requireSupabaseAuth>[0]
>[0] extends never
  ? never
  : unknown;

async function ensureDefaultCategoriesInDb(
  supabase: {
    from: (table: "categories") => ReturnType<
      Parameters<Parameters<typeof requireSupabaseAuth>[0]>[0]
    >;
  },
  userId: string,
) {
  const { data: dbCats, error: selectError } = await supabase.from("categories").select("*");
  if (selectError) throw selectError;
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
    const { error: insertErr } = await supabase
      .from("categories")
      .insert(missing.map((category) => ({ ...category, user_id: userId })));
    if (insertErr) throw insertErr;
  }

  const { data: allCats, error: allError } = await supabase
    .from("categories")
    .select("*")
    .order("name");
  if (allError) throw allError;
  return allCats ?? [];
}

export const syncCategoriesServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return await ensureDefaultCategoriesInDb(context.supabase, context.userId);
  });

/**
 * Assigns the legacy spreadsheet data (rows without an owner) to the first
 * user that signs in. Later accounts get a clean, empty workspace.
 */
export const claimLegacyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureDefaultCategoriesInDb(context.supabase, context.userId);
    return { claimed: false };
  });

export const clearYearDataServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { year: number }) => d)
  .handler(async ({ data: { year }, context }) => {
    const { error: txErr } = await context.supabase
      .from("transactions")
      .delete()
      .gte("occurred_on", `${year}-01-01`)
      .lte("occurred_on", `${year}-12-31`);
    if (txErr) throw txErr;

    const { error: histErr } = await context.supabase
      .from("monthly_history")
      .delete()
      .eq("year", year);
    if (histErr) throw histErr;

    return { success: true, year };
  });
