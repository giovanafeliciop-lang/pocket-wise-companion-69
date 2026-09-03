import { useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Download,
  ExternalLink,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportYearToExcel } from "@/lib/export";
import {
  AVAILABLE_YEARS,
  MONTH_NAMES,
  brl,
  isCreditCardExpense,
  isDirectExpense,
  type Category,
  type MonthlyHistory,
  type Transaction,
} from "@/lib/finance";

type Props = {
  year: number;
  onSelectYear: (y: number) => void;
  onSelectMonth: (m: number) => void;
  onNavigateToMonth: (y: number, m: number) => void;
  history: MonthlyHistory[];
  transactions: Transaction[];
  allHistory?: MonthlyHistory[];
  allTransactions?: Transaction[];
  categories: Category[];
};

export function AnnualSummaryView({
  year,
  onSelectYear,
  onSelectMonth,
  onNavigateToMonth,
  history,
  transactions,
  allHistory = [],
  allTransactions = [],
  categories,
}: Props) {
  // 1. Dados de cada mês do ano selecionado
  const monthlyData = useMemo(() => {
    let runningBalance = 0;
    return MONTH_NAMES.map((name, index) => {
      const monthNum = index + 1;
      const base = history.find((h) => h.month === monthNum);
      const monthTxs = transactions.filter(
        (t) => Number(t.occurred_on.slice(5, 7)) === monthNum,
      );

      const expenses =
        (base?.expenses ?? 0) +
        monthTxs.filter(isDirectExpense).reduce((s, t) => s + t.amount, 0);

      const creditCardExpenses = monthTxs
        .filter(isCreditCardExpense)
        .reduce((s, t) => s + t.amount, 0);

      const income =
        (base?.income ?? 0) +
        monthTxs.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);

      const balance = income - expenses;
      runningBalance += balance;

      return {
        monthIndex: index,
        monthName: name,
        shortName: name.slice(0, 3),
        income,
        expenses,
        creditCardExpenses,
        balance,
        runningBalance,
        txCount: monthTxs.length,
        hasData: income > 0 || expenses > 0 || creditCardExpenses > 0,
      };
    });
  }, [history, transactions]);

  // 2. Totais do ano
  const totals = useMemo(() => {
    const totalIncome = monthlyData.reduce((acc, m) => acc + m.income, 0);
    const totalExpenses = monthlyData.reduce((acc, m) => acc + m.expenses, 0);
    const totalCreditCardExpenses = monthlyData.reduce((acc, m) => acc + m.creditCardExpenses, 0);
    const netBalance = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    const monthsWithActivity = monthlyData.filter((m) => m.hasData).length || 1;
    const avgMonthlyExpense = totalExpenses / monthsWithActivity;
    const avgMonthlyIncome = totalIncome / monthsWithActivity;

    return {
      totalIncome,
      totalExpenses,
      totalCreditCardExpenses,
      netBalance,
      savingsRate,
      avgMonthlyExpense,
      avgMonthlyIncome,
      monthsWithActivity,
    };
  }, [monthlyData]);

  // 3. Gastos por categoria no ano todo
  const categoryTotals = useMemo(() => {
    const yearExpenses = transactions.filter((t) => t.kind === "expense");
    const map = new Map<string, number>();

    for (const t of yearExpenses) {
      const key = t.category_id ?? "none";
      map.set(key, (map.get(key) ?? 0) + t.amount);
    }

    const list = Array.from(map.entries())
      .map(([key, value]) => {
        const cat = categories.find((c) => c.id === key);
        return {
          id: key,
          name: cat?.name ?? "Sem categoria",
          color: cat?.color ?? "#64748b",
          value,
        };
      })
      .sort((a, b) => b.value - a.value);

    const totalCatValue = list.reduce((sum, c) => sum + c.value, 0);

    return { list, totalCatValue };
  }, [transactions, categories]);

  // 4. Comparativo entre todos os anos
  const multiYearComparison = useMemo(() => {
    return AVAILABLE_YEARS.map((y) => {
      const yearHistory = allHistory.filter((h) => h.year === y);
      const yearTxs = allTransactions.filter(
        (t) => t.occurred_on.startsWith(String(y)),
      );

      const histIncome = yearHistory.reduce((acc, h) => acc + (h.income ?? 0), 0);
      const histExpenses = yearHistory.reduce((acc, h) => acc + (h.expenses ?? 0), 0);

      const txIncome = yearTxs
        .filter((t) => t.kind === "income")
        .reduce((acc, t) => acc + t.amount, 0);
      const txExpenses = yearTxs
        .filter(isDirectExpense)
        .reduce((acc, t) => acc + t.amount, 0);

      const totalIncome = histIncome + txIncome;
      const totalExpenses = histExpenses + txExpenses;
      const balance = totalIncome - totalExpenses;

      return {
        year: y,
        income: totalIncome,
        expenses: totalExpenses,
        balance,
        hasData: totalIncome > 0 || totalExpenses > 0,
      };
    }).filter((y) => y.hasData || y.year === year || y.year === 2023 || y.year === 2024 || y.year === 2025 || y.year === 2026);
  }, [allHistory, allTransactions, year]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Controles de Cabeçalho do Ano */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card/60 p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">
              {`Resumo Financeiro de ${year}`}
            </h2>
            <p className="text-xs text-muted-foreground">
              Consolidação de todas as entradas, saídas e balanço dos 12 meses
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary/40 p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onSelectYear(year - 1)}
              aria-label="Ano anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={String(year)} onValueChange={(v) => onSelectYear(Number(v))}>
              <SelectTrigger className="h-8 w-28 border-0 bg-transparent text-sm font-semibold">
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
              className="h-8 w-8"
              onClick={() => onSelectYear(year + 1)}
              aria-label="Próximo ano"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => {
              exportYearToExcel(year, transactions, categories, history);
              toast.success(`Planilha consolidada de ${year} exportada`);
            }}
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Cartões de Indicadores Anuais */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="surface-card relative overflow-hidden p-5 border-l-4 border-l-primary">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Entradas ({year})
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-primary">
            {brl(totals.totalIncome)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {`Média: ${brl(totals.avgMonthlyIncome)} / mês ativo`}
          </p>
        </div>

        <div className="surface-card relative overflow-hidden p-5 border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Gastos ({year})
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-foreground">
            {brl(totals.totalExpenses)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {`Média: ${brl(totals.avgMonthlyExpense)} / mês ativo`}
          </p>
        </div>

        <div className="surface-card relative overflow-hidden p-5 border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Compras no Cartão ({year})
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {brl(totals.totalCreditCardExpenses)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Lançadas no cartão de crédito
          </p>
        </div>

        <div className="surface-card relative overflow-hidden p-5 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Saldo Líquido ({year})
            </span>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                totals.netBalance >= 0
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-rose-500/10 text-rose-500"
              }`}
            >
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p
            className={`mt-3 font-display text-2xl font-bold ${
              totals.netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {brl(totals.netBalance)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {totals.netBalance >= 0
              ? `Superávit acumulado no ano`
              : `Déficit acumulado no ano`}
          </p>
        </div>

        <div className="surface-card relative overflow-hidden p-5 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Taxa de Poupança
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <PiggyBank className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-foreground">
            {`${totals.savingsRate.toFixed(1)}%`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {totals.savingsRate >= 0
              ? `${totals.savingsRate.toFixed(1)}% das receitas guardadas`
              : `Gastos superaram receitas em ${Math.abs(totals.savingsRate).toFixed(1)}%`}
          </p>
        </div>
      </section>

      {/* Gráfico Comparativo Mês a Mês */}
      <section className="surface-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold">Evolução Mensal ({year})</h3>
            <p className="text-xs text-muted-foreground">
              Comparação direta entre entradas e despesas mês a mês
            </p>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="shortName" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <Tooltip
                cursor={{ fill: "var(--secondary)", opacity: 0.4 }}
                formatter={(value: number) => brl(value)}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  color: "var(--foreground)",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Entradas" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expenses" name="Gastos" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Tabela Detalhada de Balanço Mês a Mês */}
      <section className="surface-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold">Balanço Detalhado por Mês</h3>
            <p className="text-xs text-muted-foreground">
              Todos os meses de {year} com receitas, despesas e saldo líquido
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/40 text-xs font-semibold uppercase text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3">Mês</th>
                <th className="px-4 py-3 text-right">Entradas</th>
                <th className="px-4 py-3 text-right">Gastos</th>
                <th className="px-4 py-3 text-right">Saldo do Mês</th>
                <th className="px-4 py-3 text-right">Acumulado</th>
                <th className="px-4 py-3 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {monthlyData.map((m) => (
                <tr
                  key={m.monthIndex}
                  className="transition-colors hover:bg-secondary/20"
                >
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <span>{m.monthName}</span>
                      {m.hasData ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {`${m.txCount} lanc.`}
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right numeric font-medium text-primary">
                    {brl(m.income)}
                  </td>
                  <td className="px-4 py-3 text-right numeric font-medium text-foreground">
                    {brl(m.expenses)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right numeric font-semibold ${
                      m.balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {`${m.balance >= 0 ? "+" : ""}${brl(m.balance)}`}
                  </td>
                  <td
                    className={`px-4 py-3 text-right numeric font-medium text-muted-foreground ${
                      m.runningBalance >= 0 ? "text-emerald-600/80" : "text-rose-600/80"
                    }`}
                  >
                    {brl(m.runningBalance)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        onSelectMonth(m.monthIndex);
                        onNavigateToMonth(year, m.monthIndex);
                      }}
                    >
                      <span>Ver mês</span>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-secondary/60 font-bold border-t-2 border-border text-foreground">
              <tr>
                <td className="px-4 py-3 text-sm">TOTAL DO ANO ({year})</td>
                <td className="px-4 py-3 text-right numeric text-primary">
                  {brl(totals.totalIncome)}
                </td>
                <td className="px-4 py-3 text-right numeric text-foreground">
                  {brl(totals.totalExpenses)}
                </td>
                <td
                  className={`px-4 py-3 text-right numeric text-base ${
                    totals.netBalance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {`${totals.netBalance >= 0 ? "+" : ""}${brl(totals.netBalance)}`}
                </td>
                <td
                  className={`px-4 py-3 text-right numeric ${
                    totals.netBalance >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {brl(totals.netBalance)}
                </td>
                <td className="px-4 py-3 text-center text-xs text-muted-foreground">12 meses</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Gastos por Categoria no Ano Inteiro & Comparativo Anual */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gastos por Categoria no Ano */}
        <section className="surface-card p-5 space-y-4">
          <div>
            <h3 className="font-display text-lg font-semibold">
              Gastos por Categoria em {year}
            </h3>
            <p className="text-xs text-muted-foreground">
              Distribuição acumulada de todas as despesas no ano
            </p>
          </div>

          {categoryTotals.list.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <p>Nenhuma despesa registrada para este ano ainda.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryTotals.list}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={75}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {categoryTotals.list.map((d, i) => (
                        <Cell key={`annual-cell-${d.name}-${i}`} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => brl(value)}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        color: "var(--foreground)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {categoryTotals.list.map((d, i) => {
                  const percent =
                    categoryTotals.totalCatValue > 0
                      ? (d.value / categoryTotals.totalCatValue) * 100
                      : 0;
                  return (
                    <div key={`annual-cat-${d.name}-${i}`} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 truncate">
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: d.color }}
                          />
                          <span className="truncate">{d.name}</span>
                        </span>
                        <span className="numeric font-medium ml-2 shrink-0">
                          {`${brl(d.value)} (${percent.toFixed(0)}%)`}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: d.color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Comparativo com Outros Anos */}
        <section className="surface-card p-5 space-y-4">
          <div>
            <h3 className="font-display text-lg font-semibold">Comparativo Histórico por Ano</h3>
            <p className="text-xs text-muted-foreground">
              Total de entradas, gastos e balanço de cada ano disponível
            </p>
          </div>

          <div className="space-y-2.5">
            {multiYearComparison.map((item) => {
              const isSelected = item.year === year;
              return (
                <div
                  key={item.year}
                  className={`flex items-center justify-between rounded-xl border p-3 text-xs transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-xs"
                      : "border-border bg-secondary/20 hover:bg-secondary/40"
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-foreground">{item.year}</span>
                      {isSelected ? (
                        <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 h-4">
                          Ano selecionado
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                      <span>{`Entradas: ${brl(item.income)}`}</span>
                      <span>·</span>
                      <span>{`Gastos: ${brl(item.expenses)}`}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`numeric font-bold text-sm ${
                        item.balance >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {`${item.balance >= 0 ? "+" : ""}${brl(item.balance)}`}
                    </span>
                    {!isSelected ? (
                      <div className="mt-1">
                        <button
                          type="button"
                          className="text-[11px] text-primary hover:underline font-medium"
                          onClick={() => onSelectYear(item.year)}
                        >
                          Ver este ano →
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <footer className="flex items-center gap-2 text-xs text-muted-foreground pt-4 border-t border-border">
        <CircleDollarSign className="h-4 w-4 text-primary" />
        <span>{`Resumo consolidado do ano de ${year} com ${totals.totalIncome > 0 || totals.totalExpenses > 0 ? "dados carregados" : "nenhum dado ainda"}.`}</span>
      </footer>
    </div>
  );
}
