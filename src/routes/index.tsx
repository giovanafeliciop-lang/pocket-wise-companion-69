import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/dashboard" : "/auth", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Meu Painel Financeiro — Controle de gastos e receitas" },
      {
        name: "description",
        content:
          "Painel privado de finanças pessoais: receitas, despesas, categorias automáticas, faturas do cartão por IA e contas a pagar.",
      },
      { property: "og:title", content: "Meu Painel Financeiro" },
      {
        property: "og:description",
        content: "Controle receitas, despesas, categorias e faturas do cartão em um painel moderno.",
      },
    ],
  }),
  component: () => null,
});
