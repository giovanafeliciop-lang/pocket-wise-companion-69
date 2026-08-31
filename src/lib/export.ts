import * as XLSX from "xlsx";
import {
  MONTH_NAMES,
  PAYMENT_METHODS,
  formatDate,
  type Category,
  type MonthlyHistory,
  type Transaction,
} from "@/lib/finance";

const paymentLabel = (value: string) =>
  PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value;

export function exportYearToExcel(
  year: number,
  transactions: Transaction[],
  categories: Category[],
  history: MonthlyHistory[],
) {
  const catName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? "Sem categoria";

  const wb = XLSX.utils.book_new();

  // Aba 1: Lançamentos (ordenados por data)
  const sorted = [...transactions].sort((a, b) => a.occurred_on.localeCompare(b.occurred_on));
  const txRows = sorted.map((t) => ({
    Data: formatDate(t.occurred_on),
    Tipo: t.kind === "income" ? "Entrada" : "Despesa",
    Descrição: t.description,
    Categoria: catName(t.category_id),
    Pagamento: paymentLabel(t.payment_method),
    Cartão: t.card_name ?? "",
    "Valor (R$)": t.amount,
    Status: t.is_paid ? "Pago" : "Em aberto",
    Origem: t.source === "invoice" ? "Fatura" : "Manual",
  }));
  const wsTx = XLSX.utils.json_to_sheet(
    txRows.length
      ? txRows
      : [{ Data: "", Tipo: "", Descrição: "Nenhum lançamento neste ano", Categoria: "", Pagamento: "", Cartão: "", "Valor (R$)": "", Status: "", Origem: "" }],
  );
  wsTx["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 40 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsTx, "Lançamentos");

  // Aba 2: Gastos por categoria
  const byCat = new Map<string, { total: number; count: number }>();
  for (const t of transactions) {
    if (t.kind !== "expense") continue;
    const name = catName(t.category_id);
    const cur = byCat.get(name) ?? { total: 0, count: 0 };
    cur.total += t.amount;
    cur.count += 1;
    byCat.set(name, cur);
  }
  const totalExpenses = [...byCat.values()].reduce((s, c) => s + c.total, 0);
  const catRows = [...byCat.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, v]) => ({
      Categoria: name,
      Lançamentos: v.count,
      "Total (R$)": Number(v.total.toFixed(2)),
      "% dos gastos": totalExpenses > 0 ? Number(((v.total / totalExpenses) * 100).toFixed(1)) : 0,
    }));
  const wsCat = XLSX.utils.json_to_sheet(
    catRows.length
      ? catRows
      : [{ Categoria: "Sem despesas lançadas neste ano", Lançamentos: 0, "Total (R$)": 0, "% dos gastos": 0 }],
  );
  wsCat["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsCat, "Gastos por categoria");

  // Aba 3: Histórico mensal (dados importados da planilha original)
  const histRows = [...history]
    .sort((a, b) => a.month - b.month)
    .map((h) => {
      const monthTx = transactions.filter((t) => Number(t.occurred_on.slice(5, 7)) === h.month);
      const extraExp = monthTx.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);
      const extraInc = monthTx.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
      const expenses = h.expenses + extraExp;
      const income = h.income + extraInc;
      return {
        Mês: MONTH_NAMES[h.month - 1],
        "Entradas (R$)": Number(income.toFixed(2)),
        "Gastos (R$)": Number(expenses.toFixed(2)),
        "Saldo (R$)": Number((income - expenses).toFixed(2)),
        Origem: h.expenses || h.income ? "Planilha + lançamentos" : "Lançamentos",
      };
    });
  const wsHist = XLSX.utils.json_to_sheet(
    histRows.length
      ? histRows
      : [{ Mês: "", "Entradas (R$)": "", "Gastos (R$)": "", "Saldo (R$)": "", Origem: "Sem histórico" }],
  );
  wsHist["!cols"] = [{ wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsHist, "Histórico mensal");

  XLSX.writeFile(wb, `financas-${year}.xlsx`);
}
