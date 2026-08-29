import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { brl, MONTH_NAMES, type MonthlyHistory, type Transaction } from "@/lib/finance";

type Props = {
  year: number;
  history: MonthlyHistory[];
  transactions: Transaction[];
};

export function YearOverview({ year, history, transactions }: Props) {
  const data = MONTH_NAMES.map((name, index) => {
    const base = history.find((h) => h.month === index + 1);
    const live = transactions.filter(
      (t) => Number(t.occurred_on.slice(5, 7)) === index + 1,
    );
    const expenses =
      (base?.expenses ?? 0) +
      live.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);
    const income =
      (base?.income ?? 0) +
      live.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
    return { name: name.slice(0, 3), Gastos: expenses, Entradas: income };
  });

  return (
    <div className="surface-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold">Panorama anual</h2>
        <span className="text-sm text-muted-foreground">{year}</span>
      </div>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
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
            <Bar dataKey="Entradas" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="Gastos" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
