import { useEffect, useState } from "react";
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
import {
  PAYMENT_METHODS,
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
  onSubmit: (values: TransactionInput) => Promise<void>;
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
  const [isPaid, setIsPaid] = useState(false);
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
      setIsPaid(editing.is_paid);
    } else {
      setKind(defaultKind);
      setDescription("");
      setAmount("");
      setDate(new Date().toISOString().slice(0, 10));
      setCategoryId("");
      setMethod("pix");
      setIsPaid(defaultKind === "income");
    }
  }, [open, editing, defaultKind]);

  const options = categories.filter((c) => c.kind === kind);

  const handleSave = async () => {
    const value = Number(amount.replace(/\./g, "").replace(",", "."));
    if (!description.trim() || !value) return;
    setSaving(true);
    try {
      await onSubmit({
        kind,
        description: description.trim(),
        amount: Math.abs(value),
        occurred_on: date,
        category_id: categoryId || null,
        payment_method: method,
        is_paid: isPaid,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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

          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium">
                {kind === "expense" ? "Já foi paga" : "Já foi recebida"}
              </p>
              <p className="text-xs text-muted-foreground">Controle do que está em aberto</p>
            </div>
            <Switch checked={isPaid} onCheckedChange={setIsPaid} />
          </div>
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
