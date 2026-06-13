import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Store, Trash2, ShoppingCart, Zap, MessageCircle, Pencil, Package } from "lucide-react";
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
import { useIsAdmin } from "@/hooks/use-admin";

export const Route = createFileRoute("/marketplace")({
  head: () => ({
    meta: [
      { title: "ตลาดของสะสม — AI Collector" },
      { name: "description", content: "ซื้อ-ขายพระเครื่อง เหรียญสะสม ธนบัตรเก่า ในตลาดของนักสะสมไทย" },
    ],
  }),
  component: Marketplace,
});

type Listing = {
  id: string; seller_id: string; title: string; description: string | null;
  category: string | null; price: number; image_url: string | null; _img: string;
};

function Marketplace() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [userId, setUserId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Listing | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)); }, []);

  const { data: listings, refetch } = useQuery({
    queryKey: ["listings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").eq("status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      const paths = (data ?? []).map(l => l.image_url).filter((p): p is string => !!p && !p.startsWith("http"));
      const urlMap = new Map<string, string>();
      if (paths.length) {
        const { data: signed } = await supabase.storage.from("listings").createSignedUrls(paths, 60 * 60);
        signed?.forEach((s, i) => { if (s.signedUrl) urlMap.set(paths[i], s.signedUrl); });
      }
      return (data ?? []).map(l => ({
        ...l,
        _img: l.image_url ? (l.image_url.startsWith("http") ? l.image_url : urlMap.get(l.image_url) ?? "") : "",
      })) as Listing[];
    },
  });

  const del = async (id: string) => {
    if (!confirm("ลบประกาศนี้?")) return;
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("ลบประกาศแล้ว"); refetch(); }
  };

  const addToCart = async (listingId: string) => {
    if (!userId) { router.navigate({ to: "/auth" }); return; }
    const { error } = await supabase.from("cart_items").upsert(
      { user_id: userId, listing_id: listingId, quantity: 1 },
      { onConflict: "user_id,listing_id" },
    );
    if (error) toast.error(error.message);
    else toast.success("เพิ่มในตะกร้าแล้ว");
  };

  const buyNow = async (l: { id: string; seller_id: string; price: number }) => {
    if (!userId) { router.navigate({ to: "/auth" }); return; }
    if (userId === l.seller_id) { toast.error("ซื้อของตัวเองไม่ได้"); return; }
    const { error } = await supabase.from("orders").insert({
      listing_id: l.id, buyer_id: userId, seller_id: l.seller_id, price: l.price, quantity: 1,
    });
    if (error) toast.error(error.message);
    else { toast.success("สั่งซื้อสำเร็จ — ติดต่อผู้ขายเพื่อชำระเงิน"); refetch(); }
  };

  const chatSeller = async (l: { id: string; seller_id: string }) => {
    if (!userId) { router.navigate({ to: "/auth" }); return; }
    if (userId === l.seller_id) { toast.error("ไม่สามารถแชทกับตัวเองได้"); return; }
    const { data: existing } = await supabase
      .from("conversations").select("id")
      .eq("listing_id", l.id).eq("buyer_id", userId).maybeSingle();
    let convId = existing?.id;
    if (!convId) {
      const { data, error } = await supabase.from("conversations")
        .insert({ listing_id: l.id, buyer_id: userId, seller_id: l.seller_id })
        .select("id").single();
      if (error) { toast.error(error.message); return; }
      convId = data.id;
    }
    router.navigate({ to: "/messages/$conversationId", params: { conversationId: convId } });
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
            {isAdmin && <Badge className="mt-2 bg-accent text-accent-foreground">โหมดผู้ดูแล</Badge>}
          </div>
          <div className="flex gap-2">
            <Link to="/cart"><Button variant="outline"><ShoppingCart className="w-4 h-4 mr-2" />ตะกร้า</Button></Link>
            {userId ? <NewListingDialog onAdded={refetch} userId={userId} /> : <Link to="/auth"><Button className="bg-primary">เข้าสู่ระบบเพื่อลงขาย</Button></Link>}
          </div>
        </div>

        {(!listings || listings.length === 0) ? (
          <Card className="p-12 text-center">
            <Store className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">ยังไม่มีประกาศ — เริ่มลงขายเป็นคนแรก</p>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {listings.map(l => {
              const own = l.seller_id === userId;
              const canManage = own || isAdmin;
              return (
                <Card key={l.id} className="overflow-hidden p-0 hover:shadow-[var(--shadow-elegant)] transition-shadow flex flex-col">
                  {l._img && (
                    <img src={l._img} alt={l.title} className="w-full aspect-square object-cover" loading="lazy" />
                  )}
                  <div className="p-5 flex-1 flex flex-col">
                    {l.category && <Badge variant="secondary" className="mb-2 w-fit">{l.category}</Badge>}
                    <h3 className="font-display text-lg font-bold line-clamp-1">{l.title}</h3>
                    {l.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{l.description}</p>}
                    <div className="mt-3 font-display text-xl font-bold gold-text">฿{Number(l.price).toLocaleString()}</div>
                    <div className="mt-4 flex gap-2">
                      {canManage ? (
                        <>
                          {!own && isAdmin && <Badge variant="outline" className="text-[10px]">Admin</Badge>}
                          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setEditing(l)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => del(l.id)}><Trash2 className="w-4 h-4" /></Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => addToCart(l.id)}>
                            <ShoppingCart className="w-3.5 h-3.5 mr-1" /> ตะกร้า
                          </Button>
                          <Button size="sm" className="flex-1 bg-primary" onClick={() => buyNow(l)}>
                            <Zap className="w-3.5 h-3.5 mr-1" /> ซื้อเลย
                          </Button>
                        </>
                      )}
                    </div>
                    {!own && (
                      <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => chatSeller(l)}>
                        <MessageCircle className="w-3.5 h-3.5 mr-1" /> แชทผู้ขาย
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      {editing && <EditListingDialog listing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refetch(); }} />}
      <SiteFooter />
    </div>
  );
}

type CollectionItem = { id: string; name: string; category: string | null; image_url: string | null; estimated_value: number | null };

function NewListingDialog({ onAdded, userId }: { onAdded: () => void; userId: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", category: "", price: "", description: "", image_url: "" });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [sourceCollectionImg, setSourceCollectionImg] = useState<string | null>(null);

  const { data: collection } = useQuery({
    queryKey: ["my-collection-for-listing", userId, open],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("collection_items")
        .select("id, name, category, image_url, estimated_value")
        .order("created_at", { ascending: false });
      return (data ?? []) as CollectionItem[];
    },
  });

  const pickFromCollection = async (id: string) => {
    const it = collection?.find(c => c.id === id);
    if (!it) return;
    setForm(f => ({
      ...f,
      title: it.name,
      category: it.category ?? "",
      price: it.estimated_value != null ? String(it.estimated_value) : f.price,
    }));
    setFile(null);
    if (it.image_url) {
      if (it.image_url.startsWith("http")) {
        setForm(f => ({ ...f, image_url: it.image_url ?? "" }));
        setSourceCollectionImg(null);
      } else {
        // Copy from scans bucket → upload reference. We'll re-upload by fetching signed URL.
        setSourceCollectionImg(it.image_url);
        setForm(f => ({ ...f, image_url: "" }));
      }
    }
  };

  const save = async () => {
    if (!form.title || !form.price) return;
    setSaving(true);
    let image_url: string | null = form.image_url.trim() || null;
    if (file) {
      const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const { error: upErr } = await supabase.storage.from("listings").upload(path, file, { contentType: file.type });
      if (upErr) { toast.error(upErr.message); setSaving(false); return; }
      image_url = path;
    } else if (sourceCollectionImg) {
      // download from scans, upload to listings
      const { data: signed } = await supabase.storage.from("scans").createSignedUrl(sourceCollectionImg, 60);
      if (signed?.signedUrl) {
        const blob = await fetch(signed.signedUrl).then(r => r.blob());
        const ext = sourceCollectionImg.split(".").pop() || "jpg";
        const path = `${userId}/${Date.now()}-from-collection.${ext}`;
        const { error: upErr } = await supabase.storage.from("listings").upload(path, blob, { contentType: blob.type });
        if (!upErr) image_url = path;
      }
    }
    const { error } = await supabase.from("listings").insert({
      seller_id: userId, title: form.title, category: form.category || null,
      price: Number(form.price), description: form.description || null, image_url,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("ลงขายแล้ว");
      setOpen(false);
      setForm({ title: "", category: "", price: "", description: "", image_url: "" });
      setFile(null); setSourceCollectionImg(null);
      onAdded();
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="bg-primary"><Plus className="w-4 h-4 mr-2" />ลงขาย</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>ลงประกาศขาย</DialogTitle></DialogHeader>
        <div className="space-y-3">
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
          <div><Label>ชื่อสินค้า *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>หมวด</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="เช่น พระเครื่อง" /></div>
            <div><Label>ราคา (฿) *</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
          </div>
          <div><Label>รายละเอียด</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>อัปโหลดรูปภาพ</Label><Input type="file" accept="image/*" onChange={e => { setFile(e.target.files?.[0] ?? null); setSourceCollectionImg(null); }} /></div>
          <div><Label>หรือ URL รูปภาพ</Label>
            <Input value={form.image_url} disabled={!!file || !!sourceCollectionImg}
              onChange={e => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
          </div>
          {sourceCollectionImg && <p className="text-xs text-muted-foreground">ใช้รูปจากคอลเลกชัน</p>}
        </div>
        <DialogFooter><Button onClick={save} disabled={saving} className="bg-primary">{saving ? "กำลังบันทึก…" : "ลงขาย"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditListingDialog({ listing, onClose, onSaved }: { listing: Listing; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: listing.title, category: listing.category ?? "",
    price: String(listing.price), description: listing.description ?? "",
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("listings").update({
      title: form.title, category: form.category || null,
      price: Number(form.price), description: form.description || null,
    }).eq("id", listing.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("บันทึกแล้ว"); onSaved(); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>แก้ไขประกาศ</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>ชื่อสินค้า</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>หมวด</Label><Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
            <div><Label>ราคา (฿)</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
          </div>
          <div><Label>รายละเอียด</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving} className="bg-primary">{saving ? "กำลังบันทึก…" : "บันทึก"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
