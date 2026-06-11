
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, buyer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view conversation" ON public.conversations FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "Buyer creates conversation" ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = buyer_id AND auth.uid() <> seller_id);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read messages" ON public.messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)));
CREATE POLICY "Participants send messages" ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND (auth.uid() = c.buyer_id OR auth.uid() = c.seller_id)));

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX idx_conversations_buyer ON public.conversations(buyer_id, last_message_at DESC);
CREATE INDEX idx_conversations_seller ON public.conversations(seller_id, last_message_at DESC);

-- Bump last_message_at when a message is inserted
CREATE OR REPLACE FUNCTION public.bump_conversation_last_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.bump_conversation_last_message() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_bump_conversation AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- Fix security finding: prevent sellers from manipulating auction bid fields
DROP POLICY IF EXISTS "Sellers update own auctions" ON public.auctions;
CREATE OR REPLACE FUNCTION public.protect_auction_bid_fields()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.seller_id THEN
    IF NEW.current_price IS DISTINCT FROM OLD.current_price
       OR NEW.bid_count    IS DISTINCT FROM OLD.bid_count
       OR NEW.winner_id    IS DISTINCT FROM OLD.winner_id
       OR NEW.status       IS DISTINCT FROM OLD.status
       OR NEW.seller_id    IS DISTINCT FROM OLD.seller_id THEN
      RAISE EXCEPTION 'ผู้ขายไม่มีสิทธิ์แก้ราคาบิด จำนวนบิด ผู้ชนะ หรือสถานะของการประมูล';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_protect_auction_bid_fields BEFORE UPDATE ON public.auctions
  FOR EACH ROW EXECUTE FUNCTION public.protect_auction_bid_fields();
CREATE POLICY "Sellers update own auctions" ON public.auctions FOR UPDATE
  USING (auth.uid() = seller_id) WITH CHECK (auth.uid() = seller_id);
