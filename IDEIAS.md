# Ideias para o NEXA AI

Documento vivo. Cada ideia tem o problema que resolve, um esforço estimado e um critério de pronto. As ideias marcadas com ✅ são as que eu recomendo atacar primeiro.

> **Contexto atual do projeto (outubro de 2026)**
>
> O que já existe no repositório:
> - CRM com contatos, etiquetas e etapas de negociação
> - Módulo de prospecção (busca de leads, priorização, lista de supressão, mensagens com aprovação)
> - Criador de sites em dois modos: formulário com template e **construtor por chat com Claude**
> - Autenticação com JWT e isolamento por organização (multi-tenant)
>
> O que ainda não existe: publicação de sites, envio real de mensagens, ligação entre site e CRM, limite de uso de IA.

## Como ler os esforços

| Marca | Significado |
|---|---|
| P | Algumas horas, 1 ou 2 arquivos |
| M | 1 a 2 dias, mexe em backend e frontend |
| G | Uma semana ou mais, exige serviço externo ou banco novo |

---

## 1. Ligar o site ao CRM ✅

**Problema:** hoje um site publicado não alimenta nada. O visitante preenche, e o lead se perde.

**O que fazer:**

- O HTML gerado recebe um formulário de contato que envia para uma rota pública do NEXA AI, com a identificação do projeto embutida.
- `POST /api/public/sites/:slug/lead` cria um contato no CRM com `source = "site"` e a etiqueta do projeto.
- O formulário precisa de token e limitação de envios, senão vira alvo de spam.
- O contato entra na etapa `new_lead` e aparece no dashboard.

**Esforço:** M · **Depende de:** nenhuma peça nova, só das tabelas que já existem.

**Pronto quando:** um formulário enviado no site publicado aparece na lista de contatos em menos de um segundo.

---

## 2. Publicação com um clique ✅

**Problema:** o usuário gera o site e não consegue mostrar para ninguém.

**O que fazer:**

- O estado `published` já existe no banco, mas nada o usa.
- Duas saídas: servir o HTML pelo próprio NEXA AI em um subdomínio (`nomedoprojeto.nexa.app`) ou publicar em uma plataforma externa por API.
- O subdomínio próprio é mais simples e não depende de terceiros: uma rota que lê o HTML do banco e devolve com o `Content-Type` certo.
- Ao publicar, guardar a data e a versão publicada, para poder republicar ou voltar atrás.

**Esforço:** M a G · **Atenção:** HTML gerado por IA serve em domínio separado do painel, nunca no mesmo.

**Pronto quando:** o usuário clica em Publicar e recebe um link que abre no celular.

---

## 3. Limite de uso e controle de custo ✅

**Problema:** cada pedido no construtor por chat gera um site inteiro. Sem limite, um usuário sozinho consome o orçamento da plataforma.

**O que fazer:**

- Tabela `ai_usage` com organização, usuário, tipo, tokens e data.
- Limite diário e mensal por organização, configurável.
- Quando estourar, o backend recusa com uma mensagem clara em português, não com erro genérico.
- Um painel simples no dashboard mostrando o consumo do mês.

**Esforço:** M · **Prioridade:** alta, porque é o que protege o seu bolso.

**Pronto quando:** um usuário que atinge o limite recebe aviso antes de gastar, e o admin vê o consumo.

---

## 4. Galeria e banco de imagens

**Problema:** os sites saem sem foto, e o campo de galeria pede que o usuário cole um link que ele não tem.

**O que fazer:**

- Integração com um provedor de imagens por chave (Unsplash, Pexels) para o usuário buscar foto dentro do painel.
- O construtor por chat recebe a URL da foto escolhida e usa no HTML, respeitando a regra de nunca inventar URLs.

**Esforço:** M · **Depende de:** chave de um provedor de imagens.

---

## 5. Templates de partida

**Problema:** a tela inicial do construtor por chat está quase vazia. O usuário não sabe o que pedir e escreve pedidos vagos, que geram sites medianos.

**O que fazer:**

- Uma biblioteca de prompts prontos por segmento (barbearia, clínica, restaurante, loja).
- Cada template já traz a estrutura de seções, a paleta e o tom de voz.
- O usuário escolhe e edita, em vez de começar do zero.

**Esforço:** P · **Impacto:** grande na qualidade percebida.

---

## 6. Editor visual sobre o HTML gerado

**Problema:** o editor atual só funciona no site de template. O site gerado por chat só se edita por conversa.

**O que fazer:**

- Permitir editar textos do HTML gerado por formulário, clicando no trecho.
- Mais adiante, edição de cor primária e logo.

**Esforço:** G · **Prioridade:** baixa, o chat já cobre a maior parte.

---

## 7. Subdomínio e domínio próprio

**Problema:** o cliente final vai querer o site no domínio dele.

**O que fazer:**

- Fase um: subdomínio gratuito na plataforma.
- Fase dois: campo para o usuário informar o domínio próprio, com instrução de DNS e verificação.

**Esforço:** G · **Depende de:** a publicação pronta antes.

---

## 8. Envio real das mensagens de prospecção

**Problema:** o módulo monta e aprova a mensagem, mas não envia. A rota de envio devolve erro porque nenhum canal existe.

**O que fazer:**

- Escolher um canal e implementar de verdade: e-mail por SMTP ou provedor, ou WhatsApp Business por API oficial.
- Manter o fluxo de aprovação que já existe, porque ele combina com a lista de supressão e com a LGPD.
- Registrar o resultado de cada envio, que a tabela já tem campo para isso.

**Esforço:** G · **Atenção:** usar sempre API oficial. Disparo em massa por caminho não oficial derruba o número e viola os termos do WhatsApp.

---

## 9. Prospecção com dados reais

**Problema:** sem a chave do Google Maps, a busca devolve dados de demonstração.

**O que fazer:**

- Conectar a Places API e guardar o resultado por região e segmento, para não repetir a mesma busca.
- Deixar claro na tela quando o resultado é demonstração e quando é real.

**Esforço:** M · **Depende de:** chave do Google.

---

## 10. Banco de dados para produção

**Problema:** o SQLite em arquivo funciona bem local, mas serviços de hospedagem apagam o disco a cada reinicialização. Os dados somem.

**O que fazer:**

- Migrar para PostgreSQL antes do primeiro cliente real.
- O código já está preparado: o acesso ao banco está isolado em `db/index.ts`.
- Rodar as migrations no banco novo e revisar as consultas que usam `datetime('now')`, que muda de sintaxe.

**Esforço:** G · **Prioridade:** bloqueia o deploy.

---

## 11. Backup e exportação

**Problema:** um cliente quer os dados dele, ou você precisa restaurar depois de um problema.

**O que fazer:**

- Exportar contatos e leads em CSV pelo painel.
- Rotina de backup do banco, com instrução de restauração.

**Esforço:** P · **Confiança:** é o tipo de coisa que só se sente falta quando falta.

---

## 12. Onboarding e estado vazio

**Problema:** quem entra pela primeira vez vê telas vazias e não sabe por onde começar.

**O que fazer:**

- Uma lista de primeiros passos no dashboard: criar o primeiro site, cadastrar um contato, fazer uma busca de prospecção.
- Dados de exemplo para visualizar, marcados como demonstração.

**Esforço:** M · **Impacto:** reduz a desistência de quem está testando.

---

## 13. Desempenho e escala

**Problema:** ainda não apareceu, mas aparece quando a base crescer.

**O que fazer:**

- Fila para a geração de sites, em vez de segurar a requisição aberta.
- Paginação nas listas de contatos e leads.
- Índices para as consultas mais usadas.

**Esforço:** M · **Quando:** depois dos primeiros clientes usando.

---

## Ordem sugerida

1. Ligar o site ao CRM (item 1)
2. Limite de uso e custo (item 3)
3. Templates de partida (item 5)
4. Publicação com um clique (item 2)
5. Banco para produção (item 10), antes do primeiro cliente externo
6. Envio real de mensagens (item 8)

## Princípios que já guiam o projeto

Vale manter, porque são o que separa uma plataforma séria de um brinquedo:

- **Não inventar fato.** Nem depoimento, nem telefone, nem imagem. É regra nos dois prompts de IA.
- **Chave de API só no servidor.** Nunca no frontend, nunca no repositório.
- **HTML de IA em domínio separado**, com iframe isolado.
- **Isolamento por organização** em toda consulta ao banco.
- **Aprovação humana antes de contatar alguém**, com a lista de supressão respeitada.
