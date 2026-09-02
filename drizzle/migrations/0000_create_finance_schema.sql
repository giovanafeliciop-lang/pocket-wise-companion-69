CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL DEFAULT 'expense',
  color TEXT NOT NULL DEFAULT '#888888',
  icon TEXT NOT NULL DEFAULT 'circle',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_all" ON public.categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'expense',
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL DEFAULT 'pix',
  is_paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX transactions_occurred_on_idx ON public.transactions (occurred_on DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO anon, authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_public_all" ON public.transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.monthly_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  month INT NOT NULL,
  expenses NUMERIC(12,2) NOT NULL DEFAULT 0,
  income NUMERIC(12,2) NOT NULL DEFAULT 0,
  UNIQUE (year, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_history TO anon, authenticated;
GRANT ALL ON public.monthly_history TO service_role;
ALTER TABLE public.monthly_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monthly_history_public_all" ON public.monthly_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.categories (name, kind, color, icon) VALUES
  ('Moradia','expense','#6366f1','home'),
  ('Alimentação','expense','#f59e0b','utensils'),
  ('Transporte','expense','#0ea5e9','car'),
  ('Saúde','expense','#ef4444','heart-pulse'),
  ('Educação','expense','#8b5cf6','graduation-cap'),
  ('Lazer','expense','#ec4899','party-popper'),
  ('Assinaturas','expense','#14b8a6','repeat'),
  ('Compras','expense','#f97316','shopping-bag'),
  ('Dízimo','expense','#10b981','hand-heart'),
  ('Telefone','expense','#06b6d4','phone'),
  ('Milhas','expense','#eab308','plane'),
  ('Contas','expense','#f43f5e','receipt'),
  ('Outros','expense','#64748b','circle-dashed'),
  ('Salário','income','#22c55e','wallet'),
  ('Freelance','income','#10b981','briefcase'),
  ('Outras entradas','income','#84cc16','plus-circle');

INSERT INTO public.monthly_history (year, month, expenses, income) VALUES
  (2026,1,23264.95,7296.74),
  (2026,2,5239.39,6643.36),
  (2026,3,10567.22,14238.87),
  (2026,4,9838.93,20321.47),
  (2026,5,6657.90,11528.05),
  (2026,6,6488.01,1168.39),
  (2026,7,6931.73,10302.29),
  (2026,8,7045.02,700.00),
  (2026,9,4678.29,700.00),
  (2026,10,4188.47,700.00),
  (2026,11,4188.47,700.00),
  (2026,12,3034.90,700.00);