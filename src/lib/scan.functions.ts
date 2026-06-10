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
  "confidence": ตัวเลข 0-1 ความมั่นใจในการระบุ,
  "points_of_interest": [
    {
      "x": ตำแหน่งแกน X เป็นสัดส่วน 0-1 ของความกว้างภาพ,
      "y": ตำแหน่งแกน Y เป็นสัดส่วน 0-1 ของความสูงภาพ,
      "label": "ชื่อจุด เช่น 'รอยจาร', 'ตำหนิแม่พิมพ์', 'เลขประจำเหรียญ'",
      "note": "อธิบายสั้นๆ ว่าจุดนี้บอกอะไร",
      "kind": "feature|flaw|hallmark|wear"
    }
  ]
}
ระบุจุดสนใจไม่เกิน 6 จุด เน้นจุดที่ใช้พิสูจน์ของแท้/ของปลอม หรือตำหนิเฉพาะตัว
ถ้าระบุไม่ได้ ให้ใส่ค่า null ในฟิลด์ที่ไม่แน่ใจ ตอบเฉพาะ JSON เท่านั้น ห้ามมีข้อความอื่น`;

async function embedText(text: string, key: string): Promise<number[] | null> {
  if (!text.trim()) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: "openai/text-embedding-3-small",
        input: text.slice(0, 8000),
        dimensions: 1536,
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return j.data?.[0]?.embedding ?? null;
  } catch { return null; }
}

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

    // Build embedding from synthesized description (text-based but rich)
    const embedSrc = [
      parsed.category, parsed.name, parsed.edition, parsed.year,
      parsed.description, parsed.history, parsed.authenticity_notes,
    ].filter(Boolean).join(" \n ");
    const embedding = await embedText(embedSrc, key);

    // Validate points_of_interest
    const rawPoints = Array.isArray(parsed.points_of_interest) ? parsed.points_of_interest : [];
    const points = rawPoints.slice(0, 6).map((p: Record<string, unknown>) => ({
      x: Math.max(0, Math.min(1, Number(p.x) || 0)),
      y: Math.max(0, Math.min(1, Number(p.y) || 0)),
      label: String(p.label ?? "").slice(0, 80),
      note: String(p.note ?? "").slice(0, 280),
      kind: ["feature","flaw","hallmark","wear"].includes(String(p.kind)) ? String(p.kind) : "feature",
    })).filter((p: { label: string }) => p.label);

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
      points_of_interest: points as never,
      // embedding stored separately to avoid type friction
    }).select().single();

    if (error) throw new Error(error.message);

    // Update embedding via raw update (vector type)
    if (embedding && inserted) {
      const embStr = `[${embedding.join(",")}]`;
      await context.supabase.from("scans").update({ embedding: embStr as never }).eq("id", inserted.id);
    }

    return { ...inserted, points_of_interest: points };
  });

export const findSimilarScans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({
    scan_id: z.string().uuid(),
    limit: z.number().int().min(1).max(12).default(6),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: src, error } = await context.supabase
      .from("scans").select("embedding").eq("id", data.scan_id).maybeSingle();
    if (error) throw new Error(error.message);
    const emb = (src as { embedding?: string } | null)?.embedding;
    if (!emb) return [];

    const { data: matches, error: mErr } = await context.supabase.rpc("match_scans", {
      query_embedding: emb as never,
      exclude_id: data.scan_id,
      match_count: data.limit,
    });
    if (mErr) throw new Error(mErr.message);
    return matches ?? [];
  });
