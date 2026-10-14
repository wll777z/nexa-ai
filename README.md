# NEXA AI — Plataforma de IA comercial

Plataforma web para gestão comercial: CRM, campanhas, automações e criador de sites.
Fase 1 (base funcional) implementada e testada.

## Stack

- Backend: Node.js + TypeScript + Express
- Banco: SQLite (via `node:sqlite`, zero instalação externa)
- Auth: JWT + bcrypt
- Validação: zod
- Testes: vitest + supertest

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
    server.ts              — app Express
  .env.example             — variáveis de ambiente (copiar para .env)
  .env.test                — configuração dos testes (banco em memória)
```

## Como rodar

```bash
# instalar dependências (na raiz do projeto)
npm install

# rodar servidor em desenvolvimento
npm run dev:server

# rodar testes
npm test

# verificar tipos
npm run typecheck
```

## Endpoints disponíveis (Fase 1)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | /api/health | Health check |
| POST | /api/auth/register | Criar conta + organização |
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Dados do usuário autenticado |
| GET | /api/contacts | Listar contatos (filtros: q, stage, source, tag) |
| POST | /api/contacts | Criar contato |
| PUT | /api/contacts/:id | Atualizar contato |
| DELETE | /api/contacts/:id | Excluir contato (admin) |
| POST | /api/contacts/select | Selecionar destinatários válidos |
| GET | /api/contacts/tags/all | Listar etiquetas |
| GET | /api/dashboard/overview | Métricas reais |

## Fases seguintes

- Fase 2: segmentação avançada, modelos de mensagens, central de mensagens, integração com provedor real
- Fase 3: agendador persistente, filas de tarefas, automações com gatilhos
- Fase 4: construtor de sites assistido por IA
- Fase 5: assistente de linguagem natural, geração de mensagens, relatórios inteligentes
- Fase 6: testes completos, revisão de segurança, documentação, deploy
