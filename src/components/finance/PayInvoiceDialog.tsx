import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Calendar,
  Check,
  CreditCard,
  QrCode,
  Receipt,
  Wallet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import {
  CREDIT_CARDS,
  brl,
  type PayInvoiceParams,
  type Transaction,
} from "@/lib/finance";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardName: string;
  items: Transaction[];
  onConfirm: (params: PayInvoiceParams) => Promise<void>;
};

export function PayInvoiceDialog({
  open,
  onOpenChange,
  cardName,
  items,
  onConfirm,
}: Props) {
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const openAmount = items
    .filter((i) => !i.is_paid)
    .reduce((sum, item) => sum + item.amount, 0);

  const defaultPaymentTarget = openAmount > 0 ? openAmount : totalAmount;

  const todayStr = new Date().toISOString().slice(0, 10);
  const [paymentMethod, setPaymentMethod] = useState<string>("pix");
  const [otherCardName, setOtherCardName] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(todayStr);
  const [isPartial, setIsPartial] = useState<boolean>(false);
  const [paidAmountStr, setPaidAmountStr] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setPaymentMethod("pix");
      setOtherCardName("");
      setPaymentDate(todayStr);
      setIsPartial(false);
      setPaidAmountStr(defaultPaymentTarget.toFixed(2));
      setSubmitting(false);
    }
  }, [open, defaultPaymentTarget, todayStr]);

  const parsedPaidAmount = Number(paidAmountStr.replace(",", ".")) || 0;
  const remainingDebt = Math.max(0, defaultPaymentTarget - parsedPaidAmount);

  const handleQuickPercent = (percent: number) => {
    const val = (defaultPaymentTarget * percent).toFixed(2);
    setPaidAmountStr(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPartial && (parsedPaidAmount <= 0 || parsedPaidAmount > defaultPaymentTarget)) {
      return;
    }
    if (paymentMethod === "credito" && !otherCardName) {
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm({
        items,
        isPartial,
        paidAmount: isPartial ? parsedPaidAmount : defaultPaymentTarget,
        paymentMethod,
        otherCardName: paymentMethod === "credito" ? otherCardName : null,
        paidAtDate: paymentDate || todayStr,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const otherCardsAvailable = CREDIT_CARDS.filter((c) => c !== cardName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {`Pagar Fatura — ${cardName}`}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Selecione a forma de pagamento, data e se o pagamento foi total ou parcial.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Resumo do Valor da Fatura */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3.5">
            <div>
              <span className="text-xs text-muted-foreground uppercase font-semibold">
                Total da Fatura
              </span>
              <p className="font-display text-xl font-bold text-foreground">
                {brl(defaultPaymentTarget)}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <span>{`${items.length} ${items.length === 1 ? "compra vinculada" : "compras vinculadas"}`}</span>
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Como a fatura foi paga?</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("pix")}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium transition-all ${
                  paymentMethod === "pix"
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                    : "border-border bg-card hover:bg-secondary/40 text-muted-foreground"
                }`}
              >
                <QrCode className="h-4 w-4 shrink-0" />
                <span>Pix</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("credito")}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium transition-all ${
                  paymentMethod === "credito"
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs"
                    : "border-border bg-card hover:bg-secondary/40 text-muted-foreground"
                }`}
              >
                <CreditCard className="h-4 w-4 shrink-0" />
                <span>Outro Cartão</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("debito")}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium transition-all ${
                  paymentMethod === "debito"
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                    : "border-border bg-card hover:bg-secondary/40 text-muted-foreground"
                }`}
              >
                <Wallet className="h-4 w-4 shrink-0" />
                <span>Cartão Débito</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("boleto")}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium transition-all ${
                  paymentMethod === "boleto"
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                    : "border-border bg-card hover:bg-secondary/40 text-muted-foreground"
                }`}
              >
                <Receipt className="h-4 w-4 shrink-0" />
                <span>Boleto</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("dinheiro")}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium transition-all ${
                  paymentMethod === "dinheiro"
                    ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                    : "border-border bg-card hover:bg-secondary/40 text-muted-foreground"
                }`}
              >
                <Banknote className="h-4 w-4 shrink-0" />
                <span>Dinheiro/Conta</span>
              </button>
            </div>
          </div>

          {/* Seleção do Outro Cartão (se escolhido pagar com cartão de crédito) */}
          {paymentMethod === "credito" ? (
            <div className="space-y-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3 animate-in fade-in duration-200">
              <Label className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                Qual outro cartão foi usado para pagar esta fatura?
              </Label>
              <Select value={otherCardName} onValueChange={setOtherCardName}>
                <SelectTrigger className="h-9 bg-card text-xs">
                  <SelectValue placeholder="Selecione o cartão de crédito..." />
                </SelectTrigger>
                <SelectContent>
                  {otherCardsAvailable.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                O valor desta fatura entrará como despesa no cartão selecionado.
              </p>
            </div>
          ) : null}

          {/* Data do Pagamento */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-date" className="text-xs font-semibold flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              Data do pagamento
            </Label>
            <Input
              id="pay-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>

          {/* Opção de Pagamento Parcial */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="partial-switch" className="text-xs font-bold cursor-pointer">
                  A fatura foi paga parcialmente?
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Ative se você não pagou o valor total da fatura
                </p>
              </div>
              <Switch
                id="partial-switch"
                checked={isPartial}
                onCheckedChange={(v) => {
                  setIsPartial(v);
                  if (v && !paidAmountStr) {
                    setPaidAmountStr((defaultPaymentTarget / 2).toFixed(2));
                  }
                }}
              />
            </div>

            {isPartial ? (
              <div className="space-y-3 pt-2 border-t border-border/60 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <Label htmlFor="partial-amount" className="text-xs font-semibold">
                    Quanto foi pago nesta fatura? (R$)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-semibold text-muted-foreground">
                      R$
                    </span>
                    <Input
                      id="partial-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={defaultPaymentTarget}
                      value={paidAmountStr}
                      onChange={(e) => setPaidAmountStr(e.target.value)}
                      placeholder="0,00"
                      className="h-9 pl-9 text-sm font-semibold"
                      required={isPartial}
                    />
                  </div>

                  {/* Atalhos rápidos de % */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-muted-foreground">Atalhos:</span>
                    <button
                      type="button"
                      onClick={() => handleQuickPercent(0.15)}
                      className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-[10px] hover:bg-secondary"
                    >
                      Mínimo (15%)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPercent(0.5)}
                      className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-[10px] hover:bg-secondary"
                    >
                      50%
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPercent(0.75)}
                      className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-[10px] hover:bg-secondary"
                    >
                      75%
                    </button>
                  </div>
                </div>

                {/* Resumo do Saldo Devedor */}
                <div className="flex items-center justify-between rounded-lg bg-secondary/40 p-2.5 text-xs">
                  <div>
                    <span className="text-muted-foreground">Valor pago:</span>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">
                      {brl(parsedPaidAmount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Saldo restante devedor:</span>
                    <p className="font-bold text-rose-600 dark:text-rose-400">
                      {brl(remainingDebt)}
                    </p>
                  </div>
                </div>

                {/* Alerta de Juros */}
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">Aviso de juros e encargos na próxima fatura:</p>
                    <p className="text-[11px] leading-relaxed">
                      {`O saldo devedor de ${brl(remainingDebt)} permanecerá em aberto com sinal de alerta no painel e acumulará juros rotativos na fatura do mês seguinte.`}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                (isPartial && parsedPaidAmount <= 0) ||
                (paymentMethod === "credito" && !otherCardName)
              }
              className={isPartial ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
            >
              <Check className="mr-1.5 h-4 w-4" />
              {submitting
                ? "Processando..."
                : isPartial
                  ? `Registrar Pagamento Parcial (${brl(parsedPaidAmount)})`
                  : `Confirmar Pagamento (${brl(defaultPaymentTarget)})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
