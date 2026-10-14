import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { Sidebar } from '../components/Sidebar';
import { Card, StatCard, Spinner, ErrorMessage, Badge } from '../components/UI';

interface Overview {
  totals: {
    contacts: number;
    newLeads: number;
    converted: number;
    optOut: number;
    noConsent: number;
  };
  byStage: { stage: string; n: number }[];
  bySource: { source: string; n: number }[];
  recentContacts: {
    id: number;
    name: string;
    source: string | null;
    stage: string;
    created_at: string;
  }[];
  pendingAttention: number;
}

const stageLabels: Record<string, string> = {
  new_lead: 'Novo lead',
  first_contact: 'Primeiro contato',
  in_service: 'Em atendimento',
  qualified: 'Qualificado',
  quote_sent: 'Orçamento enviado',
  awaiting_reply: 'Aguardando resposta',
  negotiation: 'Negociação',
  converted: 'Convertido',
  lost: 'Perdido',
};

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery<Overview>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard/overview'),
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <header className="mb-6">
          <h2 className="text-xl font-semibold text-ink-strong">Visão geral</h2>
          <p className="text-ink-base text-sm mt-0.5">
            Dados reais da sua base de contatos.
          </p>
        </header>

        {isLoading && <Spinner />}
        {error && <ErrorMessage message={(error as Error).message} />}

        {data && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Contatos" value={data.totals.contacts} />
              <StatCard label="Novos leads" value={data.totals.newLeads} />
              <StatCard label="Convertidos" value={data.totals.converted} />
              <StatCard label="Sem consentimento" value={data.totals.noConsent} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <h3 className="text-sm font-medium text-ink-strong mb-3">
                  Por etapa do funil
                </h3>
                {data.byStage.length === 0 ? (
                  <p className="text-ink-faint text-sm">Nenhum contato cadastrado.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.byStage.map((s) => (
                      <div key={s.stage} className="flex justify-between text-sm">
                        <span className="text-ink-base">
                          {stageLabels[s.stage] ?? s.stage}
                        </span>
                        <span className="text-ink-strong font-medium">{s.n}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <h3 className="text-sm font-medium text-ink-strong mb-3">Por origem</h3>
                {data.bySource.length === 0 ? (
                  <p className="text-ink-faint text-sm">Nenhuma origem registrada.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.bySource.map((s) => (
                      <div key={s.source} className="flex justify-between text-sm">
                        <span className="text-ink-base">{s.source}</span>
                        <span className="text-ink-strong font-medium">{s.n}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <Card>
              <h3 className="text-sm font-medium text-ink-strong mb-3">
                Contatos recentes
              </h3>
              {data.recentContacts.length === 0 ? (
                <p className="text-ink-faint text-sm">Nenhum contato recente.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-ink-faint text-left border-b border-surface-line">
                        <th className="pb-2 font-medium">Nome</th>
                        <th className="pb-2 font-medium">Origem</th>
                        <th className="pb-2 font-medium">Etapa</th>
                        <th className="pb-2 font-medium">Cadastrado em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentContacts.map((c) => (
                        <tr key={c.id} className="border-b border-surface-line/50">
                          <td className="py-2 text-ink-strong">{c.name}</td>
                          <td className="py-2 text-ink-base">{c.source ?? '—'}</td>
                          <td className="py-2">
                            <Badge color="brand">
                              {stageLabels[c.stage] ?? c.stage}
                            </Badge>
                          </td>
                          <td className="py-2 text-ink-faint">{c.created_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
