CREATE OR REPLACE FUNCTION public.protect_auction_bid_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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