# NEXA AI — Plataforma de IA comercial

Plataforma web para gestão comercial: CRM, prospecção de clientes, campanhas, automações e criador de sites com IA.

## Stack

- Backend: Node.js + TypeScript + Express
- Banco: SQLite (via `node:sqlite`, zero instalação externa)
- Auth: JWT + bcrypt
- Validação: zod
- Testes: vitest + supertest
- Frontend: React 19 + Vite + Tailwind + React Router + React Query

## Estrutura

```
server/
  src/
    config/env.ts          — variáveis de ambiente
    db/index.ts            — acesso ao banco (troca para PostgreSQL sem reescrever regras)
    db/migrate.ts          — migrations SQL versionadas
    modules/
      auth/                — registro, login, JWT, middleware de proteção
      contacts/            — CRUD de contatos, filtros, seleção de destinatários
      dashboard/           — métricas reais do banco
      prospecting/         — busca de leads, priorização, mensagens com aprovação
      sites/               — criador de sites (template) e construtor por chat com IA
    server.ts              — app Express
  .env.example             — variáveis de ambiente (copiar para .env)
  .env.test                — configuração dos testes (banco em memória)
web/
  src/
    pages/                 — cada tela da plataforma
    components/            — UI, Sidebar, prévia do site em iframe isolado
    services/              — chamadas à API e leitura de streaming (SSE)
```

## Como rodar

```bash
# instalar dependências (na raiz do projeto)
npm install

# rodar o servidor em desenvolvimento
npm run dev:server

# rodar o frontend
npm run dev:web

# rodar os testes
npm test

# verificar tipos
npm run typecheck
```

## Construtor de sites por chat

A tela **Construtor por chat** gera um site completo em HTML a partir de uma conversa.

Como funciona:

1. O usuário descreve o negócio e o visual desejado.
2. O backend chama o modelo com streaming e devolve o HTML aos poucos.
3. A prévia aparece na hora, em um iframe isolado, enquanto o site é escrito.
4. Depois é só pedir ajustes por chat, com botão de desfazer para voltar à versão anterior.

Requisitos:

- `ANTHROPIC_API_KEY` no `server/.env` para a geração por chat funcionar.
- Opcional: `ANTHROPIC_MODEL` para trocar o modelo.

Sem a chave, a plataforma continua funcionando: o criador de sites em modo template não depende dela.

### Segurança do HTML gerado

O HTML vem de um modelo, então é tratado como código não confiável:

- A prévia roda em iframe com `sandbox` e sem `allow-same-origin`, isolada do painel.
- Ao publicar, o site deve ficar em domínio separado da aplicação.

## Endpoints principais

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/health | Health check |
| POST | /api/auth/register | Criar conta + organização |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Dados do usuário autenticado |
| GET | /api/contacts | Listar contatos (filtros: q, stage, source, tag) |
| POST | /api/contacts | Criar contato |
| POST | /api/contacts/select | Selecionar destinatários válidos |
| GET | /api/dashboard/overview | Métricas reais |
| GET | /api/sites | Listar projetos de site |
| POST | /api/sites | Criar projeto a partir do briefing (IA ou gerador local) |
| GET | /api/sites/:id/html | HTML atual do projeto |
| POST | /api/sites/:id/html/stream | Gerar ou editar o site por chat (SSE) |
| POST | /api/sites/:id/html/undo | Voltar à versão anterior |
| GET | /api/prospecting/status | Estado da prospecção (Maps e IA configurados?) |
| POST | /api/prospecting/search | Buscar empresas por segmento e região |
| GET | /api/prospecting/leads | Listar leads com filtros |
| POST | /api/prospecting/leads/:id/message | Gerar mensagem para um lead |
| POST | /api/prospecting/messages/:id/approve | Aprovar mensagem |
| POST | /api/prospecting/messages/:id/send | Enviar mensagem aprovada (requer canal) |

## Próximos passos

O roteiro de melhorias está em [IDEIAS.md](./IDEIAS.md), com o problema que cada item resolve, o esforço estimado e a ordem sugerida.

Os primeiros da fila:

1. Ligar o formulário do site publicado ao CRM, para o lead deixar de se perder.
2. Limite de uso de IA por organização, para não estourar o custo.
3. Publicação do site com um clique.

## Variáveis de ambiente

Todas em `server/.env` (copie de `server/.env.example`). Nenhuma chave pode ir para o repositório.

| Variável | Para que serve |
|---|---|
| `PORT` | Porta do servidor |
| `DATABASE_PATH` | Caminho do banco SQLite |
| `JWT_SECRET` | Assinatura dos tokens de acesso |
| `CORS_ORIGIN` | Origem liberada no CORS |
| `ANTHROPIC_API_KEY` | Geração de sites no construtor por chat |
| `AI_API_KEY` | Geração de conteúdo e mensagens de prospecção |
