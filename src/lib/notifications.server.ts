import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DueExpenseItem = {
  id: string;
  description: string;
  amount: number;
  category_name: string;
  category_color: string;
  payment_method: string;
  card_name: string | null;
  occurred_on: string;
};

export type ReminderResult = {
  success: boolean;
  userEmail: string;
  expensesCount: number;
  totalAmount: number;
  provider: "resend" | "logged";
  message: string;
};

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function generateDueExpensesEmailHtml({
  userEmail,
  dateStr,
  expenses,
  totalAmount,
}: {
  userEmail: string;
  dateStr: string;
  expenses: DueExpenseItem[];
  totalAmount: number;
}): string {
  const rowsHtml = expenses
    .map(
      (e) => `
    <tr style="border-bottom: 1px solid #27272a;">
      <td style="padding: 12px 8px; color: #f4f4f5; font-size: 14px; font-weight: 500;">
        ${e.description}
        <div style="font-size: 12px; color: #a1a1aa; margin-top: 2px;">
          ${e.payment_method === "credito" ? `Cartão: ${e.card_name || "Crédito"}` : e.payment_method}
        </div>
      </td>
      <td style="padding: 12px 8px; text-align: center;">
        <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; color: ${e.category_color}; border: 1px solid ${e.category_color}40; background-color: ${e.category_color}15;">
          ${e.category_name}
        </span>
      </td>
      <td style="padding: 12px 8px; text-align: right; color: #ef4444; font-size: 14px; font-weight: 600; font-family: monospace;">
        ${formatCurrency(e.amount)}
      </td>
    </tr>
  `,
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Lembrete de Vencimento de Despesas</title>
</head>
<body style="margin: 0; padding: 0; background-color: #09090b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
  <div style="max-width: 600px; margin: 20px auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 28px 24px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">
        Controle Financeiro
      </h1>
      <p style="margin: 6px 0 0 0; color: #d1fae5; font-size: 14px;">
        ⏰ Lembrete de Despesas Vencendo Hoje (${formatDate(dateStr)})
      </p>
    </div>

    <!-- Content -->
    <div style="padding: 24px;">
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #d4d4d8; line-height: 1.5;">
        Olá! Identificamos que você possui <strong>${expenses.length} despesa(s) em aberto</strong> com vencimento para o dia de hoje (<strong>${formatDate(dateStr)}</strong>):
      </p>

      <!-- Alert Box -->
      <div style="background-color: #451a03; border: 1px solid #f59e0b; border-radius: 12px; padding: 12px 16px; margin-bottom: 20px;">
        <p style="margin: 0; font-size: 13px; color: #fef3c7; font-weight: 500;">
          ⚠️ Total a pagar hoje: <strong style="font-size: 16px; color: #fbbf24;">${formatCurrency(totalAmount)}</strong>
        </p>
      </div>

      <!-- Table of Expenses -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="border-bottom: 2px solid #3f3f46; color: #a1a1aa; font-size: 12px; text-transform: uppercase;">
            <th style="padding: 8px; text-align: left;">Descrição</th>
            <th style="padding: 8px; text-align: center;">Categoria</th>
            <th style="padding: 8px; text-align: right;">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <!-- Call to Action -->
      <div style="text-align: center; margin-top: 28px; margin-bottom: 12px;">
        <p style="font-size: 13px; color: #a1a1aa; margin-bottom: 16px;">
          Ao realizar o pagamento, acesse o painel para marcar como pago e manter seu controle atualizado.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #121215; border-top: 1px solid #27272a; padding: 16px; text-align: center; font-size: 11px; color: #71717a;">
      <p style="margin: 0;">Este é um lembrete automático do seu aplicativo de Controle Financeiro.</p>
      <p style="margin: 4px 0 0 0;">Enviado para: ${userEmail}</p>
    </div>
  </div>
</body>
</html>
  `;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; provider: "resend" | "logged"; error?: string }> {
  const resendApiKey = process.env["RESEND_API_KEY"];
  const fromEmail = process.env["RESEND_FROM_EMAIL"] || "Controle Financeiro <onboarding@resend.dev>";

  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Notifications] Resend API error:", errorText);
        return { success: false, provider: "resend", error: errorText };
      }

      console.log(`[Notifications] Email enviado com sucesso via Resend para ${to}`);
      return { success: true, provider: "resend" };
    } catch (e) {
      console.error("[Notifications] Erro ao disparar e-mail via Resend:", e);
      return {
        success: false,
        provider: "resend",
        error: e instanceof Error ? e.message : "Erro desconhecido ao enviar e-mail",
      };
    }
  }

  // Se a chave RESEND_API_KEY ainda não estiver configurada no ambiente, registra o log completo
  console.log(`[Notifications] Lembrete gerado para ${to} - Assunto: "${subject}" (RESEND_API_KEY não configurada)`);
  return { success: true, provider: "logged" };
}

export async function executeRemindersForUser(
  userId: string,
  targetDate?: string,
): Promise<ReminderResult> {
  const dateStr = targetDate || new Date().toISOString().slice(0, 10);

  // 1. Obter e-mail do usuário
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userError || !userData?.user?.email) {
    throw new Error("Não foi possível identificar o e-mail do usuário.");
  }
  const userEmail = userData.user.email;

  // 2. Buscar categorias para colorir e rotular
  const { data: categoriesData } = await supabaseAdmin.from("categories").select("*");
  const categories = categoriesData ?? [];

  // 3. Buscar despesas do usuário em aberto vencendo hoje
  const { data: txData, error: txError } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("kind", "expense")
    .eq("is_paid", false)
    .eq("occurred_on", dateStr);

  if (txError) throw txError;

  const expenses: DueExpenseItem[] = (txData ?? []).map((t) => {
    const cat = categories.find((c) => c.id === t.category_id);
    return {
      id: t.id,
      description: t.description,
      amount: Number(t.amount),
      category_name: cat?.name ?? "Outros",
      category_color: cat?.color ?? "#888888",
      payment_method: t.payment_method,
      card_name: t.card_name,
      occurred_on: t.occurred_on,
    };
  });

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  if (expenses.length === 0) {
    return {
      success: true,
      userEmail,
      expensesCount: 0,
      totalAmount: 0,
      provider: "logged",
      message: `Nenhuma despesa em aberto vencendo hoje (${formatDate(dateStr)}).`,
    };
  }

  // 4. Montar o e-mail e disparar
  const html = generateDueExpensesEmailHtml({
    userEmail,
    dateStr,
    expenses,
    totalAmount,
  });

  const subject = `⏰ Lembrete: Você tem ${expenses.length} conta(s) vencendo hoje (${formatDate(dateStr)})`;
  const sendResult = await sendEmail({ to: userEmail, subject, html });

  return {
    success: sendResult.success,
    userEmail,
    expensesCount: expenses.length,
    totalAmount,
    provider: sendResult.provider,
    message: sendResult.success
      ? `Lembrete de ${expenses.length} despesa(s) enviado com sucesso para ${userEmail}!`
      : `Erro ao enviar e-mail: ${sendResult.error}`,
  };
}

export async function executeDailyReminders(targetDate?: string) {
  const dateStr = targetDate || new Date().toISOString().slice(0, 10);
  console.log(`[Cron Reminders] Executando rotina diária de lembretes para a data: ${dateStr}`);

  // 1. Buscar todas as despesas em aberto para a data especificada
  const { data: txData, error: txError } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("kind", "expense")
    .eq("is_paid", false)
    .eq("occurred_on", dateStr)
    .not("user_id", "is", null);

  if (txError) {
    console.error("[Cron Reminders] Erro ao consultar transações:", txError);
    throw txError;
  }

  const transactions = txData ?? [];
  if (transactions.length === 0) {
    return {
      success: true,
      message: `Nenhuma despesa em aberto encontrada para ${dateStr}.`,
      processedUsers: 0,
      sentEmails: 0,
    };
  }

  // 2. Agrupar por usuário
  const userMap = new Map<string, typeof transactions>();
  for (const t of transactions) {
    if (!t.user_id) continue;
    const list = userMap.get(t.user_id) ?? [];
    list.push(t);
    userMap.set(t.user_id, list);
  }

  const results: ReminderResult[] = [];

  for (const userId of userMap.keys()) {
    try {
      const res = await executeRemindersForUser(userId, dateStr);
      results.push(res);
    } catch (e) {
      console.error(`[Cron Reminders] Erro ao processar usuário ${userId}:`, e);
    }
  }

  const sentCount = results.filter((r) => r.success && r.expensesCount > 0).length;

  return {
    success: true,
    message: `Rotina concluída: ${sentCount} e-mail(s) enviado(s) para ${userMap.size} usuário(s) com contas vencendo hoje.`,
    processedUsers: userMap.size,
    sentEmails: sentCount,
    details: results,
  };
}
