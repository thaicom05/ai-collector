import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "ข้อความ — AI Collector" }] }),
  component: InboxPage,
});

function InboxPage() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel("inbox-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
  const { data } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, buyer_id, seller_id, last_message_at, listing:listings(title, image_url, price)")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen">
      <SiteNav />
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="text-xs uppercase tracking-[0.3em] text-accent">Inbox</div>
        <h1 className="mt-2 font-display text-4xl font-bold">ข้อความ</h1>
        <div className="mt-8 space-y-2">
          {(!data || data.length === 0) ? (
            <Card className="p-12 text-center">
              <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">ยังไม่มีบทสนทนา</p>
            </Card>
          ) : data.map(c => (
            <Link key={c.id} to="/messages/$conversationId" params={{ conversationId: c.id }}>
              <Card className="p-4 flex items-center gap-4 hover:bg-accent/5 transition-colors">
                {c.listing?.image_url && (
                  <img src={imgUrl(c.listing.image_url)} alt={c.listing.title ?? ""} className="w-14 h-14 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.listing?.title ?? "ประกาศถูกลบ"}</div>
                  <div className="text-xs text-muted-foreground">{new Date(c.last_message_at).toLocaleString("th-TH")}</div>
                </div>
                {c.listing?.price != null && (
                  <div className="font-display gold-text">฿{Number(c.listing.price).toLocaleString()}</div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function imgUrl(path: string) {
  if (path.startsWith("http")) return path;
  return supabase.storage.from("listings").getPublicUrl(path).data.publicUrl;
}
