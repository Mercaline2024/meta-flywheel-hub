export type CampaignStrategy = {
  key: string;
  name: string;
  goal: string;
  metaObjective: string;
  angle: string;
};

export const CAMPAIGN_STRATEGIES: CampaignStrategy[] = [
  {
    key: "sales_conversion",
    name: "Ventas (Conversión)",
    goal: "Maximizar compras o conversiones finales.",
    metaObjective: "OUTCOME_SALES",
    angle: "Oferta clara + urgencia + prueba social.",
  },
  {
    key: "catalog_sales",
    name: "Ventas por catálogo",
    goal: "Escalar productos con intención alta.",
    metaObjective: "OUTCOME_SALES",
    angle: "Producto protagonista + beneficios concretos.",
  },
  {
    key: "lead_generation",
    name: "Generación de leads",
    goal: "Captar prospectos de calidad para cierre.",
    metaObjective: "OUTCOME_LEADS",
    angle: "Pain point + solución + incentivo de registro.",
  },
  {
    key: "traffic",
    name: "Tráfico web",
    goal: "Enviar visitas relevantes a landing o tienda.",
    metaObjective: "OUTCOME_TRAFFIC",
    angle: "Hook visual + beneficio principal + CTA directo.",
  },
  {
    key: "engagement",
    name: "Interacción",
    goal: "Incrementar reacciones, comentarios y guardados.",
    metaObjective: "OUTCOME_ENGAGEMENT",
    angle: "Contenido participativo + pregunta detonante.",
  },
  {
    key: "brand_awareness",
    name: "Reconocimiento de marca",
    goal: "Aumentar recordación y notoriedad.",
    metaObjective: "OUTCOME_AWARENESS",
    angle: "Storytelling corto + identidad de marca consistente.",
  },
  {
    key: "reach",
    name: "Alcance",
    goal: "Llegar al mayor número de personas relevantes.",
    metaObjective: "OUTCOME_AWARENESS",
    angle: "Mensaje simple de alto impacto visual.",
  },
  {
    key: "video_views",
    name: "Visualizaciones de video",
    goal: "Aumentar vistas completas y retención.",
    metaObjective: "OUTCOME_ENGAGEMENT",
    angle: "Gancho en 3 segundos + edición dinámica + CTA final.",
  },
  {
    key: "app_promotion",
    name: "Promoción de app",
    goal: "Impulsar instalaciones o eventos in-app.",
    metaObjective: "OUTCOME_APP_PROMOTION",
    angle: "Demo de uso + propuesta de valor + prueba social.",
  },
  {
    key: "remarketing",
    name: "Remarketing",
    goal: "Recuperar usuarios que ya mostraron interés.",
    metaObjective: "OUTCOME_SALES",
    angle: "Recordatorio + objeciones + incentivo de cierre.",
  },
];

export const DEFAULT_STRATEGY_KEY = CAMPAIGN_STRATEGIES[0].key;
