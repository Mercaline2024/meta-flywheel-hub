import { Outlet } from "react-router-dom";
import { PanelsTopLeft } from "lucide-react";

import MetaSidebar from "@/components/metacontrol/MetaSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function AppLayout() {
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen w-full">
        <div className="flex min-h-screen w-full">
          <MetaSidebar />

          <SidebarInset>
            <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4">
                <SidebarTrigger className="shrink-0" />
                <Separator orientation="vertical" className="h-6" />
                <div className="flex items-center gap-2">
                  <PanelsTopLeft className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm font-medium">MetaControl</span>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <Badge variant="secondary">Demo</Badge>
                </div>
              </div>
            </header>

            <div className="mx-auto w-full max-w-7xl px-4 py-6">
              <Outlet />
            </div>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
