-- Fix auctions update policy role scope
DROP POLICY IF EXISTS "Sellers update own auctions" ON public.auctions;
CREATE POLICY "Sellers update own auctions" ON public.auctions
  FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- Revoke EXECUTE on trigger-only SECURITY DEFINER functions from public/auth/anon
REVOKE ALL ON FUNCTION public.validate_and_apply_bid() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_and_apply_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_conversation_last_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;