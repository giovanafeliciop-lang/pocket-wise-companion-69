import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Calendar,
  Check,
  CreditCard,
  Percent,
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
  MONTH_NAMES,
  brl,
  getNextMonthDate,
  type Category,
  type PayInvoiceParams,
  type Transaction,
} from "@/lib/finance";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardName: string;
  items: Transaction[];
  categories?: Category[];
  onConfirm: (params: PayInvoiceParams) => Promise<void>;
};

export function PayInvoiceDialog({
  open,
  onOpenChange,
  cardName,
  items,
  categories = [],
  onConfirm,
}: Props) {
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const paidAmountSoFar = items
    .filter((i) => i.is_paid)
    .reduce((sum, item) => sum + item.amount, 0);
  const openAmount = items
    .filter((i) => !i.is_paid)
    .reduce((sum, item) => sum + item.amount, 0);

  const isAlreadyPartiallyPaid = paidAmountSoFar > 0 && openAmount > 0;
  const defaultPaymentTarget = openAmount > 0 ? openAmount : totalAmount;

  const todayStr = new Date().toISOString().slice(0, 10);
  const refDate = items[0]?.occurred_on || todayStr;
  const defaultNextDate = getNextMonthDate(refDate);

  const [paymentMethod, setPaymentMethod] = useState<string>("pix");
  const [otherCardName, setOtherCardName] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(todayStr);
  const [isPartial, setIsPartial] = useState<boolean>(false);
  const [paidAmountStr, setPaidAmountStr] = useState<string>("");
  const [partialAction, setPartialAction] = useState<"keep_open" | "rollover_next_month">("keep_open");
  const [rolloverDate, setRolloverDate] = useState<string>(defaultNextDate);
  const [rolloverInterestStr, setRolloverInterestStr] = useState<string>("");
  const [rolloverCategoryId, setRolloverCategoryId] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const jurosCategory = expenseCategories.find(
    (c) =>
      c.name.toLowerCase().includes("juros") ||
      c.name.toLowerCase().includes("encargo"),
  );

  useEffect(() => {
    if (open) {
      setPaymentMethod("pix");
      setOtherCardName("");
      setPaymentDate(todayStr);
      setIsPartial(false);
      setPaidAmountStr(defaultPaymentTarget.toFixed(2));
      setPartialAction("keep_open");
      setRolloverDate(getNextMonthDate(refDate));
      setRolloverInterestStr("");
      setRolloverCategoryId(jurosCategory?.id ?? expenseCategories[0]?.id ?? "");
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const parsedPaidAmount = Number(paidAmountStr.replace(",", ".")) || 0;
  const remainingDebt = Math.max(0, defaultPaymentTarget - parsedPaidAmount);
  const parsedInterest = Number(rolloverInterestStr.replace(",", ".")) || 0;

  const [tgtY, tgtM] = (rolloverDate || defaultNextDate).split("-").map(Number);
  const nextMonthName = MONTH_NAMES[(tgtM || 1) - 1] ?? "Próximo mês";

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
        partialAction: isPartial ? partialAction : undefined,
        rolloverDate: isPartial && partialAction === "rollover_next_month" ? rolloverDate : undefined,
        rolloverInterest:
          isPartial && partialAction === "rollover_next_month" && parsedInterest > 0
            ? parsedInterest
            : undefined,
        rolloverCategoryId:
          isPartial && partialAction === "rollover_next_month" ? rolloverCategoryId : undefined,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const otherCardsAvailable = CREDIT_CARDS.filter((c) => c !== cardName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {isAlreadyPartiallyPaid
                  ? `Pagar Saldo Restante — ${cardName}`
                  : `Pagar Fatura — ${cardName}`}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isAlreadyPartiallyPaid
                  ? "Informe quando foi feito o pagamento do restante, a forma utilizada ou transfira para a fatura seguinte."
                  : "Selecione a forma de pagamento, data e se o pagamento foi total ou parcial."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Resumo do Valor da Fatura */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3.5 space-y-2">
            {isAlreadyPartiallyPaid ? (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                    Total Original
                  </span>
                  <p className="font-semibold text-foreground">{brl(totalAmount)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-semibold">
                    Já Pago
                  </span>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {brl(paidAmountSoFar)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-semibold">
                    Saldo Restante
                  </span>
                  <p className="font-display text-base font-bold text-rose-600 dark:text-rose-400">
                    {brl(openAmount)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
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
            )}
          </div>

          {/* Forma de Pagamento */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">
              {isAlreadyPartiallyPaid ? "Como o restante foi pago?" : "Como a fatura foi paga?"}
            </Label>
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
                Qual outro cartão foi usado para pagar?
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
                O valor pago entrará como lançamento no cartão selecionado.
              </p>
            </div>
          ) : null}

          {/* Data do Pagamento */}
          <div className="space-y-1.5">
            <Label htmlFor="pay-date" className="text-xs font-semibold flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              {isAlreadyPartiallyPaid
                ? "Quando foi feito o pagamento deste restante?"
                : "Data em que o pagamento foi realizado"}
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
                  {isAlreadyPartiallyPaid
                    ? "Pagar apenas uma parte do saldo restante?"
                    : "A fatura foi paga parcialmente?"}
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {isAlreadyPartiallyPaid
                    ? "Ative se este pagamento não quitou todo o saldo restante"
                    : "Ative se você não pagou o valor total da fatura"}
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
                    Quanto foi pago agora? (R$)
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
                    <span className="text-muted-foreground">Valor pago agora:</span>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">
                      {brl(parsedPaidAmount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Saldo restante em aberto:</span>
                    <p className="font-bold text-rose-600 dark:text-rose-400">
                      {brl(remainingDebt)}
                    </p>
                  </div>
                </div>

                {/* Opções de Destino para o Saldo Restante */}
                <div className="space-y-2 pt-1">
                  <Label className="text-xs font-semibold text-foreground">
                    {`O que deseja fazer com o saldo restante de ${brl(remainingDebt)}?`}
                  </Label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPartialAction("keep_open")}
                      className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                        partialAction === "keep_open"
                          ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                          : "border-border bg-card hover:bg-secondary/30 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-primary">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Manter em aberto nesta fatura</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                        Permite registrar quando foi feito o pagamento do restante mais tarde.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPartialAction("rollover_next_month")}
                      className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                        partialAction === "rollover_next_month"
                          ? "border-amber-500 bg-amber-500/10 text-foreground ring-1 ring-amber-500"
                          : "border-border bg-card hover:bg-secondary/30 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs text-amber-700 dark:text-amber-300">
                        <ArrowRight className="h-3.5 w-3.5" />
                        <span>Jogar para a fatura seguinte</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                        {`Transfere o saldo devedor diretamente para a fatura de ${nextMonthName}.`}
                      </p>
                    </button>
                  </div>
                </div>

                {/* Configurações contextuais quando escolhe Rolar para a Fatura Seguinte */}
                {partialAction === "rollover_next_month" ? (
                  <div className="space-y-2.5 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 animate-in fade-in duration-200 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-800 dark:text-amber-200">
                        Transferência para {nextMonthName}/{tgtY}:
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="sub-rollover-date" className="text-[11px] font-medium">
                          Data na próxima fatura
                        </Label>
                        <Input
                          id="sub-rollover-date"
                          type="date"
                          value={rolloverDate}
                          onChange={(e) => setRolloverDate(e.target.value)}
                          className="h-8 text-xs bg-card"
                          required={partialAction === "rollover_next_month"}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="sub-rollover-interest" className="text-[11px] font-medium flex items-center gap-1">
                          <Percent className="h-3 w-3 text-rose-500" />
                          Juros rotativos (opcional)
                        </Label>
                        <Input
                          id="sub-rollover-interest"
                          type="number"
                          step="0.01"
                          min="0"
                          value={rolloverInterestStr}
                          onChange={(e) => setRolloverInterestStr(e.target.value)}
                          placeholder="0,00"
                          className="h-8 text-xs bg-card"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium">
                        Categoria na próxima fatura
                      </Label>
                      <Select
                        value={rolloverCategoryId}
                        onValueChange={setRolloverCategoryId}
                      >
                        <SelectTrigger className="h-8 text-xs bg-card">
                          <SelectValue placeholder="Selecione a categoria..." />
                        </SelectTrigger>
                        <SelectContent>
                          {expenseCategories.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              <div className="flex items-center gap-2">
                                <span
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: c.color }}
                                />
                                <span>{c.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-amber-500/20 text-[11px] font-semibold text-amber-900 dark:text-amber-100">
                      <span>Total que irá para a fatura de {nextMonthName}:</span>
                      <span className="font-bold text-foreground">
                        {brl(remainingDebt + (parsedInterest > 0 ? parsedInterest : 0))}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold">Aviso:</p>
                      <p className="text-[11px] leading-relaxed">
                        {`O saldo devedor de ${brl(remainingDebt)} permanecerá em aberto nesta fatura até que você registre a data em que o restante foi pago.`}
                      </p>
                    </div>
                  </div>
                )}
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
                  ? partialAction === "rollover_next_month"
                    ? `Pagar ${brl(parsedPaidAmount)} e Transferir Saldo`
                    : `Registrar Pagamento Parcial (${brl(parsedPaidAmount)})`
                  : `Confirmar Pagamento (${brl(defaultPaymentTarget)})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
