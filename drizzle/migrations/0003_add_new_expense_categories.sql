INSERT INTO public.categories (name, kind, color, icon) VALUES
  ('Dízimo', 'expense', '#10b981', 'hand-heart'),
  ('Telefone', 'expense', '#06b6d4', 'phone'),
  ('Milhas', 'expense', '#f59e0b', 'plane'),
  ('Contas', 'expense', '#ef4444', 'receipt')
ON CONFLICT (name) DO NOTHING;
