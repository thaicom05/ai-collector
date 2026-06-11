import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, ShoppingCart, Zap, Package } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/cart")({
  head: () => ({ meta: [{ title: "ตะกร้าและคำสั่งซื้อ — AI Collector" }] }),
  component: CartPage,
});

function publicUrl(path: string | null): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return supabase.storage.from("listings").getPublicUrl(path).data.publicUrl;
}

function CartPage() {
  const router = useRouter();
  const cart = useQuery({
    queryKey: ["cart"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select("id, listing_id, listing:listings(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const orders = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, listing:listings(title, image_url, category)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const removeItem = async (id: string) => {
    const { error } = await supabase.from("cart_items").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("ลบออกจากตะกร้า"); cart.refetch(); }
  };

  const buy = async (item: { id: string; listing: { id: string; seller_id: string; price: number } | null }) => {
    if (!item.listing) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { router.navigate({ to: "/auth" }); return; }
    const { error } = await supabase.from("orders").insert({
      listing_id: item.listing.id, buyer_id: u.user.id,
      seller_id: item.listing.seller_id, price: item.listing.price, quantity: 1,
    });
    if (error) toast.error(error.message);
    else { toast.success("สั่งซื้อสำเร็จ"); cart.refetch(); orders.refetch(); }
  };

  const items = cart.data ?? [];
  const total = items.reduce((s, i) => s + Number(i.listing?.price ?? 0), 0);

  return (
    <div className="min-h-screen">
      <SiteNav />
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="text-xs uppercase tracking-[0.3em] text-accent">Cart</div>
        <h1 className="mt-2 font-display text-4xl font-bold">ตะกร้าของฉัน</h1>

        <div className="mt-8 space-y-3">
          {items.length === 0 ? (
            <Card className="p-12 text-center">
              <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">ตะกร้าว่าง</p>
              <Link to="/marketplace"><Button variant="outline" className="mt-4">ไปดูตลาด</Button></Link>
            </Card>
          ) : items.map(item => (
            <Card key={item.id} className="p-4 flex items-center gap-4">
              {item.listing?.image_url && (
                <img src={publicUrl(item.listing.image_url)} alt={item.listing.title}
                  className="w-20 h-20 rounded-lg object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-display text-lg font-bold truncate">{item.listing?.title ?? "—"}</div>
                <div className="font-display gold-text">฿{Number(item.listing?.price ?? 0).toLocaleString()}</div>
              </div>
              <Button size="sm" className="bg-primary" onClick={() => buy(item as never)}>
                <Zap className="w-3.5 h-3.5 mr-1" /> ซื้อ
              </Button>
              <Button size="sm" variant="ghost" onClick={() => removeItem(item.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </Card>
          ))}
          {items.length > 0 && (
            <div className="flex justify-end pt-2">
              <div className="text-right">
                <div className="text-xs text-muted-foreground uppercase tracking-wider">รวมทั้งหมด</div>
                <div className="font-display text-2xl font-bold gold-text">฿{total.toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>

        <h2 className="mt-12 font-display text-2xl font-bold flex items-center gap-2">
          <Package className="w-5 h-5" /> คำสั่งซื้อของฉัน
        </h2>
        <div className="mt-4 space-y-3">
          {(orders.data ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">ยังไม่มีคำสั่งซื้อ</p>
          ) : (orders.data ?? []).map(o => (
            <Card key={o.id} className="p-4 flex items-center gap-4">
              {o.listing?.image_url && (
                <img src={publicUrl(o.listing.image_url)} alt={o.listing.title ?? ""}
                  className="w-16 h-16 rounded-lg object-cover" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{o.listing?.title ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("th-TH")}</div>
              </div>
              <div className="text-right">
                <div className="font-display gold-text">฿{Number(o.price).toLocaleString()}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{o.status}</div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
