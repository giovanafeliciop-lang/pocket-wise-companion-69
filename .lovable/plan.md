# Corrigir coluna de gastos no gráfico "Panorama anual"

## Causa confirmada

Em `src/components/finance/YearOverview.tsx` (linhas 33–39), a lógica por mês é:

```text
Se o mês tem QUALQUER lançamento no app:
   Gastos = soma apenas dos lançamentos do app
   Entradas = soma apenas dos lançamentos do app
Senão:
   Gastos/Entradas = totais importados da planilha (monthly_history)
```

Ou seja: nos meses que têm dados da planilha **e** pelo menos um lançamento manual, o gráfico descarta o valor da planilha e mostra só os lançamentos novos — por isso algumas colunas aparecem erradas (baixas demais). Confirmei que o histórico importado (`monthly_history`) nunca é alterado ao adicionar lançamentos, então somar os dois não gera contagem dupla.

## Mudança

Em `YearOverview.tsx`, calcular por mês:

- `Gastos = gastos da planilha (se houver) + gastos dos lançamentos do app`
- `Entradas = entradas da planilha (se houver) + entradas dos lançamentos do app`

Sem mudanças em banco de dados, layout ou outros componentes.

## Verificação

- Conferir no painel que meses com dados mistos (planilha + app) passam a mostrar a soma correta e meses só com planilha ou só com app permanecem iguais.
