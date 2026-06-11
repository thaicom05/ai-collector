import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, LogOut, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function SiteNav() {
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string | null } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/" });
  };

  const links = [
    { to: "/", label: "หน้าแรก" },
    { to: "/scan", label: "สแกนด้วย AI" },
    { to: "/collection", label: "คอลเลกชัน" },
    { to: "/auctions", label: "ประมูล" },
    { to: "/marketplace", label: "ตลาด" },
    { to: "/messages", label: "ข้อความ" },
    { to: "/cart", label: "ตะกร้า" },
  ] as const;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full grid place-items-center" style={{ background: "var(--gradient-gold)" }}>
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold tracking-tight">AI Collector</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">ของสะสมไทย</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {links.map(l => (
            <Link key={l.to} to={l.to} className="text-sm hover:text-accent transition-colors" activeProps={{ className: "text-accent font-medium" }}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-1.5" /> ออกจากระบบ
            </Button>
          ) : (
            <>
              <Link to="/auth" className="text-sm">เข้าสู่ระบบ</Link>
              <Link to="/auth"><Button size="sm" className="bg-primary">เริ่มใช้งาน</Button></Link>
            </>
          )}
        </div>

        <button className="md:hidden" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-border/60 bg-background/95 px-4 py-3 space-y-2">
          {links.map(l => (
            <Link key={l.to} to={l.to} className="block py-2 text-sm" onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
          {user ? (
            <button onClick={signOut} className="block py-2 text-sm">ออกจากระบบ</button>
          ) : (
            <Link to="/auth" className="block py-2 text-sm font-medium text-accent" onClick={() => setOpen(false)}>เข้าสู่ระบบ</Link>
          )}
        </div>
      )}
    </header>
  );
}
