import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ScanLine, Coins, Landmark, Gem, Shield, ArrowRight, Camera, Brain, FileSearch } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Collector — สแกนพระเครื่อง เหรียญ ธนบัตร ด้วย AI" },
      { name: "description", content: "ถ่ายรูปเดียวรู้ทั้งชื่อ รุ่น ปี ประวัติ และราคาตลาด รวมพระเครื่อง เหรียญสะสม ธนบัตรเก่า เครื่องราง เครื่องประดับโบราณ ในแพลตฟอร์มเดียว" },
    ],
  }),
  component: Index,
});

const categories = [
  { icon: Sparkles, name: "พระเครื่อง", desc: "สมเด็จ หลวงปู่ทวด พระรอด พระปิดตา เหรียญคณาจารย์" },
  { icon: Coins, name: "เหรียญสะสม", desc: "เหรียญรัชกาล เหรียญกษาปณ์ เหรียญต่างประเทศ" },
  { icon: Landmark, name: "ธนบัตรเก่า", desc: "ธนบัตรไทยทุกรุ่น และธนบัตรสะสมต่างประเทศ" },
  { icon: Gem, name: "เครื่องประดับโบราณ", desc: "ทอง เงิน หยก นิล พลอย" },
  { icon: Shield, name: "เครื่องราง", desc: "ตะกรุด ผ้ายันต์ ลูกอม เบี้ยแก้" },
];

const steps = [
  { icon: Camera, title: "ถ่ายภาพ", desc: "อัปโหลดรูปจากกล้องหรือคลังภาพ" },
  { icon: Brain, title: "AI วิเคราะห์", desc: "Computer Vision + OCR + LLM อ่านลักษณะและตัวอักษร" },
  { icon: FileSearch, title: "ได้ผลทันที", desc: "ชื่อ รุ่น ปี ประวัติ ราคา ความเชื่อ พร้อมจุดสังเกตแท้/เก๊" },
];

function Index() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-40" style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, oklch(0.78 0.13 80 / 0.25), transparent 40%), radial-gradient(circle at 80% 70%, oklch(0.62 0.11 60 / 0.2), transparent 45%)"
        }} />
        <div className="container mx-auto px-4 pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent-foreground">
              <Sparkles className="w-3.5 h-3.5" /> AI Vision สำหรับนักสะสมไทย
            </div>
            <h1 className="mt-6 font-display text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
              สแกนของสะสม<br />
              <span className="gold-text">รู้ลึกถึงตำนาน</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
              พระเครื่อง เหรียญ ธนบัตร เครื่องราง เครื่องประดับโบราณ — ถ่ายรูปครั้งเดียว
              AI บอกให้ครบทั้งชื่อ รุ่น ปี ประวัติ ราคาตลาด และจุดสังเกตแท้/เก๊
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/scan">
                <Button size="lg" className="h-12 px-7 bg-primary text-base shadow-[var(--shadow-elegant)]">
                  <ScanLine className="w-5 h-5 mr-2" /> เริ่มสแกนเลย
                </Button>
              </Link>
              <Link to="/marketplace">
                <Button size="lg" variant="outline" className="h-12 px-7 text-base">
                  เข้าตลาดสะสม <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-3 max-w-md gap-6 text-sm">
              <div><div className="font-display text-2xl font-bold gold-text">6+</div><div className="text-muted-foreground">หมวดของสะสม</div></div>
              <div><div className="font-display text-2xl font-bold gold-text">AI</div><div className="text-muted-foreground">Vision + OCR</div></div>
              <div><div className="font-display text-2xl font-bold gold-text">24/7</div><div className="text-muted-foreground">วิเคราะห์ทันที</div></div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="text-xs uppercase tracking-[0.3em] text-accent">ขั้นตอนการใช้งาน</div>
          <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold">เพียง 3 ขั้นตอน</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl bg-card border border-border/60 p-7 shadow-[var(--shadow-elegant)]">
              <div className="absolute -top-3 -right-3 w-9 h-9 rounded-full grid place-items-center font-display font-bold text-sm" style={{ background: "var(--gradient-gold)", color: "var(--teak)" }}>{i + 1}</div>
              <s.icon className="w-9 h-9 text-accent" />
              <h3 className="mt-4 font-display text-xl font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="text-xs uppercase tracking-[0.3em] text-accent">ประเภทที่รองรับ</div>
          <h2 className="mt-3 font-display text-3xl md:text-4xl font-bold">ครอบคลุมทุกหมวดของสะสมไทย</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map(c => (
            <div key={c.name} className="group rounded-2xl gold-border p-6 hover:shadow-[var(--shadow-gold)] transition-shadow">
              <c.icon className="w-8 h-8 text-accent" />
              <h3 className="mt-4 font-display text-xl font-bold">{c.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="rounded-3xl p-10 md:p-16 text-center" style={{ background: "var(--gradient-gold)" }}>
          <h2 className="font-display text-3xl md:text-5xl font-bold text-primary">เริ่มต้นคอลเลกชันของคุณวันนี้</h2>
          <p className="mt-4 text-primary/80 max-w-xl mx-auto">ฟรี ไม่ต้องตั้งค่า ใช้งานได้ทันที</p>
          <Link to="/auth"><Button size="lg" className="mt-7 h-12 px-8 bg-primary text-primary-foreground hover:opacity-90">สมัครสมาชิกฟรี</Button></Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
