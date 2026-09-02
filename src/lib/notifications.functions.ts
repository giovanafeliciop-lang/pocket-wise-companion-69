import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server function triggered from the dashboard to test or send the daily due expenses email.
 */
export const sendDueExpensesReminderServerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { executeRemindersForUser } = await import("@/lib/notifications.server");
    return await executeRemindersForUser(context.userId);
  });
