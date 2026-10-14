import { getToken, removeToken } from './storage';

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; html: string }
  | { type: 'error'; message: string };

/** Chama a rota de geração por chat e entrega cada evento SSE ao callback. */
export async function streamSiteHtml(
  siteId: number | string,
  prompt: string,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = getToken();
  const res = await fetch(`/api/sites/${siteId}/html/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ prompt }),
    signal,
  });

  if (res.status === 401) {
    removeToken();
    window.location.href = '/login';
    throw new Error('Sessão expirada.');
  }
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Erro ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const line = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      try {
        onEvent(JSON.parse(line.slice(5).trim()) as StreamEvent);
      } catch {
        // evento malformado: ignora
      }
    }
  }
}
