/** Tipos do módulo de prospecção comercial (espelho do modelo do servidor). */

export type LeadStatus =
  | 'novo_lead'
  | 'em_analise'
  | 'aguardando_aprovacao'
  | 'aprovado_contato'
  | 'mensagem_enviada'
  | 'respondeu'
  | 'interessado'
  | 'nao_interessado'
  | 'nao_contatar';

export type LeadPriority = 'alta' | 'media' | 'baixa';

export type MessageStatus =
  | 'pendente'
  | 'aprovada'
  | 'enviada'
  | 'respondida'
  | 'recusada';

export type ProspectingChannel = 'manual' | 'email' | 'whatsapp';

export const STATUS_LABELS: Record<LeadStatus, string> = {
  novo_lead: 'Novo lead',
  em_analise: 'Em análise',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovado_contato: 'Aprovado para contato',
  mensagem_enviada: 'Mensagem enviada',
  respondeu: 'Respondeu',
  interessado: 'Interessado',
  nao_interessado: 'Não interessado',
  nao_contatar: 'Não contatar novamente',
};

export const PRIORITY_LABELS: Record<LeadPriority, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

export const ALL_STATUSES = Object.keys(STATUS_LABELS) as LeadStatus[];

export interface ProspectingConfig {
  id: number;
  organizationId: number;
  service: string;
  companyName: string;
  description: string;
  region: string;
  segments: string[];
  maxPerSearch: number;
  channel: ProspectingChannel;
  messageTemplate: string;
  maxContactsDay: number;
  autoApprove: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: number;
  name: string;
  category: string | null;
  city: string | null;
  neighborhood: string | null;
  website: string | null;
  phone: string | null;
  source: string;
  reason: string | null;
  priority: LeadPriority;
  status: LeadStatus;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  lastContactAt: string | null;
  nextAction: string | null;
}

export interface ProspectingMessage {
  id: number;
  lead_id: number;
  content: string;
  status: MessageStatus;
  channel: string | null;
  approved_at: string | null;
  sent_at: string | null;
  send_result: string | null;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
  lead_name: string;
}

export interface ActivityEntry {
  id: number;
  action: string;
  entity: string | null;
  entityId: number | null;
  detail: string | null;
  createdAt: string;
}

export interface ProspectingStatus {
  googleMaps: boolean;
  ai: boolean;
  mode: 'google_maps' | 'demo';
}

export interface SearchResult {
  found: number;
  inserted: number;
  skipped: number;
  isDemo: boolean;
  companies: { name: string; category: string; city: string; isDemo: boolean }[];
}

export interface ProspectingStats {
  totalLeads: number;
  messagesSent: number;
  messagesPending: number;
  [key: string]: number;
}
