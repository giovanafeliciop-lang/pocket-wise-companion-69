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
  type PayInvoiceParams,
  type Transaction,
} from "@/lib/finance";
import { PayInvoiceDialog } from "@/components/finance/PayInvoiceDialog";

type Props = {
  transactions: Transaction[];
  categories: Category[];
  onTogglePaid: (t: Transaction) => void;
  onToggleBatchPaid?: (ids: string[], isPaid: boolean) => void;
  onPayInvoice?: (params: PayInvoiceParams) => Promise<void>;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
};

export function TransactionList({
  transactions,
  categories,
  onTogglePaid,
  onToggleBatchPaid,
  onPayInvoice,
  onEdit,
  onDelete,
}: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [payDialogInvoice, setPayDialogInvoice] = useState<{
    cardName: string;
    items: Transaction[];
  } | null>(null);

  const isInvoiceItem = (t: Transaction) =>
    t.kind === "expense" &&
    t.payment_method === "credito" &&
    Boolean(t.card_name) &&
    (t.source === "fatura" || t.source === "invoice" || t.source === "invoice_import");

  const cardInvoices = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) {
      if (isInvoiceItem(t) && t.card_name) {
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

  type ListItem =
    | {
        type: "transaction";
        data: Transaction;
      }
    | {
        type: "invoice_summary";
        cardName: string;
        items: Transaction[];
        total: number;
        paidTotal: number;
        openTotal: number;
        isAllPaid: boolean;
        isPartiallyPaid: boolean;
        openCount: number;
        paidCount: number;
        occurred_on: string;
      };

  const displayList = useMemo<ListItem[]>(() => {
    // 1. Lançamentos regulares (exclui itens detalhados de faturas importadas)
    const regularItems: ListItem[] = transactions
      .filter((t) => !isInvoiceItem(t))
      .map((t) => ({ type: "transaction", data: t }));

    // 2. Um item resumo consolidado para cada fatura importada ativa
    const invoiceSummaryItems: ListItem[] = cardInvoices.map((inv) => ({
      type: "invoice_summary",
      cardName: inv.cardName,
      items: inv.items,
      total: inv.total,
      paidTotal: inv.paidTotal,
      openTotal: inv.openTotal,
      isAllPaid: inv.isAllPaid,
      isPartiallyPaid: inv.isPartiallyPaid,
      openCount: inv.openCount,
      paidCount: inv.paidCount,
      occurred_on: inv.items[0]?.occurred_on || new Date().toISOString().slice(0, 10),
    }));

    // Combina e ordena cronologicamente por data decrescente
    const combined = [...regularItems, ...invoiceSummaryItems].sort((a, b) => {
      const dateA = a.type === "transaction" ? a.data.occurred_on : a.occurred_on;
      const dateB = b.type === "transaction" ? b.data.occurred_on : b.occurred_on;
      return dateB.localeCompare(dateA);
    });

    // 3. Aplicação de busca e filtros
    return combined.filter((item) => {
      if (item.type === "transaction") {
        const t = item.data;
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
      } else {
        const invoiceTitle = `Fatura Cartão de Crédito ${item.cardName}`;
        if (
          search &&
          !invoiceTitle.toLowerCase().includes(search.toLowerCase()) &&
          !item.cardName.toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }
        if (filter === "open") return !item.isAllPaid;
        if (filter === "paid") return item.isAllPaid;
        if (filter === "income") return false;
        if (filter === "expense") return true;
        if (filter.startsWith("card:")) {
          const card = filter.replace("card:", "");
          return item.cardName === card;
        }
        return true;
      }
    });
  }, [transactions, cardInvoices, search, filter]);

  return (
    <div className="surface-card p-5">
      {/* Alerta Global de Fatura Parcial */}
      {hasAnyPartialInvoice ? (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <p>
            <strong>⚠️ Atenção:</strong> Você possui fatura(s) de cartão com pagamento parcial este
            mês. O saldo devedor não pago permanecerá em aberto e <strong>gerará juros e encargos na fatura do próximo mês</strong>.
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
              {`${cardInvoices.length} ${cardInvoices.length === 1 ? "fatura ativa" : "faturas ativas"}`}
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
                                {`${openCount} em aberto`}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {`${items.length} ${items.length === 1 ? "compra lançada" : "compras lançadas"}`}
                          </p>
                        </div>
                        <span className="numeric text-sm font-bold text-foreground">
                          {brl(total)}
                        </span>
                      </div>

                      {/* Barra de progresso e detalhe para faturas parciais com aviso de juros */}
                      {isPartiallyPaid ? (
                        <div className="space-y-1.5 rounded-lg bg-amber-500/10 p-2.5 border border-amber-500/30 text-xs">
                          <div className="flex items-center justify-between text-[11px] font-medium text-amber-800 dark:text-amber-200">
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              {`Pago: ${brl(paidTotal)} (${paidCount} de ${items.length})`}
                            </span>
                            <span className="font-bold text-rose-600 dark:text-rose-400">{`Falta pagar: ${brl(openTotal)}`}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-500/20">
                            <div
                              className="h-full rounded-full bg-amber-500 transition-all duration-300"
                              style={{ width: `${paidPercent}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-tight font-medium">
                            {`⚠️ Alerta: Restam ${brl(openTotal)} em aberto que gerarão juros rotativos e encargos na fatura do próximo mês.`}
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
                            <ChevronDown className="h-3.5 w-3.5" />
                            {`Ver itens (${items.length})`}
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
                          <>
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
                              Reabrir
                            </Button>
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                              onClick={() => setPayDialogInvoice({ cardName, items })}
                            >
                              <Check className="h-3 w-3" />
                              {`Pagar / Ajustar (${brl(openTotal)})`}
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => setPayDialogInvoice({ cardName, items })}
                          >
                            <Check className="h-3.5 w-3.5" /> Pagar fatura
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
                                        : "border-border text-muted-foreground hover:border-primary",
                                    )}
                                  >
                                    {item.is_paid ? <Check className="h-3 w-3" /> : null}
                                  </button>
                                  <span
                                    className={cn(
                                      "truncate",
                                      item.is_paid
                                        ? "line-through text-muted-foreground"
                                        : "font-medium text-foreground",
                                    )}
                                  >
                                    {item.description}
                                  </span>
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
                                <span
                                  className={cn(
                                    "numeric font-semibold ml-2 shrink-0",
                                    item.is_paid
                                      ? "text-muted-foreground line-through"
                                      : "text-foreground",
                                  )}
                                >
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

      {/* Controles de Busca e Filtro */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Lançamentos do mês</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar lançamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-48 text-xs"
          />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-9 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Em aberto</SelectItem>
              <SelectItem value="paid">Pagos</SelectItem>
              <SelectItem value="expense">Despesas</SelectItem>
              <SelectItem value="income">Entradas</SelectItem>
              {cardInvoices.map((c) => (
                <SelectItem key={c.cardName} value={`card:${c.cardName}`}>
                  {`Fatura ${c.cardName}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de Transações e Resumos de Faturas */}
      <div className="mt-4 space-y-2">
        {displayList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            <p>Nenhum lançamento encontrado para este filtro.</p>
          </div>
        ) : null}

        {displayList.map((item) => {
          if (item.type === "invoice_summary") {
            return (
              <div
                key={`invoice-summary-${item.cardName}`}
                className={cn(
                  "group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                  item.isAllPaid
                    ? "border-emerald-500/30 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]"
                    : item.isPartiallyPaid
                      ? "border-amber-500/40 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]"
                      : "border-indigo-500/30 bg-indigo-500/[0.03] hover:bg-indigo-500/[0.07]",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (item.isAllPaid) {
                      onToggleBatchPaid?.(
                        item.items.map((i) => i.id),
                        false,
                      );
                    } else {
                      setPayDialogInvoice({ cardName: item.cardName, items: item.items });
                    }
                  }}
                  title={
                    item.isAllPaid
                      ? "Fatura paga (clique para reabrir)"
                      : item.isPartiallyPaid
                        ? "Fatura parcialmente paga (clique para pagar ou ajustar)"
                        : "Clique para pagar a fatura"
                  }
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
                    item.isAllPaid
                      ? "border-emerald-500 bg-emerald-600 text-white"
                      : item.isPartiallyPaid
                        ? "border-amber-500 bg-amber-500/20 text-amber-600 hover:bg-amber-500/30"
                        : "border-indigo-500/50 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:border-indigo-500",
                  )}
                >
                  {item.isAllPaid ? (
                    <Check className="h-4 w-4" />
                  ) : item.isPartiallyPaid ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <CreditCard className="h-4 w-4 text-indigo-500" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {`Fatura Cartão de Crédito ${item.cardName}`}
                    </p>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 h-4 shrink-0 font-medium bg-secondary text-muted-foreground"
                    >
                      {`${item.items.length} ${item.items.length === 1 ? "compra" : "compras"}`}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{formatDate(item.occurred_on)}</span>
                    <Badge
                      variant="outline"
                      className="border-indigo-500/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0 text-[10px]"
                    >
                      Fatura de Cartão
                    </Badge>
                    {item.isPartiallyPaid ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {`· ⚠️ Paga Parcialmente (${brl(item.paidTotal)} pago)`}
                      </span>
                    ) : item.isAllPaid ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        · Paga integralmente
                      </span>
                    ) : (
                      <span className="text-warning font-medium">
                        {`· ${item.openCount} compras em aberto`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="numeric text-sm font-bold text-foreground">
                    {`− ${brl(item.total)}`}
                  </span>
                  {item.isPartiallyPaid ? (
                    <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                      {`Falta: ${brl(item.openTotal)}`}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary hover:bg-primary/10 gap-1 px-2"
                    onClick={() => {
                      setExpandedCard(item.cardName);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    title="Ver compras e categorias detalhadas desta fatura no bloco superior"
                  >
                    <span>Ver itens</span>
                  </Button>
                  {!item.isAllPaid ? (
                    <Button
                      variant={item.isPartiallyPaid ? "outline" : "default"}
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() =>
                        setPayDialogInvoice({ cardName: item.cardName, items: item.items })
                      }
                    >
                      <Check className="h-3 w-3" />
                      <span>Pagar</span>
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          }

          const t = item.data;
          const cat = categories.find((c) => c.id === t.category_id);
          const method = PAYMENT_METHODS.find((p) => p.value === t.payment_method)?.label;
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
                    {`· ${method ?? ""}${t.card_name ? ` (${t.card_name})` : ""}`}
                  </span>
                  {t.notes ? <span>{`· ${t.notes}`}</span> : null}
                  {!t.is_paid ? <span className="text-warning">· em aberto</span> : null}
                </div>
              </div>

              <span
                className={cn(
                  "numeric shrink-0 text-sm font-semibold",
                  income ? "text-primary" : "text-foreground",
                )}
              >
                {`${income ? "+" : "−"} ${brl(t.amount)}`}
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

      <PayInvoiceDialog
        open={Boolean(payDialogInvoice)}
        onOpenChange={(open) => {
          if (!open) setPayDialogInvoice(null);
        }}
        cardName={payDialogInvoice?.cardName ?? ""}
        items={payDialogInvoice?.items ?? []}
        onConfirm={async (params) => {
          if (onPayInvoice) {
            await onPayInvoice(params);
          }
        }}
      />
    </div>
  );
}
