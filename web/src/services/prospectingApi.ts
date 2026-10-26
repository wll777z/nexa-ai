import { api } from './api';
import type {
  ActivityEntry,
  Lead,
  LeadPriority,
  LeadStatus,
  ProspectingConfig,
  ProspectingMessage,
  ProspectingStats,
  ProspectingStatus,
  SearchResult,
} from '../types/prospecting';

export const prospectingApi = {
  addManual: (data: Record<string, string>) => api.post<{ status: string; leadId: number }>('/prospecting/leads/manual', data),
  previewCsv: (csv: string) => api.post<{ rows: Array<{ line: number; company?: Record<string, string>; error?: string; match?: { id: number; kind: string } }> }>('/prospecting/import/preview', { csv }),
  confirmCsv: (csv: string, filename: string) => api.post<{ total: number; imported: number; rejected: number }>('/prospecting/import/confirm', { csv, filename }),
  status: () => api.get<ProspectingStatus>('/prospecting/status'),

  getConfig: () =>
    api.get<{ config: ProspectingConfig | null }>('/prospecting/config'),

  saveConfig: (data: Partial<ProspectingConfig>) =>
    api.put<{ config: ProspectingConfig }>('/prospecting/config', data),

  search: (data: { segments?: string[]; region?: string; maxResults?: number }) =>
    api.post<SearchResult>('/prospecting/search', data),

  leads: (params: {
    status?: LeadStatus;
    priority?: LeadPriority;
    search?: string;
    includeDemo?: boolean;
    city?: string;
    state?: string;
    neighborhood?: string;
    category?: string;
    source?: string;
    websiteStatus?: 'provided' | 'not_provided';
  } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.priority) q.set('priority', params.priority);
    if (params.search) q.set('search', params.search);
    if (params.includeDemo) q.set('includeDemo', 'true');
    if (params.city) q.set('city', params.city);
    if (params.state) q.set('state', params.state);
    if (params.neighborhood) q.set('neighborhood', params.neighborhood);
    if (params.category) q.set('category', params.category);
    if (params.source) q.set('source', params.source);
    if (params.websiteStatus) q.set('websiteStatus', params.websiteStatus);
    const qs = q.toString();
    return api.get<{ data: Lead[]; total: number }>(
      `/prospecting/leads${qs ? `?${qs}` : ''}`,
    );
  },

  stats: () => api.get<{ stats: ProspectingStats }>('/prospecting/stats'),

  activity: () =>
    api.get<{ data: ActivityEntry[] }>('/prospecting/activity'),

  messages: (status?: string) =>
    api.get<{ data: ProspectingMessage[] }>(
      `/prospecting/messages${status ? `?status=${status}` : ''}`,
    ),

  createMessage: (leadId: number) =>
    api.post<{ id: number; content: string; status: string }>(
      `/prospecting/leads/${leadId}/message`,
    ),

  approveMessage: (messageId: number) =>
    api.post<{ ok: true }>(`/prospecting/messages/${messageId}/approve`),

  rejectMessage: (messageId: number) =>
    api.post<{ ok: true }>(`/prospecting/messages/${messageId}/reject`),

  suppressLead: (leadId: number, reason: string) =>
    api.post<{ ok: true }>(`/prospecting/leads/${leadId}/suppress`, { reason }),

  updateLeadStatus: (leadId: number, status: LeadStatus) =>
    api.patch<{ ok: true }>(`/prospecting/leads/${leadId}/status`, { status }),
};
