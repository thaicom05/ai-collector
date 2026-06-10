import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const createAuction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).optional().nullable(),
    category: z.string().trim().max(40).optional().nullable(),
    image_url: z.string().trim().max(2048).optional().nullable(),
    starting_price: z.number().min(0).max(1_000_000_000),
    bid_increment: z.number().min(1).max(10_000_000),
    duration_hours: z.number().int().min(1).max(24 * 30),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const ends_at = new Date(Date.now() + data.duration_hours * 3600_000).toISOString();
    const { data: row, error } = await context.supabase.from("auctions").insert({
      seller_id: context.userId,
      title: data.title,
      description: data.description ?? null,
      category: data.category ?? null,
      image_url: data.image_url ?? null,
      starting_price: data.starting_price,
      current_price: data.starting_price,
      bid_increment: data.bid_increment,
      ends_at,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const placeBid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    auction_id: z.string().uuid(),
    amount: z.number().min(0).max(1_000_000_000),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("bids").insert({
      auction_id: data.auction_id,
      bidder_id: context.userId,
      amount: data.amount,
    }).select().single();
    if (error) throw new Error(error.message.replace(/^.*?:\s*/, ""));
    return row;
  });
