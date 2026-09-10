import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CreditCard,
  Percent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MONTH_NAMES,
  brl,
  getNextMonthDate,
  type Category,
  type RolloverInvoiceParams,
  type Transaction,
} from "@/lib/finance";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardName: string;
  items: Transaction[];
  openAmount: number;
  categories: Category[];
  onConfirm: (params: RolloverInvoiceParams) => Promise<void>;
};

export function RolloverInvoiceDialog({
  open,
  onOpenChange,
  cardName,
  items,
  openAmount,
  categories,
  onConfirm,
}: Props) {
  const refDate = items[0]?.occurred_on || new Date().toISOString().slice(0, 10);
  const [origY, origM] = refDate.split("-").map(Number);
  const origMonthName = MONTH_NAMES[(origM || 1) - 1] ?? "Mês atual";

  const defaultNextDate = getNextMonthDate(refDate);
  const [targetDate, setTargetDate] = useState<string>(defaultNextDate);
  const [interestStr, setInterestStr] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const jurosCategory = expenseCategories.find(
    (c) =>
      c.name.toLowerCase().includes("juros") ||
      c.name.toLowerCase().includes("encargo"),
  );

  useEffect(() => {
    if (open) {
      const nextD = getNextMonthDate(refDate);
      setTargetDate(nextD);
      setInterestStr("");
      setSelectedCategory(jurosCategory?.id ?? expenseCategories[0]?.id ?? "");
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const [tgtY, tgtM] = (targetDate || defaultNextDate).split("-").map(Number);
  const targetMonthName = MONTH_NAMES[(tgtM || 1) - 1] ?? "Próximo mês";

  const parsedInterest = Number(interestStr.replace(",", ".")) || 0;
  const totalRolloverAmount = openAmount + (parsedInterest > 0 ? parsedInterest : 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (openAmount <= 0) return;

    setSubmitting(true);
    try {
      await onConfirm({
        cardName,
        items,
        openAmount,
        interestAmount: parsedInterest > 0 ? parsedInterest : 0,
        targetDate: targetDate || defaultNextDate,
        categoryId: selectedCategory || null,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {`Transferir Saldo — ${cardName}`}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Transfira o saldo devedor em aberto desta fatura para a fatura do mês seguinte.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Fluxo Visual: Origem -> Destino */}
          <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Fatura de Origem ({origMonthName}/{origY})
              </span>
              <p className="text-xs font-bold text-foreground">
                Saldo pendente: <span className="text-rose-600 dark:text-rose-400 font-extrabold">{brl(openAmount)}</span>
              </p>
            </div>

            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
              <ArrowRight className="h-4 w-4" />
            </div>

            <div className="text-right">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Fatura de Destino
              </span>
              <p className="text-xs font-bold text-foreground">
                {`${targetMonthName} / ${tgtY}`}
              </p>
            </div>
          </div>

          {/* Configuração da Data de Vencimento na Próxima Fatura */}
          <div className="space-y-1.5">
            <Label htmlFor="rollover-date" className="text-xs font-semibold flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              Data de vencimento na próxima fatura
            </Label>
            <Input
              id="rollover-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="h-9 text-xs"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              {`O valor será registrado como lançamento na fatura de ${targetMonthName}/${tgtY}.`}
            </p>
          </div>

          {/* Juros e Encargos Rotativos (Opcional) */}
          <div className="space-y-1.5 rounded-xl border border-border bg-card p-3">
            <Label htmlFor="rollover-interest" className="text-xs font-semibold flex items-center gap-1.5">
              <Percent className="h-3.5 w-3.5 text-rose-500" />
              Juros / encargos adicionais da operadora (opcional)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-semibold text-muted-foreground">
                R$
              </span>
              <Input
                id="rollover-interest"
                type="number"
                step="0.01"
                min="0"
                value={interestStr}
                onChange={(e) => setInterestStr(e.target.value)}
                placeholder="0,00"
                className="h-9 pl-9 text-xs font-semibold"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Caso o cartão cobre taxa de rotativo, informe aqui para já incluir no valor que irá para o próximo mês.
            </p>
          </div>

          {/* Categoria do Lançamento */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Categoria na próxima fatura
            </Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-9 text-xs bg-card">
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

          {/* Resumo do Total a Ser Lançado */}
          <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Saldo devedor principal:</span>
              <span className="font-semibold text-foreground">{brl(openAmount)}</span>
            </div>
            {parsedInterest > 0 ? (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Juros / encargos adicionais:</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {`+ ${brl(parsedInterest)}`}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between pt-1 border-t border-border font-bold text-sm">
              <span>Total na fatura de {targetMonthName}:</span>
              <span className="text-foreground">{brl(totalRolloverAmount)}</span>
            </div>
          </div>

          {/* Alerta explicativo */}
          <div className="flex items-start gap-2 rounded-lg bg-secondary/50 p-2.5 text-[11px] text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <p>
              Ao confirmar, a fatura atual de {origMonthName} será finalizada com o saldo transferido, e o valor total de <strong>{brl(totalRolloverAmount)}</strong> constará na fatura de {targetMonthName}/{tgtY} do cartão {cardName}.
            </p>
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
              disabled={submitting || openAmount <= 0}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <ArrowRight className="mr-1.5 h-4 w-4" />
              {submitting
                ? "Transferindo..."
                : `Transferir para ${targetMonthName} (${brl(totalRolloverAmount)})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
