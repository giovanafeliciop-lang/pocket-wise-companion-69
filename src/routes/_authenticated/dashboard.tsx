import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarRange,
  CircleDollarSign,
  CreditCard,
  FileSpreadsheet,
  FileUp,
  Mail,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/finance/StatCard";
import { MonthPicker } from "@/components/finance/MonthPicker";
import { TransactionList } from "@/components/finance/TransactionList";
import { TransactionDialog } from "@/components/finance/TransactionDialog";
import { InvoiceImportDialog } from "@/components/finance/InvoiceImportDialog";
import { EmailNotificationDialog } from "@/components/finance/EmailNotificationDialog";
import { CategoryBreakdown } from "@/components/finance/CategoryBreakdown";
import { YearOverview } from "@/components/finance/YearOverview";
import { AnnualSummaryView } from "@/components/finance/AnnualSummaryView";
import { exportMonthToExcel, exportYearToExcel } from "@/lib/export";
import {
  AVAILABLE_YEARS,
  MONTH_NAMES,
  brl,
  createTransactions,
  deleteInvoice,
  deleteTransaction,
  fetchAllYearsHistory,
  fetchAllYearsTransactions,
  fetchCategories,
  fetchMonthlyHistory,
  fetchTransactions,
  fetchYearTransactions,
  isCreditCardExpense,
  isDirectExpense,
  payInvoice,
  rolloverInvoiceDebt,
  togglePaid,
  toggleBatchPaid,
  updateTransaction,
  type Kind,
  type PayInvoiceParams,
  type RolloverInvoiceParams,
  type Transaction,
  type TransactionInput,
} from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Meu Painel Financeiro — Controle de gastos e receitas" },
      {
        name: "description",
        content:
          "Painel de finanças pessoais com lançamentos de receitas e despesas, importação de fatura do cartão por IA, categorias automáticas e controle do que já foi pago.",
      },
      { property: "og:title", content: "Meu Painel Financeiro" },
      {
        property: "og:description",
        content:
          "Controle receitas, despesas, categorias e faturas do cartão em um painel moderno em português.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth());
  const [activeTab, setActiveTab] = useState<"month" | "year">("month");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [defaultKind, setDefaultKind] = useState<Kind>("expense");
  const [editing, setEditing] = useState<Transaction | null>(null);

  const transactionsQuery = useQuery({
    queryKey: ["transactions", year, month],
    queryFn: () => fetchTransactions(year, month),
  });

  const historyQuery = useQuery({
    queryKey: ["monthly_history", year],
    queryFn: () => fetchMonthlyHistory(year),
  });

  const yearQuery = useQuery({
    queryKey: ["transactions_year", year],
    queryFn: () => fetchYearTransactions(year),
  });

  const allHistoryQuery = useQuery({
    queryKey: ["monthly_history_all"],
    queryFn: fetchAllYearsHistory,
  });

  const allTransactionsQuery = useQuery({
    queryKey: ["transactions_all"],
    queryFn: fetchAllYearsTransactions,
  });

  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const transactions = transactionsQuery.data ?? [];
  const monthHistory = historyQuery.data?.find((h) => h.month === month + 1);

  const totals = useMemo(() => {
    // 1. Entradas (prioriza transações cadastradas no app se existirem)
    const directIncome = transactions
      .filter((t) => t.kind === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    // 2. Despesas à vista / pagas diretamente em caixa
    const directExpenses = transactions
      .filter(isDirectExpense)
      .reduce((sum, t) => sum + t.amount, 0);

    // 3. Compras no cartão de crédito
    const creditCardExpenses = transactions
      .filter(isCreditCardExpense)
      .reduce((sum, t) => sum + t.amount, 0);

    // Se o mês já tem transações reais cadastradas, usa estritamente o valor calculado e não soma valores legados de planilha
    const hasTransactions = transactions.length > 0;
    const baseExpenses = hasTransactions ? 0 : (monthHistory?.expenses ?? 0);
    const baseIncome = hasTransactions ? 0 : (monthHistory?.income ?? 0);

    const expenses = baseExpenses + directExpenses;
    const income = baseIncome + directIncome;
    const balance = income - expenses;

    return {
      expenses,
      directExpenses,
      creditCardExpenses,
      income,
      balance,
    };
  }, [transactions, monthHistory]);

  const categories = categoriesQuery.data ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["transactions_year"] });
    qc.invalidateQueries({ queryKey: ["transactions_all"] });
    qc.invalidateQueries({ queryKey: ["monthly_history"] });
    qc.invalidateQueries({ queryKey: ["monthly_history_all"] });
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const saveMutation = useMutation({
    mutationFn: async (input: TransactionInput | TransactionInput[]) => {
      if (Array.isArray(input)) {
        await createTransactions(input);
      } else if (editing) {
        await updateTransaction(editing.id, input);
      } else {
        await createTransactions([input]);
      }
    },
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success(editing ? "Lançamento atualizado!" : "Lançamento criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paidMutation = useMutation({
    mutationFn: (t: Transaction) => togglePaid(t.id, !t.is_paid),
    onSuccess: () => {
      invalidate();
      toast.success("Status atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const batchPaidMutation = useMutation({
    mutationFn: ({ ids, isPaid }: { ids: string[]; isPaid: boolean }) =>
      toggleBatchPaid(ids, isPaid),
    onSuccess: (_, variables) => {
      invalidate();
      toast.success(
        variables.isPaid ? "Fatura marcada como paga!" : "Fatura reaberta com sucesso!",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payInvoiceMutation = useMutation({
    mutationFn: (params: PayInvoiceParams) => payInvoice(params),
    onSuccess: (_, variables) => {
      invalidate();
      if (variables.isPartial) {
        if (variables.partialAction === "rollover_next_month") {
          toast.success(
            `Pagamento de ${brl(variables.paidAmount)} registrado! O saldo devedor restante foi transferido para a fatura seguinte.`,
          );
        } else {
          toast.warning(
            `Pagamento parcial de ${brl(variables.paidAmount)} registrado! O saldo restante continuará em aberto nesta fatura.`,
          );
        }
      } else {
        toast.success(
          `Fatura de ${variables.items[0]?.card_name ?? "cartão"} marcada como paga!`,
        );
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rolloverInvoiceMutation = useMutation({
    mutationFn: (params: RolloverInvoiceParams) => rolloverInvoiceDebt(params),
    onSuccess: (_, variables) => {
      invalidate();
      toast.success(
        `Saldo devedor de ${brl(variables.openAmount)} transferido para a fatura seguinte do cartão ${variables.cardName}!`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (t: Transaction) => deleteTransaction(t.id),
    onSuccess: () => {
      invalidate();
      toast.success("Lançamento removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: ({ cardName, ids }: { cardName: string; ids: string[] }) =>
      deleteInvoice(ids),
    onSuccess: (_, variables) => {
      invalidate();
      toast.success(
        `Fatura do cartão ${variables.cardName} (${variables.ids.length} ${
          variables.ids.length === 1 ? "lançamento" : "lançamentos"
        }) excluída com sucesso!`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = (kind: Kind) => {
    setEditing(null);
    setDefaultKind(kind);
    setDialogOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Principal do Dashboard */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            Controle de Finanças
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Painel Financeiro
          </h1>
          <p className="text-xs text-muted-foreground">
            {activeTab === "month"
              ? `Visão detalhada de ${MONTH_NAMES[month]} de ${year}`
              : `Panorama consolidado do ano de ${year}`}
          </p>
        </div>

        {/* Barra de Ações Rápidas */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "month" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportMonthToExcel(
                  year,
                  month,
                  transactions,
                  categories,
                  monthHistory,
                )
              }
              className="gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
              title="Exportar dados do mês para planilha Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Exportar Mês (Excel)</span>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportYearToExcel(year, yearQuery.data ?? [], categories, historyQuery.data ?? [])
              }
              className="gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
              title="Exportar todos os meses do ano para planilha Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Exportar Ano Completo (Excel)</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmailOpen(true)}
            className="gap-1.5 text-xs text-indigo-600 dark:text-indigo-400"
          >
            <Mail className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Alertas por E-mail</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            className="gap-1.5 text-xs"
          >
            <FileUp className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Importar Fatura</span>
            <span className="sm:hidden">Importar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => openNew("income")}
            className="gap-1.5 text-xs text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Receita</span>
          </Button>

          <Button size="sm" onClick={() => openNew("expense")} className="gap-1.5 text-xs">
            <Plus className="h-3.5 w-3.5" />
            <span>Despesa</span>
          </Button>
        </div>
      </header>

      {/* Navegação entre Abas: Mês a Mês vs Resumo Anual */}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-3">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "month" | "year")}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid w-full grid-cols-2 sm:w-auto bg-secondary/60">
            <TabsTrigger value="month" className="text-xs font-semibold gap-1.5">
              <CircleDollarSign className="h-3.5 w-3.5" />
              <span>Mês a Mês</span>
            </TabsTrigger>
            <TabsTrigger value="year" className="text-xs font-semibold gap-1.5">
              <CalendarRange className="h-3.5 w-3.5" />
              <span>Resumo do Ano</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === "month" ? (
          <MonthPicker
            year={year}
            month={month}
            onMonthChange={(m) => setMonth(m)}
            onYearChange={(y) => setYear(y)}
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Ano em análise:</span>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
              {AVAILABLE_YEARS.map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    y === year
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {activeTab === "month" ? (
        /* Aba de Visualização Mensal */
        <div key={`month-view-${year}-${month}`} className="mt-6 space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Saldo do mês"
              value={brl(totals.balance)}
              icon={Wallet}
              tone={totals.balance >= 0 ? "success" : "danger"}
              hint={
                totals.balance >= 0
                  ? "Resultado positivo no período"
                  : "Gastos superaram as receitas"
              }
            />
            <StatCard
              title="Entradas do mês"
              value={brl(totals.income)}
              icon={TrendingUp}
              tone="success"
              hint={
                transactions.length === 0 && monthHistory
                  ? "Histórico da planilha"
                  : `${transactions.filter((t) => t.kind === "income").length} receitas lançadas`
              }
            />
            <StatCard
              title="Gastos pagos / à vista"
              value={brl(totals.expenses)}
              icon={TrendingDown}
              tone="default"
              hint={
                transactions.length === 0 && monthHistory
                  ? "Histórico da planilha"
                  : `${transactions.filter(isDirectExpense).length} despesas quitadas em caixa`
              }
            />
            <StatCard
              title="A pagar (em aberto)"
              value={brl(
                transactions
                  .filter((t) => t.kind === "expense" && !t.is_paid)
                  .reduce((sum, t) => sum + t.amount, 0),
              )}
              icon={CreditCard}
              tone="warning"
              hint={`${transactions.filter((t) => t.kind === "expense" && !t.is_paid).length} contas em aberto`}
            />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <CategoryBreakdown transactions={transactions} categories={categories} />
            <YearOverview year={year} history={historyQuery.data ?? []} transactions={yearQuery.data ?? []} />
          </section>

          <section>
            <TransactionList
              transactions={transactions}
              categories={categories}
              onTogglePaid={(t) => paidMutation.mutate(t)}
              onToggleBatchPaid={(ids, isPaid) => batchPaidMutation.mutate({ ids, isPaid })}
              onPayInvoice={async (params) => {
                await payInvoiceMutation.mutateAsync(params);
              }}
              onRolloverInvoice={async (params) => {
                await rolloverInvoiceMutation.mutateAsync(params);
              }}
              onDeleteInvoice={async (cardName, items) => {
                await deleteInvoiceMutation.mutateAsync({
                  cardName,
                  ids: items.map((i) => i.id),
                });
              }}
              onEdit={(t) => {
                setEditing(t);
                setDialogOpen(true);
              }}
              onDelete={(t) => deleteMutation.mutate(t)}
            />
          </section>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="h-3.5 w-3.5" />
              <span>{`Total movimentado em caixa (${MONTH_NAMES[month]}): ${brl(totals.income + totals.expenses)}`}</span>
            </div>
            {totals.creditCardExpenses > 0 ? (
              <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                {`+ ${brl(totals.creditCardExpenses)} em compras no cartão (faturas futuras)`}
              </span>
            ) : null}
          </footer>
        </div>
      ) : (
        /* Aba de Resumo do Ano */
        <div key={`year-view-${year}`} className="mt-6">
          <AnnualSummaryView
            year={year}
            onSelectYear={(y) => setYear(y)}
            onSelectMonth={(m) => setMonth(m)}
            onNavigateToMonth={(y, m) => {
              setYear(y);
              setMonth(m);
              setActiveTab("month");
            }}
            history={historyQuery.data ?? []}
            transactions={yearQuery.data ?? []}
            allHistory={allHistoryQuery.data ?? []}
            allTransactions={allTransactionsQuery.data ?? []}
            categories={categories}
          />
        </div>
      )}

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        categories={categories}
        defaultKind={defaultKind}
        editing={editing}
        onSubmit={async (values) => {
          await saveMutation.mutateAsync(values);
          const firstDate = (Array.isArray(values) ? values[0]?.occurred_on : values.occurred_on) ?? "";
          const [y, m] = firstDate.split("-").map(Number);
          if (y && m) {
            setYear(y);
            setMonth(m - 1);
          }
        }}
      />

      <InvoiceImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        categories={categories}
        onImportSuccess={(card, count, firstDate) => {
          invalidate();
          if (firstDate) {
            const [y, m] = firstDate.split("-").map(Number);
            if (y && m) {
              setYear(y);
              setMonth(m - 1);
            }
          }
        }}
      />

      <EmailNotificationDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        transactions={transactions}
        categories={categories}
        year={year}
        month={month}
      />
    </div>
  );
}
