import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/messages/$conversationId")({
  head: () => ({ meta: [{ title: "บทสนทนา — AI Collector" }] }),
  component: ThreadPage,
});

type Msg = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string };

function ThreadPage() {
  const { conversationId } = Route.useParams();
  const [me, setMe] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); }, []);

  const conv = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, buyer_id, seller_id, listing:listings(id, title, image_url, price)")
        .eq("id", conversationId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // initial load
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) toast.error(error.message);
      else setMessages(data ?? []);
    })();
  }, [conversationId]);

  // realtime subscribe
  useEffect(() => {
    const ch = supabase
      .channel(`messages:${conversationId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages(prev => prev.some(m => m.id === (payload.new as Msg).id) ? prev : [...prev, payload.new as Msg]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { inputRef.current?.focus(); }, [conversationId]);

  const send = async () => {
    const body = text.trim();
    if (!body || !me) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId, sender_id: me, body,
    });
    setSending(false);
    if (error) toast.error(error.message);
    else { setText(""); inputRef.current?.focus(); }
  };

  const otherIsSeller = me === conv.data?.buyer_id;
  const otherLabel = otherIsSeller ? "ผู้ขาย" : "ผู้ซื้อ";

  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />
      <div className="container mx-auto px-4 py-6 max-w-3xl flex-1 flex flex-col">
        <Link to="/messages" className="text-sm text-muted-foreground inline-flex items-center gap-1 mb-3">
          <ArrowLeft className="w-4 h-4" /> ข้อความทั้งหมด
        </Link>

        {conv.data?.listing && (
          <Card className="p-3 flex items-center gap-3 mb-4">
            {conv.data.listing.image_url && (
              <img src={imgUrl(conv.data.listing.image_url)} alt={conv.data.listing.title}
                className="w-12 h-12 rounded-lg object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{conv.data.listing.title}</div>
              <div className="text-xs text-muted-foreground">คุยกับ{otherLabel}</div>
            </div>
            <div className="font-display gold-text">฿{Number(conv.data.listing.price).toLocaleString()}</div>
          </Card>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 py-2 min-h-[300px]">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">เริ่มต้นการสนทนา</p>
          ) : messages.map(m => {
            const mine = m.sender_id === me;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${
                  mine ? "bg-primary text-primary-foreground rounded-br-sm"
                       : "bg-muted text-foreground rounded-bl-sm"}`}>
                  {m.body}
                  <div className={`mt-1 text-[10px] opacity-70 ${mine ? "text-right" : ""}`}>
                    {new Date(m.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <div className="border-t border-border/60 pt-3 flex gap-2 items-end">
          <Textarea
            ref={inputRef}
            rows={2}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="พิมพ์ข้อความ… (Enter เพื่อส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
            className="resize-none"
            maxLength={4000}
          />
          <Button onClick={send} disabled={sending || !text.trim()} className="bg-primary">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function imgUrl(path: string) {
  if (path.startsWith("http")) return path;
  return supabase.storage.from("listings").getPublicUrl(path).data.publicUrl;
}
