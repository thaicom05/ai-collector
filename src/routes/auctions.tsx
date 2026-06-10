import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { createAuction } from "@/lib/auctions.functions";
import { toast } from "sonner";
import { Gavel, Plus, Timer } from "lucide-react";

type Auction = {
  id: string; title: string; description: string | null; category: string | null;
  image_url: string | null; current_price: number; starting_price: number;
  bid_increment: number; ends_at: string; bid_count: number; status: string;
};

export const Route = createFileRoute("/auctions")({
  head: () => ({ meta: [
    { title: "ประมูลของสะสม | AI Collector" },
    { name: "description", content: "ตลาดประมูลพระเครื่อง เหรียญสะสม ธนบัตรเก่า และของโบราณ พร้อมประวัติราคาประมูลแบบเรียลไทม์" },
  ]}),
  component: AuctionsPage,
});

function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "ปิดประมูล";
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d} วัน ${h % 24} ชม.`;
  if (h > 0) return `${h} ชม. ${m} นาที`;
  return `${m} นาที`;
}

function AuctionsPage() {
  const [items, setItems] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ? { id: data.user.id } : null));
    const t = setInterval(() => force(x => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("auctions").select("*").order("ends_at", { ascending: true });
    setItems((data ?? []) as Auction[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="container mx-auto px-4 py-12">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-accent mb-2">ห้องประมูล</div>
            <h1 className="font-display text-4xl font-bold gold-text">ประมูลของสะสม</h1>
            <p className="text-muted-foreground mt-2">วางบิดแข่งขัน รายการอัปเดตเรียลไทม์ พร้อมประวัติราคาทุกครั้ง</p>
          </div>
          {user && <NewAuctionDialog onCreated={load} />}
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">กำลังโหลด…</div>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center">
            <Gavel className="w-10 h-10 mx-auto mb-4 text-accent" />
            <p className="text-muted-foreground">ยังไม่มีรายการประมูล {user ? "เริ่มเปิดประมูลของคุณได้เลย" : "เข้าสู่ระบบเพื่อเปิดประมูล"}</p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map(a => {
              const ended = new Date(a.ends_at).getTime() <= Date.now() || a.status !== "active";
              return (
                <Link key={a.id} to="/auctions/$auctionId" params={{ auctionId: a.id }}>
                  <Card className="overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 gold-border h-full">
                    <div className="aspect-square bg-muted overflow-hidden">
                      {a.image_url ? <img src={a.image_url} alt={a.title} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full grid place-items-center text-muted-foreground"><Gavel className="w-12 h-12" /></div>}
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        {a.category && <Badge variant="secondary" className="text-[10px]">{a.category}</Badge>}
                        <span className={`text-xs flex items-center gap-1 ${ended ? "text-destructive" : "text-accent"}`}>
                          <Timer className="w-3 h-3" /> {timeLeft(a.ends_at)}
                        </span>
                      </div>
                      <div className="font-medium line-clamp-1">{a.title}</div>
                      <div className="flex items-baseline justify-between pt-1">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ราคาปัจจุบัน</div>
                          <div className="font-display text-xl gold-text">฿{a.current_price.toLocaleString()}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">{a.bid_count} บิด</div>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function NewAuctionDialog({ onCreated }: { onCreated: () => void }) {
  const create = useServerFn(createAuction);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", category: "", image_url: "",
    starting_price: 1000, bid_increment: 100, duration_hours: 72,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await create({ data: {
        title: form.title, description: form.description || null, category: form.category || null,
        image_url: form.image_url || null,
        starting_price: Number(form.starting_price), bid_increment: Number(form.bid_increment),
        duration_hours: Number(form.duration_hours),
      }});
      toast.success("เปิดประมูลเรียบร้อย");
      setOpen(false); onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "เปิดประมูลไม่สำเร็จ");
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="bg-primary"><Plus className="w-4 h-4 mr-1" /> เปิดประมูลใหม่</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-display gold-text">เปิดประมูลใหม่</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Input required placeholder="ชื่อรายการ" value={form.title} onChange={e => setForm({...form, title: e.target.value})} maxLength={120} />
          <Input placeholder="หมวด (เช่น พระเครื่อง, เหรียญ)" value={form.category} onChange={e => setForm({...form, category: e.target.value})} maxLength={40} />
          <Input placeholder="URL รูปภาพ (ถ้ามี)" value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} maxLength={2048} />
          <Textarea placeholder="รายละเอียด ประวัติ ความเป็นมา" value={form.description} onChange={e => setForm({...form, description: e.target.value})} maxLength={2000} rows={3} />
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-xs text-muted-foreground">ราคาเริ่ม (฿)</label>
              <Input type="number" min={0} required value={form.starting_price} onChange={e => setForm({...form, starting_price: Number(e.target.value)})} /></div>
            <div><label className="text-xs text-muted-foreground">ขั้นบิด (฿)</label>
              <Input type="number" min={1} required value={form.bid_increment} onChange={e => setForm({...form, bid_increment: Number(e.target.value)})} /></div>
            <div><label className="text-xs text-muted-foreground">ระยะ (ชม.)</label>
              <Input type="number" min={1} max={720} required value={form.duration_hours} onChange={e => setForm({...form, duration_hours: Number(e.target.value)})} /></div>
          </div>
          <Button type="submit" disabled={submitting} className="w-full bg-primary">{submitting ? "กำลังเปิด…" : "เปิดประมูล"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
