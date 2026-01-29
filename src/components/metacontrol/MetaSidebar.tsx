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
          onClick={() => {
            toast({
              title: "Modo demo",
              description: "Sesión cerrada. Cuando conectes Meta, esto cerrará tu sesión real.",
            });
            navigate("/");
          }}
        >
          <LogOut aria-hidden="true" />
          <span>Salir</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
