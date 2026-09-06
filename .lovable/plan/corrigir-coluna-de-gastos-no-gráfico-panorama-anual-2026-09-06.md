# Corrigir coluna de gastos no gráfico "Panorama anual"

## Causa confirmada

Em `src/components/finance/YearOverview.tsx` (linhas 33–39), a lógica por mês alterna entre:

- Se o mês tem lançamentos no app → usa só os lançamentos do app.
- Se não tem → usa os totais importados da planilha (`monthly_history`).

Como o usuário quer que o gráfico mostre **apenas os lançamentos feitos no app**, a coluna fica errada nos meses em que ainda há fallback para os dados importados.

## Mudança

Em `src/components/finance/YearOverview.tsx`:

- Ignorar completamente `monthly_history` no cálculo do gráfico.
- `Gastos` = soma das despesas lançadas no app para aquele mês.
- `Entradas` = soma das receitas lançadas no app para aquele mês.
- Meses sem lançamentos aparecerão com valor zero (sem fallback da planilha).

Sem mudanças em banco de dados, layout ou outros componentes.

## Verificação

- Conferir no painel que o gráfico reflete apenas os lançamentos do app para o ano selecionado.

