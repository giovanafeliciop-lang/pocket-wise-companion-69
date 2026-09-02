import { useState } from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Send,
  Sparkles,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { sendDueExpensesReminderServerFn } from "@/lib/notifications.functions";
import { brl, type Category, type Transaction } from "@/lib/finance";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userEmail: string;
  transactions: Transaction[];
  categories: Category[];
};

export function EmailNotificationDialog({
  open,
  onOpenChange,
  userEmail,
  transactions,
  categories,
}: Props) {
  const sendReminder = useServerFn(sendDueExpensesReminderServerFn);
  const [sending, setSending] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const dueTodayExpenses = transactions.filter(
    (t) => t.kind === "expense" && !t.is_paid && t.occurred_on === todayStr,
  );
  const totalDueToday = dueTodayExpenses.reduce((sum, t) => sum + t.amount, 0);

  const handleSendTest = async () => {
    setSending(true);
    try {
      const res = await sendReminder();
      if (res.success) {
        toast.success(res.message || "E-mail de lembrete disparado com sucesso!");
      } else {
        toast.error(res.message || "Não foi possível enviar o e-mail.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar e-mail");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Mail className="h-5 w-5 text-primary" />
            Lembretes Automáticos por E-mail
          </DialogTitle>
          <DialogDescription>
            Receba notificações automáticas no dia do vencimento de contas e faturas em aberto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Card de Configuração e Status */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">E-mail de destino:</span>
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" /> {userEmail || "Seu e-mail cadastrado"}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
              <span className="text-muted-foreground">Status do envio:</span>
              <Badge className="bg-emerald-600/90 text-white text-[10px] px-2 py-0.5 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Ativo & Automático
              </Badge>
            </div>
          </div>

          {/* Como funciona */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs space-y-1 text-muted-foreground">
            <p className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Envio 100% Autônomo
            </p>
            <p>
              O sistema verifica todos os dias em segundo plano as despesas e faturas que vencem
              naquela data. Se houver alguma conta em aberto, o e-mail é enviado{" "}
              <strong>mesmo que você não entre no aplicativo naquele dia</strong>.
            </p>
          </div>

          {/* Resumo de Despesas Vencendo Hoje */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-warning" /> Contas Vencendo Hoje em Aberto
              </h4>
              <span className="text-xs font-medium text-foreground">
                {dueTodayExpenses.length} {dueTodayExpenses.length === 1 ? "conta" : "contas"} (
                {brl(totalDueToday)})
              </span>
            </div>

            {dueTodayExpenses.length === 0 ? (
              <div className="rounded-xl border border-border bg-secondary/20 p-4 text-center text-xs text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1.5" />
                <p className="font-medium text-foreground">Tudo em dia para hoje!</p>
                <p className="text-[11px] mt-0.5">
                  Você não possui nenhuma despesa em aberto com vencimento para o dia de hoje.
                </p>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-border bg-secondary/20 p-2">
                {dueTodayExpenses.map((t) => {
                  const cat = categories.find((c) => c.id === t.category_id);
                  return (
                    <div
                      key={t.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-2 text-xs"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1 pr-2">
                        <p className="font-medium truncate">{t.description}</p>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          {cat ? (
                            <span
                              style={{ color: cat.color }}
                              className="font-medium"
                            >
                              {cat.name}
                            </span>
                          ) : null}
                          {t.card_name ? <span>· {t.card_name}</span> : null}
                        </div>
                      </div>
                      <span className="numeric font-bold text-destructive">
                        {brl(t.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            onClick={handleSendTest}
            disabled={sending}
            className="gap-1.5"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sending ? "Enviando..." : "Testar / Enviar e-mail de hoje"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
