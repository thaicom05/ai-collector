
CREATE POLICY "Anyone authed reads listing images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'listings');
CREATE POLICY "Anon reads listing images" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'listings');
CREATE POLICY "Users upload own listing images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listings' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own listing images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'listings' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cart" ON public.cart_items FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price numeric(12,2) NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer or seller view orders" ON public.orders FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Buyer creates order" ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Seller updates order status" ON public.orders FOR UPDATE
  USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);

CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_and_apply_order()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.listings%ROWTYPE;
BEGIN
  SELECT * INTO l FROM public.listings WHERE id = NEW.listing_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบประกาศ'; END IF;
  IF l.status <> 'active' THEN RAISE EXCEPTION 'ประกาศนี้ขายไปแล้ว'; END IF;
  IF NEW.buyer_id = l.seller_id THEN RAISE EXCEPTION 'ผู้ขายซื้อของตัวเองไม่ได้'; END IF;
  NEW.seller_id := l.seller_id;
  NEW.price := l.price;
  UPDATE public.listings SET status = 'sold', updated_at = now() WHERE id = l.id;
  DELETE FROM public.cart_items WHERE listing_id = l.id;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_orders_validate BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_and_apply_order();
