ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.monthly_history ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS monthly_history_user_id_idx ON public.monthly_history(user_id);

DROP POLICY IF EXISTS transactions_public_all ON public.transactions;
DROP POLICY IF EXISTS monthly_history_public_all ON public.monthly_history;
DROP POLICY IF EXISTS categories_public_all ON public.categories;

REVOKE ALL ON public.transactions FROM anon;
REVOKE ALL ON public.monthly_history FROM anon;
REVOKE ALL ON public.categories FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.transactions TO service_role;
GRANT ALL ON public.monthly_history TO service_role;
GRANT ALL ON public.categories TO service_role;

CREATE POLICY transactions_own ON public.transactions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY monthly_history_own ON public.monthly_history FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY categories_read ON public.categories FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY categories_insert_own ON public.categories FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY categories_update_own ON public.categories FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY categories_delete_own ON public.categories FOR DELETE TO authenticated
  USING (user_id = auth.uid());