import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  LogOut,
  Plus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { exportYearToExcel } from "@/lib/export";
import { claimLegacyData } from "@/lib/claim.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { StatCard } from "@/components/finance/StatCard";
import { CategoryBreakdown } from "@/components/finance/CategoryBreakdown";
import { YearOverview } from "@/components/finance/YearOverview";
import { TransactionList } from "@/components/finance/TransactionList";
import { TransactionDialog } from "@/components/finance/TransactionDialog";
import { InvoiceImportDialog } from "@/components/finance/InvoiceImportDialog";
import { EmailNotificationDialog } from "@/components/finance/EmailNotificationDialog";
import { AnnualSummaryView } from "@/components/finance/AnnualSummaryView";
import {
  AVAILABLE_YEARS,
  MONTH_NAMES,
  brl,
  createTransactions,
  deleteTransaction,
  fetchAllYearsHistory,
  fetchAllYearsTransactions,
  fetchCategories,
  fetchMonthlyHistory,
  fetchTransactions,
  fetchYearTransactions,
  togglePaid,
  toggleBatchPaid,
  updateTransaction,
  type Kind,
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
  component: Dashboard,
  errorComponent: DashboardError,

});

function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-xl font-semibold">Algo deu errado no painel</h1>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button
        onClick={() => {
          void router.invalidate();
          reset();
        }}
      >
        Tentar novamente
      </Button>
    </main>
  );
}



function Dashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    void claimLegacyData().then((result) => {
      if (result?.claimed) {
        void queryClient.invalidateQueries();
      }
    });
  }, [queryClient]);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  };
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [activeTab, setActiveTab] = useState<"month" | "year">("month");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [defaultKind, setDefaultKind] = useState<Kind>("expense");
  const [editing, setEditing] = useState<Transaction | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setUserEmail(data.user.email);
    });
  }, []);

  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const monthQuery = useQuery({
    queryKey: ["transactions", year, month],
    queryFn: () => fetchTransactions(year, month),
  });
  const historyQuery = useQuery({
    queryKey: ["history", year],
    queryFn: () => fetchMonthlyHistory(year),
  });
  const yearQuery = useQuery({
    queryKey: ["year-transactions", year],
    queryFn: () => fetchYearTransactions(year),
  });
  const allHistoryQuery = useQuery({
    queryKey: ["all-history"],
    queryFn: fetchAllYearsHistory,
  });
  const allTransactionsQuery = useQuery({
    queryKey: ["all-transactions"],
    queryFn: fetchAllYearsTransactions,
  });

  const categories = categoriesQuery.data ?? [];
  const transactions = useMemo(() => monthQuery.data ?? [], [monthQuery.data]);
  const monthHistory = useMemo(
    () => (historyQuery.data ?? []).find((h) => h.month === month + 1),
    [historyQuery.data, month],
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const dueTodayExpenses = useMemo(() => {
    return transactions.filter(
      (t) => t.kind === "expense" && !t.is_paid && t.occurred_on === todayStr,
    );
  }, [transactions, todayStr]);

  const totalDueToday = useMemo(() => {
    return dueTodayExpenses.reduce((sum, t) => sum + t.amount, 0);
  }, [dueTodayExpenses]);

  const totals = useMemo(() => {
    const expenses =
      (monthHistory?.expenses ?? 0) +
      transactions.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);
    const income =
      (monthHistory?.income ?? 0) +
      transactions.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
    const pending = transactions
      .filter((t) => t.kind === "expense" && !t.is_paid)
      .reduce((s, t) => s + t.amount, 0);
    return { expenses, income, pending, balance: income - expenses };
  }, [transactions, monthHistory]);


  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    void queryClient.invalidateQueries({ queryKey: ["year-transactions"] });
    void queryClient.invalidateQueries({ queryKey: ["all-history"] });
    void queryClient.invalidateQueries({ queryKey: ["all-transactions"] });
  };

  const saveMutation = useMutation({
    mutationFn: async (values: TransactionInput | TransactionInput[]) => {
      if (editing) {
        const single = Array.isArray(values) ? values[0] : values;
        if (!single) return;
        await updateTransaction(editing.id, single);
      } else {
        const rows = Array.isArray(values) ? values : [values];
        if (rows.length === 0) return;
        await createTransactions(rows);
      }
    },
    onSuccess: (_, variables) => {
      invalidate();
      const isMultiple = Array.isArray(variables) && variables.length > 1;
      if (editing) {
        toast.success("Lançamento atualizado");
      } else if (isMultiple) {
        toast.success(
          `${(variables as TransactionInput[]).length} lançamentos recorrentes adicionados com sucesso!`,
        );
      } else {
        toast.success("Lançamento adicionado");
      }
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paidMutation = useMutation({
    mutationFn: (t: Transaction) => togglePaid(t.id, !t.is_paid),
    onSuccess: invalidate,
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

  const deleteMutation = useMutation({
    mutationFn: (t: Transaction) => deleteTransaction(t.id),
    onSuccess: () => {
      invalidate();
      toast.success("Lançamento removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  const openNew = (kind: Kind) => {
    setEditing(null);
    setDefaultKind(kind);
    setDialogOpen(true);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Finanças pessoais
          </p>
          <h1 className="mt-1 text-3xl font-semibold">
            <span className="text-gradient">Meu painel financeiro</span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "month" ? (
            <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary/40 p-1">
              <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)} aria-label="Mês anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select
                value={String(month)}
                onValueChange={(v) => setMonth(Number(v))}
              >
                <SelectTrigger className="h-9 w-32 border-0 bg-transparent text-sm font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={name} value={String(i)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="h-9 w-24 border-0 bg-transparent text-sm font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)} aria-label="Próximo mês">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary/40 p-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setYear((prev) => prev - 1)}
                aria-label="Ano anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="h-9 w-28 border-0 bg-transparent text-sm font-medium font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setYear((prev) => prev + 1)}
                aria-label="Próximo ano"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            onClick={() => {
              exportYearToExcel(year, yearQuery.data ?? [], categories, historyQuery.data ?? []);
              toast.success(`Planilha de ${year} exportada`);
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Importar fatura
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            title="Lembretes por e-mail"
            onClick={() => setNotificationOpen(true)}
          >
            <Bell className="h-4 w-4" />
            {dueTodayExpenses.length > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-xs">
                {dueTodayExpenses.length}
              </span>
            ) : null}
          </Button>
          <Button variant="outline" onClick={() => openNew("income")}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Entrada
          </Button>
          <Button onClick={() => openNew("expense")}>
            <Plus className="mr-2 h-4 w-4" />
            Despesa
          </Button>
          <Button variant="ghost" size="icon" title="Sair" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Barra de Navegação de Abas: Visão Mensal vs Resumo do Ano */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
        <div className="flex items-center gap-1.5 rounded-xl bg-secondary/50 p-1 border border-border/40">
          <Button
            type="button"
            variant={activeTab === "month" ? "default" : "ghost"}
            size="sm"
            className="h-8 text-xs gap-1.5 font-medium rounded-lg"
            onClick={() => setActiveTab("month")}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Visão Mensal</span>
            <span className="text-[10px] opacity-80">{`(${MONTH_NAMES[month]} ${year})`}</span>
          </Button>

          <Button
            type="button"
            variant={activeTab === "year" ? "default" : "ghost"}
            size="sm"
            className="h-8 text-xs gap-1.5 font-medium rounded-lg"
            onClick={() => setActiveTab("year")}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Resumo do Ano</span>
            <span className="text-[10px] opacity-80">{`(${year})`}</span>
          </Button>
        </div>

        {activeTab === "month" ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Visualizando:</span>
            <Badge variant="outline" className="text-xs font-semibold text-foreground">
              {`${MONTH_NAMES[month]} de ${year}`}
            </Badge>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Visão consolidada de:</span>
            <Badge variant="outline" className="text-xs font-semibold text-foreground">
              {`Ano ${year}`}
            </Badge>
          </div>
        )}
      </div>

      {activeTab === "month" ? (
        /* Conteúdo dinâmico do mês selecionado com chave estável */
        <div key={`month-view-${year}-${month}`} className="mt-6 space-y-6 animate-in fade-in duration-200">
          {/* Banner de Lembrete: Contas Vencendo Hoje em Aberto */}
          {dueTodayExpenses.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-200 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    {`Você tem ${dueTodayExpenses.length} ${dueTodayExpenses.length === 1 ? "conta" : "contas"} vencendo hoje (${brl(totalDueToday)}) em aberto`}
                  </p>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    Os lembretes são enviados de forma 100% automática por e-mail no dia do vencimento.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
                  onClick={() => setNotificationOpen(true)}
                >
                  <Bell className="mr-1.5 h-3.5 w-3.5" />
                  Ver lembretes por e-mail
                </Button>
              </div>
            </div>
          ) : null}

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Entradas do mês"
              value={totals.income}
              icon={TrendingUp}
              tone="primary"
              {...(monthHistory ? { hint: "Inclui histórico da planilha" } : {})}
            />
            <StatCard
              label="Gastos do mês"
              value={totals.expenses}
              icon={TrendingDown}
              tone="danger"
              {...(monthHistory ? { hint: "Inclui histórico da planilha" } : {})}
            />

            <StatCard
              label="Saldo"
              value={totals.balance}
              icon={Wallet}
              tone={totals.balance >= 0 ? "primary" : "danger"}
              hint={totals.balance >= 0 ? "Você está no azul" : "Atenção ao vermelho"}
            />
            <StatCard
              label="A pagar"
              value={totals.pending}
              icon={Clock3}
              tone="warning"
              hint={`${transactions.filter((t) => t.kind === "expense" && !t.is_paid).length} despesas em aberto`}
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
              onEdit={(t) => {
                setEditing(t);
                setDialogOpen(true);
              }}
              onDelete={(t) => deleteMutation.mutate(t)}
            />
          </section>

          <footer className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
            <CircleDollarSign className="h-3.5 w-3.5" />
            <span>{`Total lançado em ${MONTH_NAMES[month]}: ${brl(totals.income + totals.expenses)}`}</span>
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
        defaultDate={`${year}-${String(month + 1).padStart(2, "0")}-10`}
        onConfirm={async (rows) => {
          await createTransactions(rows);
          invalidate();
        }}
      />

      <EmailNotificationDialog
        open={notificationOpen}
        onOpenChange={setNotificationOpen}
        userEmail={userEmail}
        transactions={transactions}
        categories={categories}
      />
    </main>
  );
}
