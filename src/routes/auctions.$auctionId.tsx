import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useServerFn } from "@tanstack/react-start";
import { placeBid } from "@/lib/auctions.functions";
import { toast } from "sonner";
import { Gavel, Timer, TrendingUp, ArrowLeft, Trophy } from "lucide-react";

type Auction = {
  id: string; seller_id: string; title: string; description: string | null; category: string | null;
  image_url: string | null; current_price: number; starting_price: number;
  bid_increment: number; ends_at: string; bid_count: number; status: string; winner_id: string | null;
};

type Bid = { id: string; bidder_id: string; amount: number; created_at: string };

export const Route = createFileRoute("/auctions/$auctionId")({
  component: AuctionDetail,
  errorComponent: ({ error }) => <div className="p-10 text-center text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-10 text-center text-muted-foreground">ไม่พบรายการประมูลนี้</div>,
});

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

function AuctionDetail() {
  const { auctionId } = Route.useParams();
  const bid = useServerFn(placeBid);
  const [auction, setAuction] = useState<Auction | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ? { id: data.user.id } : null));
    const t = setInterval(() => force(x => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    const [{ data: a }, { data: b }] = await Promise.all([
      supabase.from("auctions").select("*").eq("id", auctionId).maybeSingle(),
      supabase.from("bids").select("*").eq("auction_id", auctionId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (a) {
      setAuction(a as Auction);
      setAmount(((a as Auction).current_price) + ((a as Auction).bid_increment));
    }
    setBids((b ?? []) as Bid[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [auctionId]);

  // Realtime updates
  useEffect(() => {
    const ch = supabase.channel(`auction-${auctionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bids", filter: `auction_id=eq.${auctionId}` }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "auctions", filter: `id=eq.${auctionId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  if (loading) return <div className="min-h-screen bg-background"><SiteNav /><div className="container mx-auto px-4 py-20 text-center text-muted-foreground">กำลังโหลด…</div></div>;
  if (!auction) throw notFound();

  const ended = new Date(auction.ends_at).getTime() <= Date.now() || auction.status !== "active";
  const isOwn = user?.id === auction.seller_id;
  const minBid = auction.current_price + auction.bid_increment;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error("กรุณาเข้าสู่ระบบก่อน"); return; }
    setSubmitting(true);
    try {
      await bid({ data: { auction_id: auctionId, amount: Number(amount) } });
      toast.success("บิดเรียบร้อย!");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "บิดไม่สำเร็จ");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="container mx-auto px-4 py-10 max-w-6xl">
        <Link to="/auctions" className="inline-flex items-center text-sm text-muted-foreground hover:text-accent mb-6"><ArrowLeft className="w-4 h-4 mr-1" /> กลับไปห้องประมูล</Link>

        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3">
            <Card className="overflow-hidden gold-border">
              <div className="aspect-square bg-muted">
                {auction.image_url ? <img src={auction.image_url} alt={auction.title} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-muted-foreground"><Gavel className="w-20 h-20" /></div>}
              </div>
            </Card>
            {auction.description && (
              <Card className="mt-4 p-5">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">รายละเอียด</div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{auction.description}</p>
              </Card>
            )}
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div>
              {auction.category && <Badge variant="secondary" className="mb-2">{auction.category}</Badge>}
              <h1 className="font-display text-3xl font-bold">{auction.title}</h1>
            </div>

            <Card className="p-5 space-y-3" style={{ background: "var(--gradient-gold)", opacity: 0.95 }}>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-primary/80">ราคาปัจจุบัน</div>
                <div className="font-display text-4xl font-bold text-primary">฿{auction.current_price.toLocaleString()}</div>
              </div>
              <div className="flex items-center justify-between text-sm text-primary/90">
                <span className="flex items-center gap-1"><Timer className="w-4 h-4" /> {ended ? "ปิดประมูลแล้ว" : timeLeftFull(auction.ends_at)}</span>
                <span className="flex items-center gap-1"><TrendingUp className="w-4 h-4" /> {auction.bid_count} บิด</span>
              </div>
            </Card>

            {ended ? (
              <Card className="p-5 text-center">
                {auction.winner_id ? (
                  <><Trophy className="w-8 h-8 mx-auto text-accent mb-2" /><div className="font-medium">การประมูลสิ้นสุดแล้ว</div><div className="text-sm text-muted-foreground mt-1">ราคาปิด ฿{auction.current_price.toLocaleString()}</div></>
                ) : <div className="text-muted-foreground">ปิดประมูลโดยไม่มีผู้บิด</div>}
              </Card>
            ) : isOwn ? (
              <Card className="p-5 text-center text-muted-foreground text-sm">นี่คือรายการของคุณ — ไม่สามารถบิดเองได้</Card>
            ) : !user ? (
              <Card className="p-5 text-center"><Link to="/auth" className="text-accent font-medium">เข้าสู่ระบบเพื่อวางบิด</Link></Card>
            ) : (
              <Card className="p-5">
                <form onSubmit={submit} className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">บิดขั้นต่ำ ฿{minBid.toLocaleString()} (เพิ่มขั้นละ ฿{auction.bid_increment.toLocaleString()})</label>
                    <Input type="number" min={minBid} step={auction.bid_increment} value={amount} onChange={e => setAmount(Number(e.target.value))} required />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setAmount(minBid)}>+1 ขั้น</Button>
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setAmount(auction.current_price + auction.bid_increment * 5)}>+5 ขั้น</Button>
                  </div>
                  <Button type="submit" disabled={submitting} className="w-full bg-primary"><Gavel className="w-4 h-4 mr-1" /> {submitting ? "กำลังบิด…" : "วางบิด"}</Button>
                </form>
              </Card>
            )}

            <Card className="p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">ประวัติการบิด ({bids.length})</div>
              {bids.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">ยังไม่มีการบิด</div>
              ) : (
                <ul className="divide-y divide-border/50 max-h-80 overflow-y-auto">
                  {bids.map((b, i) => (
                    <li key={b.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium flex items-center gap-2">
                          {i === 0 && <Trophy className="w-3.5 h-3.5 text-accent" />}
                          ฿{b.amount.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">{fmtTime(b.created_at)}</div>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">{b.bidder_id.slice(0, 8)}…</div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function timeLeftFull(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "หมดเวลา";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`;
}
