import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { brl, type Category, type Transaction } from "@/lib/finance";

type Props = {
  transactions: Transaction[];
  categories: Category[];
};

export function CategoryBreakdown({ transactions, categories }: Props) {
  const expenses = transactions.filter((t) => t.kind === "expense");
  const totals = new Map<string, number>();
  for (const t of expenses) {
    const key = t.category_id ?? "none";
    totals.set(key, (totals.get(key) ?? 0) + t.amount);
  }

  const data = [...totals.entries()]
    .map(([key, value]) => {
      const cat = categories.find((c) => c.id === key);
      return { name: cat?.name ?? "Sem categoria", value, color: cat?.color ?? "#64748b" };
    })
    .sort((a, b) => b.value - a.value);

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="surface-card p-5">
      <h2 className="font-display text-lg font-semibold">Gastos por categoria</h2>
      <p className="text-xs text-muted-foreground">Somando pix, dinheiro e cartão</p>

      {data.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          <p>Sem despesas neste mês ainda.</p>
        </div>
      ) : (
        <div key="category-data" className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="none"
                >
                  {data.map((d, i) => (
                    <Cell key={`cell-${d.name}-${i}`} fill={d.color} />
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

          <div className="space-y-2">
            {data.map((d, i) => (
              <div key={`cat-row-${d.name}-${i}`} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    <span>{d.name}</span>
                  </span>
                  <span className="numeric text-muted-foreground">{brl(d.value)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${total > 0 ? (d.value / total) * 100 : 0}%`,
                      backgroundColor: d.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
