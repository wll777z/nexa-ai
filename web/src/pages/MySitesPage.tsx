import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Sidebar } from '../components/Sidebar';
import { Card, Spinner, ErrorMessage, Badge, EmptyState } from '../components/UI';
import { layoutLabel } from '../components/siteHtml';
import type { SiteProject } from '../types/site';

const statusColors: Record<string, 'gray' | 'brand' | 'green' | 'yellow'> = {
  draft: 'gray',
  ready: 'yellow',
  publishing: 'brand',
  published: 'green',
};

const statusLabels: Record<string, string> = {
  draft: 'Rascunho',
  ready: 'Pronto',
  publishing: 'Publicando',
  published: 'Publicado',
};

export default function MySitesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading, error: loadError } = useQuery<{ data: SiteProject[] }>({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/sites/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sites'] }),
    onError: (err: Error) => setError(err.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: number) => api.post(`/sites/${id}/duplicate`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sites'] }),
    onError: (err: Error) => setError(err.message),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.put(`/sites/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      setRenamingId(null);
      setRenameValue('');
    },
    onError: (err: Error) => setError(err.message),
  });

  function startRename(site: SiteProject) {
    setRenamingId(site.id);
    setRenameValue(site.name);
  }

  function confirmRename() {
    if (renamingId !== null && renameValue.trim().length >= 2) {
      renameMutation.mutate({ id: renamingId, name: renameValue.trim() });
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-ink-strong">Meus sites</h2>
            <p className="text-ink-base text-sm mt-0.5">
              {data ? `${data.data.length} projeto(s)` : 'Carregando...'}
            </p>
          </div>
          <button className="btn-primary" onClick={() => navigate('/create-site')}>
            Criar site
          </button>
        </header>

        {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
        {isLoading && <Spinner />}
        {loadError && <ErrorMessage message={(loadError as Error).message} />}

        {data && data.data.length === 0 && (
          <EmptyState
            title="Nenhum projeto ainda"
            description="Crie seu primeiro site com IA ou com estrutura local."
            action={
              <button className="btn-primary" onClick={() => navigate('/create-site')}>
                Criar site
              </button>
            }
          />
        )}

        {data && data.data.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.data.map((site) => (
              <Card key={site.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  {renamingId === site.id ? (
                    <input
                      className="field text-sm"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                      autoFocus
                    />
                  ) : (
                    <h3 className="text-sm font-medium text-ink-strong">{site.name}</h3>
                  )}
                  <Badge color={statusColors[site.status] ?? 'gray'}>
                    {statusLabels[site.status] ?? site.status}
                  </Badge>
                </div>

                {site.content && (
                  <div className="flex gap-2 flex-wrap">
                    <Badge color="brand">{layoutLabel(site.content.layout)}</Badge>
                    {site.brief?.segment && <Badge>{site.brief.segment}</Badge>}
                  </div>
                )}

                {site.brief?.description && (
                  <p className="text-xs text-ink-faint line-clamp-2">{site.brief.description}</p>
                )}

                <p className="text-xs text-ink-faint">Atualizado em {site.updated_at}</p>

                <div className="flex flex-wrap gap-2 mt-auto">
                  {renamingId === site.id ? (
                    <>
                      <button className="btn-secondary text-xs" onClick={confirmRename}>Salvar</button>
                      <button className="btn-secondary text-xs" onClick={() => setRenamingId(null)}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-secondary text-xs" onClick={() => navigate(`/editor/${site.id}`)}>Abrir</button>
                      <button className="btn-secondary text-xs" onClick={() => startRename(site)}>Renomear</button>
                      <button className="btn-secondary text-xs" onClick={() => duplicateMutation.mutate(site.id)}>Duplicar</button>
                      <button
                        className="text-xs text-red-400 hover:text-red-300 px-2"
                        onClick={() => {
                          if (confirm(`Excluir "${site.name}"?`)) deleteMutation.mutate(site.id);
                        }}
                      >
                        Excluir
                      </button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
