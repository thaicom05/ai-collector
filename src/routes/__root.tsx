import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold gold-text">404</h1>
        <h2 className="mt-4 text-xl font-semibold">ไม่พบหน้าที่คุณกำลังหา</h2>
        <p className="mt-2 text-sm text-muted-foreground">หน้านี้อาจถูกย้ายหรือไม่มีอยู่</p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">
          กลับหน้าแรก
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">เกิดข้อผิดพลาด</h1>
        <p className="mt-2 text-sm text-muted-foreground">ลองรีเฟรชหรือกลับหน้าแรก</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">ลองใหม่</button>
          <a href="/" className="rounded-md border px-4 py-2 text-sm">หน้าแรก</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AI Collector — สแกนพระเครื่อง เหรียญ ธนบัตร ด้วย AI" },
      { name: "description", content: "แพลตฟอร์ม AI สำหรับนักสะสมไทย ระบุพระเครื่อง เหรียญสะสม ธนบัตรเก่า เครื่องราง พร้อมประวัติและราคาตลาด" },
      { property: "og:title", content: "AI Collector — สแกนพระเครื่อง เหรียญ ธนบัตร ด้วย AI" },
      { property: "og:description", content: "แพลตฟอร์ม AI สำหรับนักสะสมไทย ระบุพระเครื่อง เหรียญสะสม ธนบัตรเก่า เครื่องราง พร้อมประวัติและราคาตลาด" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "AI Collector — สแกนพระเครื่อง เหรียญ ธนบัตร ด้วย AI" },
      { name: "twitter:description", content: "แพลตฟอร์ม AI สำหรับนักสะสมไทย ระบุพระเครื่อง เหรียญสะสม ธนบัตรเก่า เครื่องราง พร้อมประวัติและราคาตลาด" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e3d314d1-489d-4a36-9f05-379fdf621afc/id-preview-7465cec0--62e1d460-4723-4c29-a1a3-e5996ef32fbd.lovable.app-1780988499220.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e3d314d1-489d-4a36-9f05-379fdf621afc/id-preview-7465cec0--62e1d460-4723-4c29-a1a3-e5996ef32fbd.lovable.app-1780988499220.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Noto+Serif+Thai:wght@400;600;700&family=IBM+Plex+Sans+Thai:wght@300;400;500;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}
