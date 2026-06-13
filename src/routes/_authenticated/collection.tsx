import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Coins, Tag, ScanLine } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/collection")({
  head: () => ({ meta: [{ title: "คอลเลกชันของฉัน — AI Collector" }] }),
  component: CollectionPage,
});

function CollectionPage() {
  const { data: items, refetch } = useQuery({
    queryKey: ["collection"],
    queryFn: async () => {
      const { data, error } = await supabase.from("collection_items").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalValue = items?.reduce((s, i) => s + (Number(i.estimated_value) || 0), 0) ?? 0;

  const del = async (id: string) => {
    const { error } = await supabase.from("collection_items").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("ลบแล้ว"); refetch(); }
  };

  const listOnMarket = async (item: { name: string; category: string | null; image_url: string | null; estimated_value: number | null }) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase.from("listings").insert({
      seller_id: userData.user.id,
      title: item.name,
      category: item.category,
      price: item.estimated_value ?? 0,
      image_url: item.image_url,
      description: `ลงขายจากคอลเลกชัน — ${item.name}`,
    });
    if (error) toast.error(error.message);
    else toast.success("ลงขายในตลาดแล้ว");
  };

  return (
    <div className="min-h-screen">
      <SiteNav />
      <div className="container mx-auto px-4 py-10">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-accent">คอลเลกชันของฉัน</div>
            <h1 className="mt-2 font-display text-4xl font-bold">ของสะสมทั้งหมด</h1>
          </div>
          <div className="rounded-2xl p-5 min-w-[220px]" style={{ background: "var(--gradient-gold)" }}>
            <div className="text-xs uppercase tracking-wider text-primary/80">มูลค่ารวมประมาณ</div>
            <div className="font-display text-3xl font-bold text-primary mt-1">฿{totalValue.toLocaleString()}</div>
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          <Link to="/scan"><Button className="bg-primary"><ScanLine className="w-4 h-4 mr-2" /> สแกนเพิ่ม</Button></Link>
          <ManualAddDialog onAdded={refetch} />
        </div>

        {(!items || items.length === 0) ? (
          <Card className="p-12 text-center">
            <Coins className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">ยังไม่มีของสะสม เริ่มสแกนเลย</p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map(item => (
              <Card key={item.id} className="overflow-hidden p-0">
                {item.image_url && <ItemImage path={item.image_url} alt={item.name} />}
                <div className="p-5">
                  {item.category && <div className="text-xs text-accent font-medium uppercase tracking-wider">{item.category}</div>}
                  <h3 className="font-display text-xl font-bold mt-1">{item.name}</h3>
                  {(item.edition || item.year) && <p className="text-sm text-muted-foreground">{item.edition} {item.year && `· ${item.year}`}</p>}
                  {item.estimated_value && <p className="mt-2 font-display text-lg gold-text">฿{Number(item.estimated_value).toLocaleString()}</p>}
                  <div className="mt-4 flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => listOnMarket(item)}><Tag className="w-3.5 h-3.5 mr-1" />ลงขาย</Button>
                    <Button size="sm" variant="ghost" onClick={() => del(item.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemImage({ path, alt }: { path: string; alt: string }) {
  const { data } = useQuery({
    queryKey: ["signed", path],
    queryFn: async () => {
      if (path.startsWith("http")) return path;
      const { data } = await supabase.storage.from("scans").createSignedUrl(path, 3600);
      return data?.signedUrl ?? "";
    },
  });
  return <img src={data ?? ""} alt={alt} className="w-full aspect-square object-cover" />;
}

function ManualAddDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", edition: "", year: "", notes: "", estimated_value: "", image_url: "" });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const reset = () => { setForm({ name: "", category: "", edition: "", year: "", notes: "", estimated_value: "", image_url: "" }); setFile(null); };
  const save = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user || !form.name) return;
    setSaving(true);
    let image_url: string | null = form.image_url.trim() || null;
    if (file) {
      const path = `${userData.user.id}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const { error: upErr } = await supabase.storage.from("scans").upload(path, file, { contentType: file.type });
      if (upErr) { toast.error(upErr.message); setSaving(false); return; }
      image_url = path;
    }
    const { error } = await supabase.from("collection_items").insert({
      user_id: userData.user.id,
      name: form.name, category: form.category || null, edition: form.edition || null, year: form.year || null,
      notes: form.notes || null, estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      image_url,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("เพิ่มแล้ว"); setOpen(false); reset(); onAdded(); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Plus className="w-4 h-4 mr-2" />เพิ่มเอง</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>เพิ่มของสะสม</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>ชื่อ *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>หมวด</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
            <div><Label>รุ่น</Label><Input value={form.edition} onChange={e => setForm({ ...form, edition: e.target.value })} /></div>
            <div><Label>ปี</Label><Input value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} /></div>
            <div><Label>มูลค่าประมาณ (฿)</Label><Input type="number" value={form.estimated_value} onChange={e => setForm({ ...form, estimated_value: e.target.value })} /></div>
          </div>
          <div>
            <Label>อัปโหลดรูปภาพ</Label>
            <Input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <Label>หรือใส่ URL รูปภาพ</Label>
            <Input
              value={form.image_url}
              onChange={e => setForm({ ...form, image_url: e.target.value })}
              placeholder="https://..."
              disabled={!!file}
            />
          </div>
          <div><Label>หมายเหตุ</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving} className="bg-primary">{saving ? "กำลังบันทึก…" : "บันทึก"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
