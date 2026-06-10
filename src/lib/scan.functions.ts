import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SYSTEM = `คุณเป็นผู้เชี่ยวชาญด้านของสะสมไทย ทั้งพระเครื่อง เหรียญสะสม ธนบัตรเก่า เครื่องราง เครื่องประดับโบราณ และของโบราณ
วิเคราะห์ภาพที่ผู้ใช้ส่งมา และตอบเป็น JSON object ภาษาไทย โดยมีฟิลด์ดังนี้:
{
  "category": "พระเครื่อง|เหรียญสะสม|ธนบัตรเก่า|เครื่องราง|เครื่องประดับ|ของโบราณ|อื่นๆ",
  "name": "ชื่อวัตถุที่คาดว่าจะเป็น",
  "edition": "รุ่น (ถ้าทราบ)",
  "year": "พ.ศ. หรือ ค.ศ. (ถ้าทราบ)",
  "description": "คำอธิบายลักษณะที่เห็น 2-3 ประโยค",
  "history": "ประวัติความเป็นมา 2-4 ประโยค",
  "belief": "ความเชื่อ/พุทธคุณ (ถ้าเกี่ยวข้อง)",
  "authenticity_notes": "จุดสังเกตแท้/เก๊ที่ควรพิจารณา",
  "market_price_min": ตัวเลขราคาต่ำสุดในตลาด (บาท),
  "market_price_max": ตัวเลขราคาสูงสุดในตลาด (บาท),
  "popularity": "ต่ำ|ปานกลาง|สูง|สูงมาก",
  "confidence": ตัวเลข 0-1 ความมั่นใจในการระบุ
}
ถ้าระบุไม่ได้ ให้ใส่ค่า null ในฟิลด์ที่ไม่แน่ใจ ตอบเฉพาะ JSON เท่านั้น ห้ามมีข้อความอื่น`;

export const analyzeImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    imageBase64: z.string().min(10).max(15_000_000, "ภาพมีขนาดใหญ่เกินไป (สูงสุด ~10MB)"),
    imageUrl: z.string().max(2048).optional(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: [
            { type: "text", text: "ช่วยวิเคราะห์ของสะสมในรูปนี้" },
            { type: "image_url", image_url: { url: data.imageBase64 } },
          ]},
        ],
      }),
    });

    if (res.status === 429) throw new Error("ระบบ AI ถูกใช้งานเยอะเกินไป กรุณาลองใหม่ภายหลัง");
    if (res.status === 402) throw new Error("เครดิต AI หมด กรุณาเติมเครดิต");
    if (!res.ok) throw new Error(`AI error: ${res.status}`);

    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? "{}";
    const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = { description: text }; }

    const num = (v: unknown) => typeof v === "number" ? v : (typeof v === "string" && !isNaN(Number(v)) ? Number(v) : null);

    const { data: inserted, error } = await context.supabase.from("scans").insert({
      user_id: context.userId,
      image_url: data.imageUrl ?? "",
      category: (parsed.category as string) ?? null,
      name: (parsed.name as string) ?? null,
      edition: (parsed.edition as string) ?? null,
      year: (parsed.year as string) ?? null,
      description: (parsed.description as string) ?? null,
      history: (parsed.history as string) ?? null,
      belief: (parsed.belief as string) ?? null,
      authenticity_notes: (parsed.authenticity_notes as string) ?? null,
      market_price_min: num(parsed.market_price_min),
      market_price_max: num(parsed.market_price_max),
      popularity: (parsed.popularity as string) ?? null,
      confidence: num(parsed.confidence),
      raw_response: parsed as never,
    }).select().single();

    if (error) throw new Error(error.message);
    return inserted;
  });
