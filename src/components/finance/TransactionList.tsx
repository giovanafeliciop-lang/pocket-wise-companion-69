import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PAYMENT_METHODS,
  brl,
  formatDate,
  type Category,
  type Transaction,
} from "@/lib/finance";

type Props = {
  transactions: Transaction[];
  categories: Category[];
  onTogglePaid: (t: Transaction) => void;
  onToggleBatchPaid?: (ids: string[], isPaid: boolean) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
};

export function TransactionList({
  transactions,
  categories,
  onTogglePaid,
  onToggleBatchPaid,
  onEdit,
  onDelete,
}: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const cardInvoices = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) {
      if (t.kind === "expense" && t.payment_method === "credito" && t.card_name) {
        const list = map.get(t.card_name) ?? [];
        list.push(t);
        map.set(t.card_name, list);
      }
    }
    return Array.from(map.entries())
      .map(([cardName, items]) => {
        const total = items.reduce((sum, item) => sum + item.amount, 0);
        const paidTotal = items
          .filter((item) => item.is_paid)
          .reduce((sum, item) => sum + item.amount, 0);
        const openTotal = total - paidTotal;
        const isAllPaid = items.length > 0 && items.every((item) => item.is_paid);
        const isPartiallyPaid = paidTotal > 0 && openTotal > 0;
        const isNonePaid = paidTotal === 0;
        const openCount = items.filter((item) => !item.is_paid).length;
        const paidCount = items.filter((item) => item.is_paid).length;
        const paidPercent = total > 0 ? (paidTotal / total) * 100 : 0;
        return {
          cardName,
          items,
          total,
          paidTotal,
          openTotal,
          isAllPaid,
          isPartiallyPaid,
          isNonePaid,
          openCount,
          paidCount,
          paidPercent,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [transactions]);

  const hasAnyPartialInvoice = cardInvoices.some((c) => c.isPartiallyPaid);

  const filtered = transactions.filter((t) => {
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "open") return !t.is_paid;
    if (filter === "paid") return t.is_paid;
    if (filter === "expense") return t.kind === "expense";
    if (filter === "income") return t.kind === "income";
    if (filter.startsWith("card:")) {
      const card = filter.replace("card:", "");
      return t.card_name === card;
    }
    return true;
  });

  return (
    <div className="surface-card p-5">
      {/* Alerta Global de Fatura Parcial */}
      {hasAnyPartialInvoice ? (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-3.5 shrink-0 text-amber-500" />
          <p>
            <strong>Atenção:</strong> Você possui fatura(s) de cartão com pagamento parcial este
            mês. Lembre-se de quitar o saldo restante até o vencimento.
          </p>
        </div>
      ) : null}

      {/* Resumo e Pagamento das Faturas de Cartão */}
      {cardInvoices.length > 0 ? (
        <div className="mb-5 rounded-xl border border-border/80 bg-secondary/20 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-primary" /> Faturas de Cartão de Crédito
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {cardInvoices.length} {cardInvoices.length === 1 ? "fatura ativa" : "faturas ativas"}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {cardInvoices.map(
              ({
                cardName,
                items,
                total,
                paidTotal,
                openTotal,
                isAllPaid,
                isPartiallyPaid,
                openCount,
                paidCount,
                paidPercent,
              }) => {
                const isExpanded = expandedCard === cardName;
                return (
                  <div
                    key={cardName}
                    className={cn(
                      "flex flex-col justify-between rounded-xl border bg-card/90 p-3.5 shadow-xs transition-all",
                      isPartiallyPaid
                        ? "border-amber-500/50 bg-amber-500/[0.03] shadow-amber-500/5"
                        : "border-border",
                    )}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-foreground">
                              {cardName}
                            </span>
                            {isAllPaid ? (
                              <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0 h-4.5 gap-1">
                                <Check className="h-3 w-3" /> Fatura Paga
                              </Badge>
                            ) : isPartiallyPaid ? (
                              <Badge
                                variant="outline"
                                className="border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] px-1.5 py-0 h-4.5 gap-1 font-semibold"
                              >
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                                Paga Parcialmente
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-warning text-warning bg-warning/10 text-[10px] px-1.5 py-0 h-4.5"
                              >
                                {openCount} em aberto
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {items.length} {items.length === 1 ? "compra lançada" : "compras lançadas"}
                          </p>
                        </div>
                        <span className="numeric text-sm font-bold text-foreground">
                          {brl(total)}
                        </span>
                      </div>

                      {/* Barra de progresso e detalhe para faturas parciais */}
                      {isPartiallyPaid ? (
                        <div className="space-y-1.5 rounded-lg bg-amber-500/10 p-2 border border-amber-500/20 text-xs">
                          <div className="flex items-center justify-between text-[11px] font-medium text-amber-800 dark:text-amber-200">
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                              Pago: {brl(paidTotal)} ({paidCount} de {items.length})
                            </span>
                            <span>Falta: {brl(openTotal)}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-500/20">
                            <div
                              className="h-full rounded-full bg-amber-500 transition-all duration-300"
                              style={{ width: `${paidPercent}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-amber-700 dark:text-amber-300 opacity-90">
                            ⚠️ Alerta: Restam <strong>{brl(openTotal)}</strong> pendentes nesta fatura.
                          </p>
                        </div>
                      ) : null}
                    </div>

                    {/* Botões de Ação */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 border-t border-border/50 pt-2 text-xs">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground gap-1 px-2"
                        onClick={() => setExpandedCard(isExpanded ? null : cardName)}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" /> Ocultar compras
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" /> Ver / Pagar itens ({items.length})
                          </>
                        )}
                      </Button>

                      <div className="flex items-center gap-1">
                        {isAllPaid ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              onToggleBatchPaid?.(
                                items.map((i) => i.id),
                                false,
                              )
                            }
                          >
                            Reabrir fatura
                          </Button>
                        ) : isPartiallyPaid ? (
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={() => {
                              const openIds = items.filter((i) => !i.is_paid).map((i) => i.id);
                              onToggleBatchPaid?.(openIds, true);
                            }}
                          >
                            <Check className="h-3 w-3" /> Pagar restante ({brl(openTotal)})
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() =>
                              onToggleBatchPaid?.(
                                items.map((i) => i.id),
                                true,
                              )
                            }
                          >
                            <Check className="h-3.5 w-3.5" /> Pagar fatura inteira
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Lista expandida de compras da fatura para marcação parcial */}
                    {isExpanded ? (
                      <div className="mt-2.5 space-y-1.5 border-t border-border/60 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                          <span>Marque as compras pagas nesta fatura:</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                          {items.map((item) => {
                            const cat = categories.find((c) => c.id === item.category_id);
                            return (
                              <div
                                key={item.id}
                                className={cn(
                                   "flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                                  item.is_paid
                                    ? "border-primary/30 bg-primary/5"
                                    : "border-border bg-secondary/20",
                                )}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <button
                                    type="button"
                                    onClick={() => onTogglePaid(item)}
                                    title={item.is_paid ? "Marcar como não pago" : "Marcar como pago"}
                                    className={cn(
                                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[10px] transition-colors",
                                      item.is_paid
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-muted-foreground/40 hover:border-primary",
                                    )}
                                  >
                                    {item.is_paid ? <Check className="h-3.5 w-3.5" /> : null}
                                  </button>
                                  <span className="truncate font-medium">{item.description}</span>
                                  {cat ? (
                                    <Badge
                                      variant="outline"
                                      style={{ borderColor: cat.color, color: cat.color }}
                                      className="px-1 py-0 text-[9px] shrink-0"
                                    >
                                      {cat.name}
                                    </Badge>
                                  ) : null}
                                </div>
                                <span className="numeric font-semibold ml-2 text-foreground">
                                  {brl(item.amount)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              },
            )}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Lançamentos</h2>
        <div className="flex flex-1 justify-end gap-2">
          <Input
            className="max-w-52"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Em aberto</SelectItem>
              <SelectItem value="paid">Pagos</SelectItem>
              <SelectItem value="expense">Só despesas</SelectItem>
              <SelectItem value="income">Só entradas</SelectItem>
              {cardInvoices.map(({ cardName }) => (
                <SelectItem key={cardName} value={`card:${cardName}`}>
                  💳 Fatura: {cardName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhum lançamento por aqui.
          </p>
        ) : null}

        {filtered.map((t) => {
          const cat = categories.find((c) => c.id === t.category_id);
          const method = PAYMENT_METHODS.find((m) => m.value === t.payment_method)?.label;
          const income = t.kind === "income";
          return (
            <div
              key={t.id}
              className="group flex items-center gap-3 rounded-xl border border-border bg-secondary/30 px-3 py-2.5 transition-colors hover:bg-secondary/60"
            >
              <button
                type="button"
                onClick={() => onTogglePaid(t)}
                title={t.is_paid ? "Marcar como não pago" : "Marcar como pago"}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
                  t.is_paid
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:border-primary",
                )}
              >
                {t.is_paid ? (
                  <Check className="h-4 w-4" />
                ) : income ? (
                  <ArrowUpRight className="h-4 w-4" />
                ) : (
                  <ArrowDownRight className="h-4 w-4" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.description}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{formatDate(t.occurred_on)}</span>
                  {cat ? (
                    <Badge
                      variant="outline"
                      style={{ borderColor: cat.color, color: cat.color }}
                      className="px-1.5 py-0 text-[10px]"
                    >
                      {cat.name}
                    </Badge>
                  ) : null}
                  <span>
                    · {method}
                    {t.card_name ? ` (${t.card_name})` : ""}
                  </span>
                  {t.notes ? <span>· {t.notes}</span> : null}
                  {!t.is_paid ? <span className="text-warning">· em aberto</span> : null}
                </div>
              </div>

              <span
                className={cn(
                  "numeric shrink-0 text-sm font-semibold",
                  income ? "text-primary" : "text-foreground",
                )}
              >
                {income ? "+" : "−"} {brl(t.amount)}
              </span>

              <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                <Button variant="ghost" size="icon" onClick={() => onEdit(t)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onDelete(t)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
