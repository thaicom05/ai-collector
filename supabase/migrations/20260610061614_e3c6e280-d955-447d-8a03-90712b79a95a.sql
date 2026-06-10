
-- Auctions table
CREATE TABLE public.auctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text,
  image_url text,
  starting_price numeric NOT NULL CHECK (starting_price >= 0),
  current_price numeric NOT NULL CHECK (current_price >= 0),
  bid_increment numeric NOT NULL DEFAULT 100 CHECK (bid_increment > 0),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active',
  winner_id uuid,
  bid_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.auctions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auctions TO authenticated;
GRANT ALL ON public.auctions TO service_role;

ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auctions viewable by all" ON public.auctions FOR SELECT USING (true);
CREATE POLICY "Authenticated create auctions" ON public.auctions FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Sellers update own auctions" ON public.auctions FOR UPDATE TO authenticated USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Sellers delete own auctions" ON public.auctions FOR DELETE TO authenticated USING (auth.uid() = seller_id);

-- Bids table
CREATE TABLE public.bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  bidder_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX bids_auction_idx ON public.bids(auction_id, created_at DESC);

GRANT SELECT ON public.bids TO anon;
GRANT SELECT, INSERT ON public.bids TO authenticated;
GRANT ALL ON public.bids TO service_role;

ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bids viewable by all" ON public.bids FOR SELECT USING (true);
CREATE POLICY "Authenticated place bids" ON public.bids FOR INSERT TO authenticated WITH CHECK (auth.uid() = bidder_id);

-- Validate + apply bid via trigger
CREATE OR REPLACE FUNCTION public.validate_and_apply_bid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.auctions%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.auctions WHERE id = NEW.auction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบรายการประมูล'; END IF;
  IF a.status <> 'active' THEN RAISE EXCEPTION 'การประมูลปิดแล้ว'; END IF;
  IF a.ends_at <= now() THEN RAISE EXCEPTION 'การประมูลหมดเวลา'; END IF;
  IF NEW.bidder_id = a.seller_id THEN RAISE EXCEPTION 'ผู้ขายบิดในรายการของตนเองไม่ได้'; END IF;
  IF NEW.amount < a.current_price + a.bid_increment THEN
    RAISE EXCEPTION 'ราคาบิดต้องสูงกว่าราคาปัจจุบันอย่างน้อย % บาท', a.bid_increment;
  END IF;
  UPDATE public.auctions
    SET current_price = NEW.amount, bid_count = bid_count + 1, winner_id = NEW.bidder_id, updated_at = now()
    WHERE id = NEW.auction_id;
  RETURN NEW;
END; $$;

CREATE TRIGGER bids_validate_before_insert
BEFORE INSERT ON public.bids
FOR EACH ROW EXECUTE FUNCTION public.validate_and_apply_bid();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER auctions_updated_at BEFORE UPDATE ON public.auctions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
