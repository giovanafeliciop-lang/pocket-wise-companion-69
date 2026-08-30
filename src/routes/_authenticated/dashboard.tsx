import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  Plus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { exportYearToExcel } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/finance/StatCard";
import { CategoryBreakdown } from "@/components/finance/CategoryBreakdown";
import { YearOverview } from "@/components/finance/YearOverview";
import { TransactionList } from "@/components/finance/TransactionList";
import { TransactionDialog } from "@/components/finance/TransactionDialog";
import { InvoiceImportDialog } from "@/components/finance/InvoiceImportDialog";
import {
  MONTH_NAMES,
  brl,
  createTransactions,
  deleteTransaction,
  fetchCategories,
  fetchMonthlyHistory,
  fetchTransactions,
  fetchYearTransactions,
  togglePaid,
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
});

function Dashboard() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [defaultKind, setDefaultKind] = useState<Kind>("expense");
  const [editing, setEditing] = useState<Transaction | null>(null);

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

  const categories = categoriesQuery.data ?? [];
  const transactions = useMemo(() => monthQuery.data ?? [], [monthQuery.data]);
  const monthHistory = useMemo(
    () => (historyQuery.data ?? []).find((h) => h.month === month + 1),
    [historyQuery.data, month],
  );

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
  };

  const saveMutation = useMutation({
    mutationFn: async (values: TransactionInput) => {
      if (editing) await updateTransaction(editing.id, values);
      else await createTransactions([values]);
    },
    onSuccess: () => {
      invalidate();
      toast.success(editing ? "Lançamento atualizado" : "Lançamento adicionado");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const paidMutation = useMutation({
    mutationFn: (t: Transaction) => togglePaid(t.id, !t.is_paid),
    onSuccess: invalidate,
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
          <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary/40 p-1">
            <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-36 text-center text-sm font-medium">
              {MONTH_NAMES[month]} {year}
            </span>
            <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary/40 p-1">
            {[2025, 2026].map((y) => (
              <Button
                key={y}
                variant={year === y ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setYear(y)}
              >
                {y}
              </Button>
            ))}
          </div>
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
          <Button variant="outline" onClick={() => openNew("income")}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Entrada
          </Button>
          <Button onClick={() => openNew("expense")}>
            <Plus className="mr-2 h-4 w-4" />
            Despesa
          </Button>
        </div>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <CategoryBreakdown transactions={transactions} categories={categories} />
        <YearOverview year={year} history={historyQuery.data ?? []} transactions={yearQuery.data ?? []} />
      </section>

      <section className="mt-6">
        <TransactionList
          transactions={transactions}
          categories={categories}
          onTogglePaid={(t) => paidMutation.mutate(t)}
          onEdit={(t) => {
            setEditing(t);
            setDialogOpen(true);
          }}
          onDelete={(t) => deleteMutation.mutate(t)}
        />
      </section>

      <footer className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <CircleDollarSign className="h-3.5 w-3.5" />
        Total lançado em {MONTH_NAMES[month]}: {brl(totals.income + totals.expenses)}
      </footer>

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
        }}
      />

      <InvoiceImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        categories={categories}
        onConfirm={async (rows) => {
          await createTransactions(rows);
          invalidate();
        }}
      />
    </main>
  );
}
