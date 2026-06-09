import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Upload, Camera, Loader2, Sparkles, BookmarkPlus, TrendingUp, Award, Eye } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { analyzeImage } from "@/lib/scan.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "สแกนของสะสม — AI Collector" }] }),
  component: ScanPage,
});

type ScanResult = Awaited<ReturnType<typeof analyzeImage>>;

function ScanPage() {
  const analyze = useServerFn(analyzeImage);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const handleFile = async (file: File) => {
    setResult(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setLoading(true);
      try {
        // upload to storage
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        let imageUrl = "";
        if (userId) {
          const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
          const { error: upErr } = await supabase.storage.from("scans").upload(path, file);
          if (!upErr) imageUrl = path;
        }
        const r = await analyze({ data: { imageBase64: dataUrl, imageUrl } });
        setResult(r);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "วิเคราะห์ไม่สำเร็จ");
      } finally { setLoading(false); }
    };
    reader.readAsDataURL(file);
  };

  const saveToCollection = async () => {
    if (!result) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase.from("collection_items").insert({
      user_id: userData.user.id,
      scan_id: result.id,
      image_url: result.image_url,
      category: result.category,
      name: result.name ?? "ไม่ระบุชื่อ",
      edition: result.edition,
      year: result.year,
      estimated_value: result.market_price_max,
    });
    if (error) toast.error(error.message);
    else toast.success("เพิ่มเข้าคอลเลกชันแล้ว");
  };

  return (
    <div className="min-h-screen">
      <SiteNav />
      <div className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="text-center mb-8">
          <div className="text-xs uppercase tracking-[0.3em] text-accent">AI Vision</div>
          <h1 className="mt-2 font-display text-4xl font-bold">สแกนของสะสมของคุณ</h1>
          <p className="mt-2 text-muted-foreground">อัปโหลดรูปภาพ AI จะวิเคราะห์ให้ภายในไม่กี่วินาที</p>
        </div>

        {!preview && (
          <Card className="p-10 border-dashed border-2 gold-border">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full grid place-items-center" style={{ background: "var(--gradient-gold)" }}>
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <h3 className="mt-5 font-display text-2xl font-bold">เริ่มสแกน</h3>
              <p className="mt-2 text-sm text-muted-foreground">รองรับ JPG, PNG ขนาดไม่เกิน 10MB</p>
              <div className="mt-6 flex justify-center gap-3">
                <Button size="lg" onClick={() => fileRef.current?.click()} className="bg-primary">
                  <Upload className="w-4 h-4 mr-2" /> เลือกรูปภาพ
                </Button>
                <Button size="lg" variant="outline" onClick={() => { fileRef.current?.setAttribute("capture", "environment"); fileRef.current?.click(); }}>
                  <Camera className="w-4 h-4 mr-2" /> ถ่ายภาพ
                </Button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </div>
          </Card>
        )}

        {preview && (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <Card className="overflow-hidden p-0">
                <img src={preview} alt="preview" className="w-full aspect-square object-cover" />
              </Card>
              <Button variant="outline" className="w-full mt-3" onClick={() => { setPreview(null); setResult(null); }}>
                สแกนรูปใหม่
              </Button>
            </div>

            <div>
              {loading && (
                <Card className="p-8 text-center">
                  <Loader2 className="w-10 h-10 mx-auto animate-spin text-accent" />
                  <p className="mt-4 font-display text-lg">AI กำลังวิเคราะห์...</p>
                  <p className="text-sm text-muted-foreground mt-1">กำลังตรวจสอบลักษณะ ตัวอักษร และเปรียบเทียบฐานข้อมูล</p>
                </Card>
              )}

              {result && !loading && (
                <Card className="p-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      {result.category && <Badge className="bg-accent text-accent-foreground mb-2">{result.category}</Badge>}
                      <h2 className="font-display text-2xl font-bold">{result.name ?? "ระบุไม่ได้"}</h2>
                      {(result.edition || result.year) && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {result.edition && <span>{result.edition}</span>}
                          {result.edition && result.year && " · "}
                          {result.year && <span>ปี {result.year}</span>}
                        </p>
                      )}
                    </div>
                    {result.confidence != null && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">ความมั่นใจ</div>
                        <div className="font-display text-2xl font-bold gold-text">{Math.round(Number(result.confidence) * 100)}%</div>
                      </div>
                    )}
                  </div>

                  {result.description && (
                    <div>
                      <h3 className="text-xs uppercase tracking-wider text-accent mb-1">ลักษณะ</h3>
                      <p className="text-sm leading-relaxed">{result.description}</p>
                    </div>
                  )}

                  {result.history && (
                    <div>
                      <h3 className="text-xs uppercase tracking-wider text-accent mb-1">ประวัติ</h3>
                      <p className="text-sm leading-relaxed">{result.history}</p>
                    </div>
                  )}

                  {result.belief && (
                    <div>
                      <h3 className="text-xs uppercase tracking-wider text-accent mb-1">ความเชื่อ / พุทธคุณ</h3>
                      <p className="text-sm leading-relaxed">{result.belief}</p>
                    </div>
                  )}

                  {(result.market_price_min || result.market_price_max) && (
                    <div className="rounded-lg p-4" style={{ background: "var(--gradient-gold)" }}>
                      <div className="flex items-center gap-2 text-primary">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider font-medium">ราคาตลาด</span>
                      </div>
                      <div className="font-display text-2xl font-bold mt-1 text-primary">
                        {result.market_price_min?.toLocaleString() ?? "?"} – {result.market_price_max?.toLocaleString() ?? "?"} บาท
                      </div>
                      {result.popularity && (
                        <div className="text-xs text-primary/80 mt-1 flex items-center gap-1">
                          <Award className="w-3 h-3" /> ความนิยม: {result.popularity}
                        </div>
                      )}
                    </div>
                  )}

                  {result.authenticity_notes && (
                    <div className="border-l-2 border-accent pl-4">
                      <h3 className="text-xs uppercase tracking-wider text-accent mb-1 flex items-center gap-1"><Eye className="w-3 h-3" /> จุดสังเกตแท้/เก๊</h3>
                      <p className="text-sm leading-relaxed">{result.authenticity_notes}</p>
                    </div>
                  )}

                  <Button onClick={saveToCollection} className="w-full bg-primary">
                    <BookmarkPlus className="w-4 h-4 mr-2" /> บันทึกเข้าคอลเลกชัน
                  </Button>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
