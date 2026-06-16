import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "เข้าสู่ระบบ — AI Collector" }] }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.navigate({ to: "/scan" });
    });
  }, [router]);

  const handleAuth = async (mode: "signin" | "signup") => {
    setLoading(true);
    try {
      const fn = mode === "signin" ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      const { error } = await fn;
      if (error) throw error;
      toast.success(mode === "signin" ? "ยินดีต้อนรับกลับ" : "สมัครสำเร็จ");
      router.navigate({ to: "/scan" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    try {
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/scan` });
      if (r.error) {
        toast.error("ไม่สามารถเข้าสู่ระบบด้วย Google: " + (r.error.message ?? ""));
        return;
      }
      if (r.redirected) return;
      router.navigate({ to: "/scan" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google");
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-full grid place-items-center" style={{ background: "var(--gradient-gold)" }}>
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display text-2xl font-bold">AI Collector</span>
        </Link>
        <div className="rounded-2xl bg-card border border-border/60 p-7 shadow-[var(--shadow-elegant)]">
          <h1 className="font-display text-2xl font-bold text-center">เริ่มต้นใช้งาน</h1>
          <p className="text-center text-sm text-muted-foreground mt-1">เก็บสะสมและประเมินของสะสมด้วย AI</p>

          <Button variant="outline" className="w-full mt-6 h-11" onClick={handleGoogle}>
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            เข้าสู่ระบบด้วย Google
          </Button>

          <div className="flex items-center gap-3 my-5"><div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground">หรือ</span><div className="flex-1 h-px bg-border" /></div>

          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">เข้าสู่ระบบ</TabsTrigger>
              <TabsTrigger value="signup">สมัครสมาชิก</TabsTrigger>
            </TabsList>
            {(["signin", "signup"] as const).map(mode => (
              <TabsContent key={mode} value={mode} className="space-y-3 mt-5">
                <div><Label>อีเมล</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5" /></div>
                <div><Label>รหัสผ่าน</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1.5" /></div>
                <Button disabled={loading} onClick={() => handleAuth(mode)} className="w-full h-11 bg-primary">
                  {loading ? "กำลังโหลด..." : mode === "signin" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
                </Button>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
