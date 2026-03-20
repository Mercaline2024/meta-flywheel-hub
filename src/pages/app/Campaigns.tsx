import { Bot, MessageCircleDashed, SearchCheck } from "lucide-react";

import AICampaignBuilder from "@/components/campaigns/AICampaignBuilder";
import MarketResearchModule from "@/components/campaigns/MarketResearchModule";
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

      <Tabs defaultValue="market-research" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 md:w-auto">
          <TabsTrigger value="market-research" className="gap-2">
            <SearchCheck className="h-4 w-4" aria-hidden="true" />
            Investigación
          </TabsTrigger>
          <TabsTrigger value="ads-ai" className="gap-2">
            <Bot className="h-4 w-4" aria-hidden="true" />
            Ads con IA
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircleDashed className="h-4 w-4" aria-hidden="true" />
            WhatsApp programado
          </TabsTrigger>
        </TabsList>

        <TabsContent value="market-research">
          <MarketResearchModule />
        </TabsContent>

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
