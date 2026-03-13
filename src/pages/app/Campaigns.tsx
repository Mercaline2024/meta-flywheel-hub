import { Bot, MessageCircleDashed } from "lucide-react";

import AICampaignBuilder from "@/components/campaigns/AICampaignBuilder";
import WhatsappCampaignScheduler from "@/components/campaigns/WhatsappCampaignScheduler";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Campaigns() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Panel de campañas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona automatizaciones de WhatsApp y campañas de Ads generadas con IA desde un solo módulo.
          </p>
        </div>
        <Badge variant="secondary">Automatización activa</Badge>
      </div>

      <Tabs defaultValue="ads-ai" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:w-auto">
          <TabsTrigger value="ads-ai" className="gap-2">
            <Bot className="h-4 w-4" aria-hidden="true" />
            Ads con IA
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircleDashed className="h-4 w-4" aria-hidden="true" />
            WhatsApp programado
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ads-ai">
          <AICampaignBuilder />
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsappCampaignScheduler />
        </TabsContent>
      </Tabs>
    </div>
  );
}
