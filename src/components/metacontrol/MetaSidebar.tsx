import { useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Megaphone, MessageSquareText, LogOut } from "lucide-react";

import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { title: "Campañas", url: "/app/campaigns", icon: Megaphone },
  { title: "Plantillas", url: "/app/templates", icon: MessageSquareText },
  { title: "Métricas", url: "/app/metrics", icon: BarChart3 },
];

export default function MetaSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="tracking-wide">Navegación</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink
                      to={item.url}
                      end
                      className="transition-colors duration-200"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <item.icon aria-hidden="true" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
              toast({ title: "No se pudo cerrar sesión", description: error.message });
              return;
            }
            navigate("/auth");
          }}
        >
          <LogOut aria-hidden="true" />
          <span>Salir</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
