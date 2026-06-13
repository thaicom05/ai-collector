import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { createAuction } from "@/lib/auctions.functions";
import { toast } from "sonner";
import { Gavel, Plus, Timer, Trash2, Pencil, Package } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-admin";

type Auction = {
  id: string; seller_id: string; title: string; description: string | null; category: string | null;
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
  const isAdmin = useIsAdmin();
  const [items, setItems] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [editing, setEditing] = useState<Auction | null>(null);
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

  const del = async (id: string) => {
    if (!confirm("ลบการประมูลนี้?")) return;
    const { error } = await supabase.from("auctions").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("ลบแล้ว"); load(); }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <main className="container mx-auto px-4 py-12">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-accent mb-2">ห้องประมูล</div>
            <h1 className="font-display text-4xl font-bold gold-text">ประมูลของสะสม</h1>
            <p className="text-muted-foreground mt-2">วางบิดแข่งขัน รายการอัปเดตเรียลไทม์ พร้อมประวัติราคาทุกครั้ง</p>
            {isAdmin && <Badge className="mt-2 bg-accent text-accent-foreground">โหมดผู้ดูแล</Badge>}
          </div>
          {user && <NewAuctionDialog onCreated={load} userId={user.id} />}
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
              const canManage = isAdmin || a.seller_id === user?.id;
              return (
                <div key={a.id} className="relative group">
                  <Link to="/auctions/$auctionId" params={{ auctionId: a.id }}>
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
                  {canManage && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="secondary" className="h-8 w-8" onClick={(e) => { e.preventDefault(); setEditing(a); }}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="destructive" className="h-8 w-8" onClick={(e) => { e.preventDefault(); del(a.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      {editing && <EditAuctionDialog auction={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      <SiteFooter />
    </div>
  );
}

type CollectionItem = { id: string; name: string; category: string | null; image_url: string | null; estimated_value: number | null };

function NewAuctionDialog({ onCreated, userId }: { onCreated: () => void; userId: string }) {
  const create = useServerFn(createAuction);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", category: "", image_url: "",
    starting_price: 1000, bid_increment: 100, duration_hours: 72,
  });
  const [sourceCollectionImg, setSourceCollectionImg] = useState<string | null>(null);

  const { data: collection } = useQuery({
    queryKey: ["my-collection-for-auction", userId, open],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("collection_items")
        .select("id, name, category, image_url, estimated_value")
        .order("created_at", { ascending: false });
      return (data ?? []) as CollectionItem[];
    },
  });

  const pickFromCollection = (id: string) => {
    const it = collection?.find(c => c.id === id);
    if (!it) return;
    setForm(f => ({
      ...f,
      title: it.name,
      category: it.category ?? "",
      starting_price: it.estimated_value ? Number(it.estimated_value) : f.starting_price,
      image_url: it.image_url?.startsWith("http") ? it.image_url : "",
    }));
    setSourceCollectionImg(it.image_url && !it.image_url.startsWith("http") ? it.image_url : null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true);
    try {
      let image_url = form.image_url || null;
      if (!image_url && sourceCollectionImg) {
        // sign for 1h; that URL is what we store
        const { data: signed } = await supabase.storage.from("scans").createSignedUrl(sourceCollectionImg, 60 * 60 * 24 * 7);
        if (signed?.signedUrl) image_url = signed.signedUrl;
      }
      await create({ data: {
        title: form.title, description: form.description || null, category: form.category || null,
        image_url,
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display gold-text">เปิดประมูลใหม่</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {collection && collection.length > 0 && (
            <div className="rounded-lg border border-dashed border-accent/40 p-3 bg-accent/5">
              <Label className="flex items-center gap-2 mb-2"><Package className="w-4 h-4" /> เลือกจากคอลเลกชัน</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                onChange={e => e.target.value && pickFromCollection(e.target.value)}
                defaultValue=""
              >
                <option value="">— เลือกของสะสม —</option>
                {collection.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.category ? ` · ${c.category}` : ""}</option>
                ))}
              </select>
            </div>
          )}
          <Input required placeholder="ชื่อรายการ" value={form.title} onChange={e => setForm({...form, title: e.target.value})} maxLength={120} />
          <Input placeholder="หมวด (เช่น พระเครื่อง, เหรียญ)" value={form.category} onChange={e => setForm({...form, category: e.target.value})} maxLength={40} />
          <Input placeholder="URL รูปภาพ (ถ้ามี)" value={form.image_url} onChange={e => { setForm({...form, image_url: e.target.value}); setSourceCollectionImg(null); }} maxLength={2048} disabled={!!sourceCollectionImg} />
          {sourceCollectionImg && <p className="text-xs text-muted-foreground">ใช้รูปจากคอลเลกชัน</p>}
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

function EditAuctionDialog({ auction, onClose, onSaved }: { auction: Auction; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: auction.title, category: auction.category ?? "",
    description: auction.description ?? "", image_url: auction.image_url ?? "",
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("auctions").update({
      title: form.title, category: form.category || null,
      description: form.description || null, image_url: form.image_url || null,
    }).eq("id", auction.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("บันทึกแล้ว"); onSaved(); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>แก้ไขการประมูล</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>ชื่อรายการ</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>หมวด</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
          <div><Label>URL รูปภาพ</Label><Input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} /></div>
          <div><Label>รายละเอียด</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          <p className="text-xs text-muted-foreground">หมายเหตุ: ราคาบิด สถานะ และผู้ชนะถูกควบคุมโดยระบบ ไม่สามารถแก้ไขโดยตรงได้</p>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving} className="bg-primary">{saving ? "กำลังบันทึก…" : "บันทึก"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
