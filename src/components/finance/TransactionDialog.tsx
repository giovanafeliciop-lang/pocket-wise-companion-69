import { useEffect, useState } from "react";
import { Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  CREDIT_CARDS,
  PAYMENT_METHODS,
  brl,
  calculateRecurringDates,
  type Category,
  type Kind,
  type Transaction,
  type TransactionInput,
} from "@/lib/finance";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  defaultKind?: Kind;
  editing?: Transaction | null;
  onSubmit: (values: TransactionInput | TransactionInput[]) => Promise<void>;
};

export function TransactionDialog({
  open,
  onOpenChange,
  categories,
  defaultKind = "expense",
  editing,
  onSubmit,
}: Props) {
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState<string>("");
  const [method, setMethod] = useState("pix");
  const [cardName, setCardName] = useState("");
  const [customCard, setCustomCard] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringMonths, setRecurringMonths] = useState(2);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setKind(editing.kind as Kind);
      setDescription(editing.description);
      setAmount(String(editing.amount));
      setDate(editing.occurred_on);
      setCategoryId(editing.category_id ?? "");
      setMethod(editing.payment_method);
      const known = (CREDIT_CARDS as readonly string[]).includes(editing.card_name ?? "");
      if (editing.card_name && !known) {
        setCardName("Outro");
        setCustomCard(editing.card_name);
      } else {
        setCardName(editing.card_name ?? "");
        setCustomCard("");
      }
      setIsPaid(editing.is_paid);
      setIsRecurring(false);
      setRecurringMonths(2);
    } else {
      setKind(defaultKind);
      setDescription("");
      setAmount("");
      setDate(new Date().toISOString().slice(0, 10));
      setCategoryId("");
      setMethod("pix");
      setCardName("");
      setCustomCard("");
      setIsPaid(defaultKind === "income");
      setIsRecurring(false);
      setRecurringMonths(2);
    }
  }, [open, editing, defaultKind]);

  const options = categories.filter((c) => c.kind === kind);

  const parseAmount = (raw: string) => {
    const cleaned = raw.replace(/[^\d.,-]/g, "").trim();
    if (!cleaned) return NaN;
    const normalized = cleaned.includes(",")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned;
    return Number(normalized);
  };

  const handleSave = async () => {
    const value = parseAmount(amount);
    if (!description.trim()) {
      toast.error("Informe a descrição do lançamento");
      return;
    }
    if (!Number.isFinite(value) || value === 0) {
      toast.error("Informe um valor válido (ex.: 150,00)");
      return;
    }
    if (!date) {
      toast.error("Informe a data do lançamento");
      return;
    }
    const resolvedCard =
      method === "credito" ? (cardName === "Outro" ? customCard.trim() : cardName) || null : null;
    setSaving(true);
    try {
      if (!editing && isRecurring && recurringMonths > 1) {
        const dates = calculateRecurringDates(date, recurringMonths);
        const rows: TransactionInput[] = dates.map((occurredDate, index) => ({
          kind,
          description: description.trim(),
          amount: Math.abs(value),
          occurred_on: occurredDate,
          category_id: categoryId || null,
          payment_method: method,
          card_name: resolvedCard,
          is_paid: index === 0 ? isPaid : false,
          source: "manual",
        }));
        await onSubmit(rows);
      } else {
        await onSubmit({
          kind,
          description: description.trim(),
          amount: Math.abs(value),
          occurred_on: date,
          category_id: categoryId || null,
          payment_method: method,
          card_name: resolvedCard,
          is_paid: isPaid,
          source: editing ? (editing.source || "manual") : "manual",
          notes: editing?.notes ?? null,
        });
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  };

  const parsedVal = parseAmount(amount);
  const totalRecurringVal = Number.isFinite(parsedVal) ? Math.abs(parsedVal) * recurringMonths : 0;
  const dayOfMonth = date ? Number(date.split("-")[2]) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {editing ? "Editar lançamento" : "Novo lançamento"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="expense">Despesa</TabsTrigger>
              <TabsTrigger value="income">Entrada</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="desc">Descrição</Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Supermercado"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {method === "credito" ? (
            <div className="space-y-2">
              <Label>Qual cartão?</Label>
              <Select value={cardName} onValueChange={setCardName}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar cartão" />
                </SelectTrigger>
                <SelectContent>
                  {CREDIT_CARDS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cardName === "Outro" ? (
                <Input
                  value={customCard}
                  onChange={(e) => setCustomCard(e.target.value)}
                  placeholder="Nome do cartão"
                />
              ) : null}
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                {kind === "expense" ? "Já foi paga" : "Já foi recebida"}
              </p>
              <p className="text-xs text-muted-foreground">Controle do que está em aberto</p>
            </div>
            <Switch checked={isPaid} onCheckedChange={setIsPaid} />
          </div>

          {!editing ? (
            <div className="rounded-xl border border-border bg-secondary/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Repeat className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Lançamento recorrente</p>
                    <p className="text-xs text-muted-foreground">
                      Repetir por mais de 1 mês no mesmo dia
                    </p>
                  </div>
                </div>
                <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
              </div>

              {isRecurring ? (
                <div className="pt-2 border-t border-border/50 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="recurring-months" className="text-xs font-medium">
                        Repetir por quantos meses?
                      </Label>
                      <span className="text-xs font-semibold text-primary">
                        {recurringMonths} meses
                      </span>
                    </div>
                    <Input
                      id="recurring-months"
                      type="number"
                      min={2}
                      max={60}
                      value={recurringMonths}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) {
                          setRecurringMonths(Math.max(2, Math.min(60, val)));
                        } else {
                          setRecurringMonths(2);
                        }
                      }}
                      className="h-9"
                    />
                  </div>

                  {/* Atalhos rápidos */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-muted-foreground mr-1">Atalhos:</span>
                    {[2, 3, 6, 12, 24].map((num) => (
                      <Button
                        key={num}
                        type="button"
                        variant={recurringMonths === num ? "default" : "outline"}
                        size="sm"
                        className="h-6 px-2.5 text-xs rounded-full"
                        onClick={() => setRecurringMonths(num)}
                      >
                        {num} meses
                      </Button>
                    ))}
                  </div>

                  {/* Resumo da recorrência */}
                  <div className="rounded-lg bg-secondary/50 p-2.5 text-xs text-muted-foreground border border-border/40 space-y-1">
                    <p className="font-medium text-foreground">
                      Resumo da recorrência:
                    </p>
                    <p>
                      Serão criados <strong>{recurringMonths} lançamentos</strong>
                      {dayOfMonth ? (
                        <>
                          {" "}sempre no <strong>dia {dayOfMonth}</strong> de cada mês
                        </>
                      ) : null}
                      {totalRecurringVal > 0 ? (
                        <>
                          , totalizando <strong>{brl(totalRecurringVal)}</strong> ({recurringMonths}x de {brl(Number.isFinite(parsedVal) ? Math.abs(parsedVal) : 0)}).
                        </>
                      ) : (
                        "."
                      )}
                    </p>
                    <p className="text-[11px] opacity-80">
                      O 1º mês respeita o status selecionado acima ({isPaid ? "pago/recebido" : "em aberto"}), e os meses subsequentes serão criados como em aberto.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
