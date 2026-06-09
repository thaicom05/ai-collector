export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 py-10">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
        <div>© {new Date().getFullYear()} AI Collector — แพลตฟอร์มของสะสมไทย</div>
        <div className="font-display italic">"เก็บคุณค่า สืบศรัทธา ส่งต่อตำนาน"</div>
      </div>
    </footer>
  );
}
