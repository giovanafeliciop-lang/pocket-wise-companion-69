import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Assigns the legacy spreadsheet data (rows without an owner) to the first
 * user that signs in. Later accounts get a clean, empty workspace.
 */
export const claimLegacyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
