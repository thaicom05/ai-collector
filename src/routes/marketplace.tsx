import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Store, Trash2 } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "ตลาดของสะสม — AI Collector" },
      { name: "description", content: "ซื้อ-ขายพระเครื่อง เหรียญสะสม ธนบัตรเก่า ในตลาดของนักสะสมไทย" },
    ],
  }),
  component: Marketplace,
});

function Marketplace() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  const { data: listings, refetch } = useQuery({
    queryKey: ["listings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").eq("status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const del = async (id: string) => {
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("ลบประกาศแล้ว"); refetch(); }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <div className="container mx-auto px-4 py-10 flex-1">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-accent">Marketplace</div>
            <h1 className="mt-2 font-display text-4xl font-bold">ตลาดของสะสม</h1>
            <p className="mt-1 text-muted-foreground">ซื้อ-ขายของสะสมจากนักสะสมทั่วประเทศ</p>
          </div>
          {userId ? <NewListingDialog onAdded={refetch} /> : <Link to="/auth"><Button className="bg-primary">เข้าสู่ระบบเพื่อลงขาย</Button></Link>}
        </div>

        {(!listings || listings.length === 0) ? (
          <Card className="p-12 text-center">
            <Store className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">ยังไม่มีประกาศ — เริ่มลงขายเป็นคนแรก</p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {listings.map(l => (
              <Card key={l.id} className="overflow-hidden p-0 hover:shadow-[var(--shadow-elegant)] transition-shadow">
                {l.image_url && <ListingImage path={l.image_url} alt={l.title} />}
                <div className="p-5">
                  {l.category && <Badge variant="secondary" className="mb-2">{l.category}</Badge>}
                  <h3 className="font-display text-lg font-bold line-clamp-1">{l.title}</h3>
                  {l.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{l.description}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="font-display text-xl font-bold gold-text">฿{Number(l.price).toLocaleString()}</div>
                    {l.seller_id === userId && (
                      <Button size="sm" variant="ghost" onClick={() => del(l.id)}><Trash2 className="w-4 h-4" /></Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}

function ListingImage({ path, alt }: { path: string; alt: string }) {
  const { data } = useQuery({
    queryKey: ["signed-list", path],
    queryFn: async () => {
      if (path.startsWith("http")) return path;
      const { data } = await supabase.storage.from("scans").createSignedUrl(path, 3600);
      return data?.signedUrl ?? "";
    },
  });
  return <img src={data ?? ""} alt={alt} className="w-full aspect-square object-cover" />;
}

function NewListingDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", category: "", price: "", description: "" });
  const [file, setFile] = useState<File | null>(null);
  const save = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user || !form.title || !form.price) return;
    let image_url: string | null = null;
    if (file) {
      const path = `${userData.user.id}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const { error: upErr } = await supabase.storage.from("scans").upload(path, file);
      if (!upErr) image_url = path;
    }
    const { error } = await supabase.from("listings").insert({
      seller_id: userData.user.id, title: form.title, category: form.category || null,
      price: Number(form.price), description: form.description || null, image_url,
    });
    if (error) toast.error(error.message);
    else { toast.success("ลงขายแล้ว"); setOpen(false); setForm({ title: "", category: "", price: "", description: "" }); setFile(null); onAdded(); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="bg-primary"><Plus className="w-4 h-4 mr-2" />ลงขาย</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>ลงประกาศขาย</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>ชื่อสินค้า *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>หมวด</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="เช่น พระเครื่อง" /></div>
            <div><Label>ราคา (฿) *</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
          </div>
          <div><Label>รายละเอียด</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>รูปภาพ</Label><Input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} /></div>
        </div>
        <DialogFooter><Button onClick={save} className="bg-primary">ลงขาย</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
