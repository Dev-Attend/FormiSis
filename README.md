# FormiSis â€” AI Context README

## 1. Project Identity & Context

| Campo | Detalhe |
|---|---|
| **Nome** | FormiSis |
| **PropÃ³sito** | Sistema interno de levantamento tÃ©cnico-comercial para propostas de conectividade (Starlink/rÃ¡dio/fibra), cobrindo qualificaÃ§Ã£o de demanda â†’ geraÃ§Ã£o de documento final. |
| **Problema resolvido** | Elimina formulÃ¡rios manuais dispersos substituindo por um fluxo digital estruturado com validaÃ§Ã£o de regras de negÃ³cio em tempo real, auditoria completa e geraÃ§Ã£o de documentos tÃ©cnicos. |
| **PÃºblico** | UsuÃ¡rios internos da Attend: Comercial, PrÃ©-vendas, Leitura, Admin. |

---

## 2. Tech Stack & Environment

| Camada | Tecnologia | VersÃ£o |
|---|---|---|
| Framework | Next.js (App Router) | `16.2.4` |
| Runtime | React | `19.2.4` |
| Linguagem | TypeScript | `^5` |
| ORM | Prisma | `^6.19.3` |
| Banco de dados | SQLite (dev) | via `file:./dev.db` |
| AutenticaÃ§Ã£o | JWT via `jose` | `^6.2.2` â€” **sem NextAuth** |
| Forms | `react-hook-form` + `@hookform/resolvers` | `^7` / `^5` |
| ValidaÃ§Ã£o de schema | Zod | `^4.3.6` |
| GeraÃ§Ã£o de documentos | `docx` + `pdf-lib` | `^9` / `^1.17` |
| Styling | Tailwind CSS v4 | `^4` (via PostCSS) |
| Logging | Pino | `^10.3.1` |
| Testes | Vitest | `^4.1.5` |
| Porta dev | `3001` | `npm run dev` |

> **CRÃTICO:** Este projeto usa **Next.js 16** com App Router. APIs, convenÃ§Ãµes de roteamento e comportamento de Server/Client Components diferem significativamente do Next.js 13-15. Antes de escrever qualquer cÃ³digo Next.js, leia `node_modules/next/dist/docs/`.

---

## 3. Core Architecture

### Estrutura de Diretorios

```
FormiSis/
|-- src/
|   |-- app/                          # Next.js App Router
|   |   |-- api/
|   |   |   |-- auth/                # POST /login, POST /logout, GET /me
|   |   |   |-- forms/               # GET/POST /forms, /forms/[id], GET /forms/schema
|   |   |   |-- document/            # POST gera DOCX/PDF
|   |   |   |-- submissions/         # GET /submissions
|   |   |   `-- admin/               # CRUD usuarios (ADMIN)
|   |   |-- admin/
|   |   |-- dashboard/
|   |   |-- login/
|   |   |-- pre-vendas/
|   |   |-- propostas/
|   |   `-- submissoes/
|   |-- components/
|   |   |-- ProposalForm.tsx
|   |   |-- AppShell.tsx
|   |   |-- AppCard.tsx
|   |   `-- PageHeader.tsx
|   |-- lib/
|   |   |-- auth.ts                  # JWT + requireApiAccess
|   |   |-- db.ts                    # Prisma singleton
|   |   |-- formSchema.ts            # Schema legado/base (compatibilidade)
|   |   |-- formSchemaService.ts     # Carrega schema dinamico por empresa
|   |   |-- formSchemaAdapter.ts     # Adapter schema dinamico <-> ProposalForm
|   |   |-- rulesEngine.ts           # Regras puras de visibilidade/obrigatoriedade
|   |   |-- proposalWorkflow.ts
|   |   |-- proposalPersistence.ts
|   |   |-- preSalesMeta.ts
|   |   |-- preSalesValidationMap.ts
|   |   `-- rateLimit.ts
|   `-- proxy.ts                     # Middleware de presenca de cookie
|-- prisma/
|   |-- schema.prisma
|   |-- seed.mjs
|   `-- migrations/
`-- scripts/
```

### Fluxo de Dados Principal

```
Browser (ProposalForm)
  -> GET /api/forms/schema
  -> schema por empresa (company + blocks + questions)
  -> renderizacao dinamica dos campos com react-hook-form
  -> rulesEngine.avaliarRegras(data)
  -> POST/PATCH /api/forms (payloadJson/warningsJson serializados)
  -> POST /api/document (DOCX/PDF)
  -> AuditLog em mutacoes relevantes
```

### Modelo de Autenticacao

```
POST /api/auth/login
  -> bcryptjs.compare(password, hash)
  -> signSession() -> JWT HS256 (8h)
  -> Set-Cookie: formsis_session (HttpOnly, SameSite=Lax)

proxy.ts
  -> valida apenas presenca do cookie em rotas protegidas

requireApiAccess(request, allowedRoles[])
  -> valida JWT, usuario ativo e role permitida
```

### Questionarios Dinamicos por Empresa / Multi-tenancy

O FormiSis suporta multiplas empresas (tenants). Cada usuario pertence a uma empresa via `User.companyId`, e o formulario carregado depende da empresa do usuario autenticado.

O mesmo bloco pode ter perguntas diferentes por empresa. Exemplo: o `bloco1` da Attend pode ter um conjunto de perguntas e o `bloco1` da V8 outro conjunto.

Novas empresas podem ter blocos e perguntas proprios por dados no banco (`Company`, `FormBlock`, `FormQuestion`) e seed/configuracao, sem alteracao de codigo-fonte para cadastrar perguntas.

O frontend nao define perguntas por hard-code de tenant. O schema vem da API e a `ProposalForm` renderiza dinamicamente.

Endpoint principal:

`GET /api/forms/schema`

Fluxo do endpoint:
1. Valida sessao/perfil com `requireApiAccess`.
2. Identifica o usuario autenticado.
3. Busca a empresa vinculada ao usuario (`companyId`).
4. Consulta blocos e perguntas ativos da empresa.
5. Retorna blocos/perguntas ordenados.
6. Remove o bloco interno de pre-vendas para usuarios que nao sao `PRE_VENDAS` ou `ADMIN`.

Regra de isolamento:
1. Usuario da Attend recebe schema da Attend.
2. Usuario da V8 recebe schema da V8.
3. A selecao do schema e por empresa do usuario autenticado, sem `if company === "V8"` no frontend/backend para escolher perguntas.

Exemplo de resposta JSON:

```json
{
  "company": {
    "id": "company_id",
    "name": "Attend",
    "slug": "attend"
  },
  "blocks": [
    {
      "id": "block_id",
      "key": "bloco1",
      "title": "Contexto da demanda",
      "description": "Informacoes iniciais da oportunidade",
      "order": 1,
      "questions": [
        {
          "id": "question_id",
          "fieldId": "nome_do_cliente",
          "label": "Nome do cliente",
          "type": "text",
          "required": true,
          "placeholder": "Informe o nome do cliente",
          "options": [],
          "validation": {}
        }
      ]
    }
  ]
}
```

---
## 4. AI Operational Rules (Mental Model)

### Golden Rules â€” Leia antes de qualquer modificaÃ§Ã£o

#### ðŸ”´ ABSOLUTAS

| # | Regra |
|---|---|
| R1 | O schema por tenant vem de `FormBlock`/`FormQuestion` via `formSchemaService.ts`; `formSchema.ts` permanece como base legada/compatibilidade. IDs de campo seguem `toFieldId(label)` salvo excecoes documentadas. |
| R2 | **`rulesEngine.ts` Ã© puro** (sem side effects, sem I/O). Toda lÃ³gica condicional de campos obrigatÃ³rios e visibilidade de blocos vive aqui. NÃ£o replique regras em componentes. |
| R3 | **IDs de campo sÃ£o gerados via `toFieldId(label)`** = `label.toLowerCase().replaceAll(/[^\w]+/g, "_")`. Qualquer campo cujo ID nÃ£o siga esse padrÃ£o tem motivo explÃ­cito documentado no schema. |
| R4 | **Nunca use `NextAuth`**. AutenticaÃ§Ã£o Ã© JWT nativo via `jose`. Cookiename: `formsis_session`. |
| R5 | **`bloco21` (PRE_SALES_INTERNAL_BLOCK_ID) nunca aparece no payload comercial**. Ã‰ adicionado explicitamente na UI/API apenas para revisores com role `PRE_VENDAS` ou `ADMIN`. |
| R6 | **Toda API route chama `requireApiAccess(request, roles[])` antes de qualquer operaÃ§Ã£o**. Retorno `{ ok: false }` deve ter `return auth.response` imediatamente. |
| R7 | **`ProposalRevision` Ã© imutÃ¡vel apÃ³s criaÃ§Ã£o**. Nunca atualize um snapshot; crie um novo a cada persistÃªncia relevante. |
| R8 | **`adminPolicy.assertNotLastActiveAdmin()`** deve ser chamado antes de qualquer operaÃ§Ã£o que rebaixe role ou desative um usuÃ¡rio ADMIN. |
| R9 | **Status da proposta segue FSM em `proposalWorkflow.ts`**. NÃ£o faÃ§a transiÃ§Ãµes diretas no DB sem chamar `canTransition(from, to, role)`. |
| R10 | **Reabertura de proposta `FINALIZED â†’ IN_PROGRESS` Ã© exclusiva de `ADMIN`**. |

#### ðŸŸ¡ ESTILO E PADRÃ•ES

| # | Regra |
|---|---|
| S1 | Linguagem dos comentÃ¡rios e strings de usuÃ¡rio: **PortuguÃªs Brasileiro**. CÃ³digo (variÃ¡veis, funÃ§Ãµes, tipos): **inglÃªs ou portuguÃªs sem acentos** (padrÃ£o existente). |
| S2 | Tratamento de erro em API routes: retorne `NextResponse.json({ error: "mensagem" }, { status: NNN })`. Nunca exponha stack traces. |
| S3 | **Pino** Ã© o logger padrÃ£o (`src/lib/logger.ts`). Use `logger.info/warn/error`. Nunca use `console.log` em cÃ³digo de produÃ§Ã£o. |
| S4 | Classes CSS reutilizÃ¡veis: centralize em `uiClasses.ts`. Evite strings de Tailwind inline em componentes novos. |
| S5 | Campos `payloadJson` e `warningsJson` no DB sÃ£o **strings JSON serializadas**, nÃ£o objetos. Use `JSON.stringify/parse` explicitamente. |
| S6 | **Rate limiting** (`rateLimit.ts`) deve ser aplicado em endpoints de autenticaÃ§Ã£o. |
| S7 | Preferir **Server Components** por padrÃ£o. Adicionar `"use client"` somente onde houver estado interativo ou hooks de browser. |
| S8 | `db.ts` exporta um **singleton** do Prisma Client. Nunca instancie `new PrismaClient()` diretamente em outros mÃ³dulos. |

#### ðŸŸ¢ ARQUITETURA

| # | Regra |
|---|---|
| A1 | Novos blocos/perguntas por empresa devem ser cadastrados no banco (`FormBlock`/`FormQuestion`) e entregues por `GET /api/forms/schema`. Evite hard-code por tenant no frontend/backend. |
| A2 | Blocos condicionalmente visÃ­veis (`bloco12`, `bloco17`, `bloco19`) sÃ£o controlados **somente** pelo `rulesEngine`. Nunca hard-code visibilidade em componente. |
| A3 | `@prisma/client` Ã© `serverExternalPackage` (veja `next.config.ts`). NÃ£o importe Prisma em Client Components. |
| A4 | O middleware (`proxy.ts`) faz **apenas** verificaÃ§Ã£o de presenÃ§a do cookie. VerificaÃ§Ã£o de role e validade do JWT ocorre nas API routes via `requireApiAccess`. |
| A5 | `AuditLog` deve ser criado para toda mutaÃ§Ã£o de `FormSession`, `Submission` e `User`. |

---

## 5. Core Logic Maps

### `formSchema.ts` â€” Mapa de Blocos

> Nota: este mapa representa o schema base legado (especialmente para compatibilidade da Attend). Em modo multi-tenant, blocos/perguntas podem variar por empresa via `FormBlock`/`FormQuestion`.

| Bloco | Tema | Visibilidade | Campos aprox. |
|---|---|---|---|
| bloco1 | Contexto da demanda | Sempre | 11 |
| bloco2 | Dados do cliente | Sempre | 18 |
| bloco3 | LocalizaÃ§Ã£o/Site | Sempre | 18 |
| bloco4 | Objetivo da soluÃ§Ã£o | Sempre | 18 |
| bloco5 | AplicaÃ§Ãµes e trÃ¡fego | Sempre | 28 |
| bloco6 | UsuÃ¡rios e dispositivos | Sempre | 16 |
| bloco7 | Conectividade atual | Sempre | 16 |
| bloco8 | Rede local/topologia | Sempre | 31 |
| bloco9 | Wi-Fi | Sempre | 16 |
| bloco10 | SeguranÃ§a/Firewall | Sempre | 18 |
| bloco11 | VPN | Sempre | 18 |
| bloco12 | Failover/SD-WAN | **Condicional** | 14 |
| bloco13 | Infra fÃ­sica Starlink | Sempre | 22 |
| bloco14 | Energia/proteÃ§Ã£o | Sempre | 15 |
| bloco15 | Monitoramento | Sempre | 16 |
| bloco16 | SLA/Suporte | Sempre | 12 |
| bloco17 | LogÃ­stica/mobilizaÃ§Ã£o | **Condicional** | 16 |
| bloco18 | Modelo comercial | Sempre | 15 |
| bloco19 | Multi-site | **Condicional** | 12 |
| bloco20 | Visita tÃ©cnica | Sempre | 8 |
| bloco21 | **INTERNO PrÃ©-vendas** | Restrito (role) | 16 |

### `rulesEngine.ts` â€” Gatilhos CrÃ­ticos

| CondiÃ§Ã£o de entrada | Efeito |
|---|---|
| `escopo_unidades > 1` | Ativa `bloco19`; `ms_qtd_total_sites` obrigatÃ³rio |
| `ambiente âˆˆ {remoto, area de dificil acesso}` | Ativa `bloco17`; warning logÃ­stico |
| `local_remoto = sim` | Ativa `bloco17`; 14 campos logÃ­sticos obrigatÃ³rios |
| `deseja_solucao_hibrida = sim` | Ativa `bloco12`; 13 campos de integraÃ§Ã£o obrigatÃ³rios |
| `failover/balanceamento/sdwan_atual = sim` | Ativa `bloco12` |
| `cliente_usa_vpn = sim` | 18 campos VPN tornam-se obrigatÃ³rios |
| `link_contingencia_critica = sim` | 4 campos energia/SLA obrigatÃ³rios; warnings crÃ­ticos |
| `VoIP = sim` | `ha_necessidade_de_qos` obrigatÃ³rio e deve ser `sim` |
| `modelo_oferta âˆˆ {locacao, servico gerenciado}` | `ha_mensalidade_recorrente = sim` obrigatÃ³rio |
| `urgencia âˆˆ {urgente, emergencial}` | `justificativa_urgencia` obrigatÃ³rio |
| `data_desejada_implantacao â‰¤ 15 dias` + alta complexidade | Warning de risco logÃ­stico |
| `horario_suporte_desejado = 24x7` | Warning: aprovaÃ§Ã£o por alÃ§ada obrigatÃ³ria |

### `proposalWorkflow.ts` â€” FSM de Status

```
DRAFT â”€â”€â”€â”€â”€â”€â†’ IN_PROGRESS â†’ PAUSED â”€â”€â”
  â”‚                â”‚                  â”‚
  â””â”€â”€â”€â”€â”€â”€â†’ FINALIZED â†â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
               â”‚ (ADMIN only: â†’ IN_PROGRESS)
               â†“
           ARCHIVED (terminal)
```

### `auth.ts` â€” FunÃ§Ãµes Exportadas

| FunÃ§Ã£o | Contexto de uso |
|---|---|
| `signSession(payload)` | API route de login |
| `buildSessionCookie(token)` | Header `Set-Cookie` no login |
| `clearSessionCookie()` | Header `Set-Cookie` no logout |
| `requireApiAccess(req, roles[])` | **Toda** API route protegida |
| `getServerSessionUser()` | Server Components e layouts |

---

## 6. Database Schema (Resumo)

```
Company { id, name, slug, active, createdAt, updatedAt }
  -> slug unico (tenant)
  -> 1:N com User
  -> 1:N com FormBlock

User { id, name, email, passwordHash, role: UserRole, companyId?, active, createdAt, updatedAt }
  -> UserRole: ADMIN | COMERCIAL | PRE_VENDAS | LEITURA
  -> companyId referencia Company (isolamento por tenant)

FormBlock { id, companyId, blockKey, title, description?, order, active, createdAt, updatedAt }
  -> unico por tenant em (companyId, blockKey)
  -> 1:N com FormQuestion

FormQuestion { id, blockId, fieldId, label, type, placeholder?, helpText?,
               requiredDefault, optionsJson?, validationJson?, order, active, createdAt, updatedAt }
  -> unico por bloco em (blockId, fieldId)

FormSession { id, title, status: FormStatus, clientName?, opportunityRef?,
              revision, payloadJson, warningsJson, finalDocument?,
              createdById -> User }
  -> FormStatus: DRAFT | IN_PROGRESS | PAUSED | FINALIZED | ARCHIVED
  -> payloadJson/warningsJson permanecem JSON serializado em string
  -> indices: (createdById, updatedAt), (status, updatedAt)

Submission { id, internalName, payloadJson, warningsJson, generatedDoc,
             generatedAt, createdById -> User }

ProposalRevision { id, formSessionId -> FormSession (Cascade),
                   status, payloadJson, warningsJson, note?, createdById -> User }
  -> Snapshot imutavel; @@index(formSessionId, createdAt)

AuditLog { id, action, resourceType, resourceId, detailsJson,
           userId -> User, submissionId?, formSessionId? }
  -> @@index(formSessionId, createdAt)
```

---
## 7. Setup & Execution

```bash
# 1. Copiar variÃ¡veis de ambiente
cp .env.example .env

# 2. Instalar dependÃªncias
npm install

# 3. Aplicar migraÃ§Ãµes e popular DB
npx prisma migrate deploy
npm run db:seed

# 4. Rodar em desenvolvimento (porta 3001)
npm run dev

# 5. Testes unitÃ¡rios
npm test

# 6. Prisma Studio (opcional)
npx prisma studio
```

### VariÃ¡veis de Ambiente ObrigatÃ³rias

| VariÃ¡vel | DescriÃ§Ã£o |
|---|---|
| `DATABASE_URL` | `file:./dev.db` (SQLite) |
| `AUTH_SECRET` | Segredo HMAC do JWT (mÃ­n. 32 chars) |
| `AUTH_SECURE_COOKIES` | `0` (dev) / `1` (HTTPS prod) |
| `FORMSIS_ADMIN_EMAIL` | Email do admin semeado |
| `FORMSIS_ADMIN_PASSWORD` | Senha do admin semeado |
| `LOG_LEVEL` | `info` \| `debug` \| `warn` \| `error` |

---

## 8. Known Constraints & Pitfalls

| Item | Detalhe |
|---|---|
| SQLite em produÃ§Ã£o | Banco de arquivo Ãºnico; nÃ£o suporta mÃºltiplos escritores concorrentes. Migrar para PostgreSQL antes de mÃºltiplos usuÃ¡rios simultÃ¢neos em prod. |
| `@prisma/client` no Edge | NÃ£o funciona em Edge Runtime. Todas as rotas que usam Prisma devem ser `nodejs` runtime. |
| `bloco21` visibilidade | O middleware **nÃ£o** bloqueia rotas de UI para roles. O controle de exibiÃ§Ã£o do bloco 21 Ã© feito na UI (`PRE_SALES_INTERNAL_BLOCK_ID`) e na API. NÃ£o confiar apenas no middleware para RBAC. |
| `payloadJson` tamanho | FormulÃ¡rio completo tem ~500 campos. `payloadJson` pode ultrapassar 50 KB. Validar limites se migrar para Postgres. |
| Rate limiter | ImplementaÃ§Ã£o in-memory (`rateLimit.ts`). NÃ£o persiste entre reinicializaÃ§Ãµes e nÃ£o funciona em ambiente multi-instÃ¢ncia. |
| GeraÃ§Ã£o de documentos | `docx` e `pdf-lib` sÃ£o operaÃ§Ãµes sÃ­ncronas e pesadas. NÃ£o executar dentro de Server Actions sem anÃ¡lise de timeout. |




