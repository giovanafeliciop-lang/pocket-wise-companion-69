import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, Check, Pencil, Trash2 } from "lucide-react";
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
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
};

export function TransactionList({
  transactions,
  categories,
  onTogglePaid,
  onEdit,
  onDelete,
}: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = transactions.filter((t) => {
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "open") return !t.is_paid;
    if (filter === "paid") return t.is_paid;
    if (filter === "expense") return t.kind === "expense";
    if (filter === "income") return t.kind === "income";
    return true;
  });

  return (
    <div className="surface-card p-5">
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
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Em aberto</SelectItem>
              <SelectItem value="paid">Pagos</SelectItem>
              <SelectItem value="expense">Só despesas</SelectItem>
              <SelectItem value="income">Só entradas</SelectItem>
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
                  <span>· {method}{t.card_name ? ` (${t.card_name})` : ""}</span>
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
