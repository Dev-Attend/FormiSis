# FormiSis – AI Context README

## 1. Project Identity & Context

| Campo | Detalhe |
|---|---|
| **Nome** | FormiSis |
| **Propósito** | Sistema interno de levantamento técnico-comercial para propostas de conectividade (Starlink/rádio/fibra), cobrindo qualificação de demanda → geração de documento final. |
| **Problema resolvido** | Elimina formulários manuais dispersos substituindo por um fluxo digital estruturado com validação de regras de negócio em tempo real, auditoria completa e geração de documentos técnicos. |
| **Público** | Usuários internos da Attend: Comercial, Pré-vendas, Leitura, Admin e Super Admin. |

---

## 2. Tech Stack & Environment

| Camada | Tecnologia | Versão |
|---|---|---|
| Framework | Next.js (App Router) | `16.2.4` |
| Runtime | React | `19.2.4` |
| Linguagem | TypeScript | `^5` |
| ORM | Prisma | `^6.19.3` |
| Banco de dados | SQLite (dev) | via `file:./dev.db` |
| Autenticação | JWT via `jose` | `^6.2.2` – **sem NextAuth** |
| Forms | `react-hook-form` + `@hookform/resolvers` | `^7` / `^5` |
| Validação de schema | Zod | `^4.3.6` |
| Geração de documentos | `docx` + `pdf-lib` | `^9` / `^1.17` |
| Styling | Tailwind CSS v4 | `^4` (via PostCSS) |
| Logging | Pino | `^10.3.1` |
| Testes | Vitest | `^4.1.5` |
| Porta dev | `3001` | `npm run dev` |

> **CRÍTICO:** Este projeto usa **Next.js 16** com App Router. APIs, convenções de roteamento e comportamento de Server/Client Components diferem significativamente do Next.js 13-15. Antes de escrever qualquer código Next.js, leia `node_modules/next/dist/docs/`.

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
|   |   |   `-- admin/               # CRUD usuarios, empresas e Form Builder
|   |   |-- admin/
|   |   |   |-- questionarios/       # UI do Form Builder
|   |   |   `-- usuarios/
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

### Hierarquia Administrativa / Empresas

```
SUPER_ADMIN
  -> administra a plataforma inteira
  -> pode ter companyId null
  -> cria/lista/edita/desativa empresas
  -> cria usuarios para qualquer empresa, incluindo o primeiro ADMIN de cada tenant
  -> lista usuarios de todas as empresas e pode filtrar por companyId

ADMIN
  -> administra apenas a propria empresa
  -> deve ter companyId obrigatoriamente
  -> usuarios criados por ADMIN herdam auth.user.companyId
  -> nao cria empresas e nao pode vincular usuarios a outra empresa

COMERCIAL / PRE_VENDAS / LEITURA
  -> seguem o fluxo operacional existente, sempre vinculados a uma empresa
```

Endpoints administrativos:
1. `GET/POST /api/admin/companies` - apenas `SUPER_ADMIN`.
2. `PATCH /api/admin/companies/[id]` - apenas `SUPER_ADMIN`.
3. `GET/POST /api/admin/users` - `SUPER_ADMIN` global; `ADMIN` restrito a propria empresa.
4. `PATCH /api/admin/users/[id]` - `SUPER_ADMIN` global; `ADMIN` restrito a usuarios da propria empresa.

### Questionários Dinâmicos por Empresa / Multi-tenancy

O FormiSis suporta múltiplas empresas (tenants). Cada usuário pertence a uma empresa via `User.companyId`, e o formulário carregado depende da empresa do usuário autenticado.

O mesmo bloco pode ter perguntas diferentes por empresa. Exemplo: o `bloco1` da Attend pode ter um conjunto de perguntas e o `bloco1` da V8 outro conjunto.

Novas empresas podem ter blocos e perguntas próprios por dados no banco (`Company`, `FormBlock`, `FormQuestion`) e seed/configuração, sem alteração de código-fonte para cadastrar perguntas.

O frontend não define perguntas por hard-code de tenant. O schema vem da API e a `ProposalForm` renderiza dinamicamente.

Endpoint principal:

`GET /api/forms/schema`

Fluxo do endpoint:
1. Valida sessão/perfil com `requireApiAccess`.
2. Identifica o usuário autenticado.
3. Busca a empresa vinculada ao usuário (`companyId`).
4. Consulta blocos e perguntas ativos da empresa.
5. Retorna blocos/perguntas ordenados.
6. Remove o bloco interno de pré-vendas para usuários que não são `PRE_VENDAS`, `ADMIN` ou `SUPER_ADMIN`.

Regra de isolamento:
1. Usuário da Attend recebe schema da Attend.
2. Usuário da V8 recebe schema da V8.
3. A seleção do schema é por empresa do usuário autenticado, sem `if company === "V8"` no frontend/backend para escolher perguntas.

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

### Form Builder Administrativo

1. **Objetivo da feature**: Permitir que `ADMIN` e `SUPER_ADMIN` gerenciem blocos e perguntas via interface no próprio sistema.
2. **Rotas visuais**:
   - `/admin/questionarios`: Gestão e ordenação de blocos.
   - `/admin/questionarios/blocos/[blockId]/perguntas`: Gestão e ordenação de perguntas de um bloco específico.
3. **Regras por perfil**:
   - `SUPER_ADMIN`: Pode selecionar a empresa e gerenciar blocos/perguntas de qualquer tenant.
   - `ADMIN`: Gerencia apenas blocos/perguntas da própria empresa.
   - `COMERCIAL`, `PRE_VENDAS` e `LEITURA`: Não acessam a área.
4. **Funcionalidades da tela**:
   - Listar, criar, editar, ativar/desativar e ordenar blocos.
   - Listar, criar, editar, ativar/desativar e ordenar perguntas.
   - Configurar tipo, obrigatoriedade, placeholder, texto de ajuda e opções para perguntas.
5. **Tipos de pergunta suportados**:
   - `text`, `textarea`, `number`, `select`, `radio`, `checkbox`, `date`, `boolean`.
6. **Endpoints administrativos usados**:
   - `GET /api/admin/form-blocks`
   - `POST /api/admin/form-blocks`
   - `PATCH /api/admin/form-blocks/[id]`
   - `GET /api/admin/form-blocks/[id]/questions`
   - `POST /api/admin/form-blocks/[id]/questions`
   - `PATCH /api/admin/form-questions/[id]`
7. **Regras importantes**:
   - Não há delete físico de blocos/perguntas. A desativação usa `active = false`.
   - `fieldId` é gerado automaticamente com `toFieldId(label)` ao criar a pergunta.
   - Ao editar o label de uma pergunta existente, o `fieldId` não deve ser alterado automaticamente para evitar quebra de histórico.
   - `optionsJson` e `validationJson` continuam como JSON serializado no banco.
   - Somente blocos/perguntas ativos (`active = true`) aparecem em `GET /api/forms/schema`.
   - Toda mutação relevante (criação, edição, desativação) gera `AuditLog`.

---
## 4. AI Operational Rules (Mental Model)

### Golden Rules – Leia antes de qualquer modificação

#### 🔴 ABSOLUTAS

| # | Regra |
|---|---|
| R1 | O schema por tenant vem de `FormBlock`/`FormQuestion` via `formSchemaService.ts`; `formSchema.ts` permanece como base legada/compatibilidade. IDs de campo seguem `toFieldId(label)` salvo exceções documentadas. |
| R2 | **`rulesEngine.ts` é puro** (sem side effects, sem I/O). Toda lógica condicional de campos obrigatórios e visibilidade de blocos vive aqui. Não replique regras em componentes. |
| R3 | **IDs de campo são gerados via `toFieldId(label)`** = `label.toLowerCase().replaceAll(/[^\w]+/g, "_")`. Qualquer campo cujo ID não siga esse padrão tem motivo explícito documentado no schema. |
| R4 | **Nunca use `NextAuth`**. Autenticação é JWT nativo via `jose`. Cookiename: `formsis_session`. |
| R5 | **`bloco21` (PRE_SALES_INTERNAL_BLOCK_ID) nunca aparece no payload comercial**. É adicionado explicitamente na UI/API apenas para revisores com role `PRE_VENDAS`, `ADMIN` ou `SUPER_ADMIN`. |
| R6 | **Toda API route chama `requireApiAccess(request, roles[])` antes de qualquer operação**. Retorno `{ ok: false }` deve ter `return auth.response` imediatamente. |
| R7 | **`ProposalRevision` é imutável após criação**. Nunca atualize um snapshot; crie um novo a cada persistência relevante. |
| R8 | **`adminPolicy.assertNotLastActiveAdmin()`** deve ser chamado antes de qualquer operação que rebaixe role ou desative um usuário ADMIN. |
| R9 | **Status da proposta segue FSM em `proposalWorkflow.ts`**. Não faça transições diretas no DB sem chamar `canTransition(from, to, role)`. |
| R10 | **Reabertura de proposta `FINALIZED → IN_PROGRESS` é exclusiva de `ADMIN`**. |
| R11 | **`SUPER_ADMIN` é o único perfil que pode ficar sem `companyId`**. `ADMIN`, `COMERCIAL`, `PRE_VENDAS` e `LEITURA` devem sempre estar vinculados a uma empresa ativa. |
| R12 | **APIs de empresas são exclusivas de `SUPER_ADMIN`**. Gestão de usuários aceita `SUPER_ADMIN` ou `ADMIN`, sempre respeitando escopo por empresa. |

#### 🟡 ESTILO E PADRÕES

| # | Regra |
|---|---|
| S1 | Linguagem dos comentários e strings de usuário: **Português Brasileiro**. Código (variáveis, funções, tipos): **inglês ou português sem acentos** (padrão existente). |
| S2 | Tratamento de erro em API routes: retorne `NextResponse.json({ error: "mensagem" }, { status: NNN })`. Nunca exponha stack traces. |
| S3 | **Pino** é o logger padrão (`src/lib/logger.ts`). Use `logger.info/warn/error`. Nunca use `console.log` em código de produção. |
| S4 | Classes CSS reutilizáveis: centralize em `uiClasses.ts`. Evite strings de Tailwind inline em componentes novos. |
| S5 | Campos `payloadJson` e `warningsJson` no DB são **strings JSON serializadas**, não objetos. Use `JSON.stringify/parse` explicitamente. |
| S6 | **Rate limiting** (`rateLimit.ts`) deve ser aplicado em endpoints de autenticação. |
| S7 | Preferir **Server Components** por padrão. Adicionar `"use client"` somente onde houver estado interativo ou hooks de browser. |
| S8 | `db.ts` exporta um **singleton** do Prisma Client. Nunca instancie `new PrismaClient()` diretamente em outros módulos. |

#### 🟢 ARQUITETURA

| # | Regra |
|---|---|
| A1 | Novos blocos/perguntas por empresa devem ser cadastrados no banco (`FormBlock`/`FormQuestion`) e entregues por `GET /api/forms/schema`. Evite hard-code por tenant no frontend/backend. |
| A2 | Blocos condicionalmente visíveis (`bloco12`, `bloco17`, `bloco19`) são controlados **somente** pelo `rulesEngine`. Nunca hard-code visibilidade em componente. |
| A3 | `@prisma/client` é `serverExternalPackage` (veja `next.config.ts`). Não importe Prisma em Client Components. |
| A4 | O middleware (`proxy.ts`) faz **apenas** verificação de presença do cookie. Verificação de role e validade do JWT ocorre nas API routes via `requireApiAccess`. |
| A5 | `AuditLog` deve ser criado para toda mutação de `FormSession`, `Submission`, `Company` e `User`. |

---

## 5. Core Logic Maps

### `formSchema.ts` – Mapa de Blocos

> Nota: este mapa representa o schema base legado (especialmente para compatibilidade da Attend). Em modo multi-tenant, blocos/perguntas podem variar por empresa via `FormBlock`/`FormQuestion`.

| Bloco | Tema | Visibilidade | Campos aprox. |
|---|---|---|---|
| bloco1 | Contexto da demanda | Sempre | 11 |
| bloco2 | Dados do cliente | Sempre | 18 |
| bloco3 | Localização/Site | Sempre | 18 |
| bloco4 | Objetivo da solução | Sempre | 18 |
| bloco5 | Aplicações e tráfego | Sempre | 28 |
| bloco6 | Usuários e dispositivos | Sempre | 16 |
| bloco7 | Conectividade atual | Sempre | 16 |
| bloco8 | Rede local/topologia | Sempre | 31 |
| bloco9 | Wi-Fi | Sempre | 16 |
| bloco10 | Segurança/Firewall | Sempre | 18 |
| bloco11 | VPN | Sempre | 18 |
| bloco12 | Failover/SD-WAN | **Condicional** | 14 |
| bloco13 | Infra física Starlink | Sempre | 22 |
| bloco14 | Energia/proteção | Sempre | 15 |
| bloco15 | Monitoramento | Sempre | 16 |
| bloco16 | SLA/Suporte | Sempre | 12 |
| bloco17 | Logística/mobilização | **Condicional** | 16 |
| bloco18 | Modelo comercial | Sempre | 15 |
| bloco19 | Multi-site | **Condicional** | 12 |
| bloco20 | Visita técnica | Sempre | 8 |
| bloco21 | **INTERNO Pré-vendas** | Restrito (role) | 16 |

### `rulesEngine.ts` – Gatilhos Críticos

| Condição de entrada | Efeito |
|---|---|
| `escopo_unidades > 1` | Ativa `bloco19`; `ms_qtd_total_sites` obrigatório |
| `ambiente ∈ {remoto, area de dificil acesso}` | Ativa `bloco17`; warning logístico |
| `local_remoto = sim` | Ativa `bloco17`; 14 campos logísticos obrigatórios |
| `deseja_solucao_hibrida = sim` | Ativa `bloco12`; 13 campos de integração obrigatórios |
| `failover/balanceamento/sdwan_atual = sim` | Ativa `bloco12` |
| `cliente_usa_vpn = sim` | 18 campos VPN tornam-se obrigatórios |
| `link_contingencia_critica = sim` | 4 campos energia/SLA obrigatórios; warnings críticos |
| `VoIP = sim` | `ha_necessidade_de_qos` obrigatório e deve ser `sim` |
| `modelo_oferta ∈ {locacao, servico gerenciado}` | `ha_mensalidade_recorrente = sim` obrigatório |
| `urgencia ∈ {urgente, emergencial}` | `justificativa_urgencia` obrigatório |
| `data_desejada_implantacao ≤ 15 dias` + alta complexidade | Warning de risco logístico |
| `horario_suporte_desejado = 24x7` | Warning: aprovação por alçada obrigatória |

### `proposalWorkflow.ts` – FSM de Status

```
DRAFT ──────→ IN_PROGRESS → PAUSED ──┐
  │                │                  │
  └──────→ FINALIZED ←────────────────┘
               │ (ADMIN only: → IN_PROGRESS)
               ↓
           ARCHIVED (terminal)
```

### `auth.ts` – Funções Exportadas

| Função | Contexto de uso |
|---|---|
| `signSession(payload)` | API route de login |
| `buildSessionCookie(token)` | Header `Set-Cookie` no login |
| `clearSessionCookie()` | Header `Set-Cookie` no logout |
| `requireApiAccess(req, roles[])` | **Toda** API route protegida; `SUPER_ADMIN` herda acesso quando `ADMIN` é permitido |
| `getServerSessionUser()` | Server Components e layouts |

---

## 6. Database Schema (Resumo)

```
Company { id, name, slug, active, createdAt, updatedAt }
  -> slug unico (tenant)
  -> 1:N com User
  -> 1:N com FormBlock

User { id, name, email, passwordHash, role: UserRole, companyId?, active, createdAt, updatedAt }
  -> UserRole: SUPER_ADMIN | ADMIN | COMERCIAL | PRE_VENDAS | LEITURA
  -> companyId referencia Company (isolamento por tenant)
  -> companyId null permitido apenas para SUPER_ADMIN

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
# 1. Copiar variáveis de ambiente
cp .env.example .env

# 2. Instalar dependências
npm install

# 3. Aplicar migrações e popular DB
npx prisma migrate deploy
npm run db:seed

# 4. Rodar em desenvolvimento (porta 3001)
npm run dev

# 5. Testes unitários
npm test

# 6. Prisma Studio (opcional)
npx prisma studio
```

### Variáveis de Ambiente Obrigatórias

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | `file:./dev.db` (SQLite) |
| `AUTH_SECRET` | Segredo HMAC do JWT (mín. 32 chars) |
| `AUTH_SECURE_COOKIES` | `0` (dev) / `1` (HTTPS prod) |
| `FORMSIS_ADMIN_EMAIL` | Email do SUPER_ADMIN semeado |
| `FORMSIS_ADMIN_PASSWORD` | Senha do SUPER_ADMIN semeado |
| `LOG_LEVEL` | `info` \| `debug` \| `warn` \| `error` |

---

## 8. Known Constraints & Pitfalls

| Item | Detalhe |
|---|---|
| SQLite em produção | Banco de arquivo único; não suporta múltiplos escritores concorrentes. Migrar para PostgreSQL antes de múltiplos usuários simultâneos em prod. |
| `@prisma/client` no Edge | Não funciona em Edge Runtime. Todas as rotas que usam Prisma devem ser `nodejs` runtime. |
| `bloco21` visibilidade | O middleware **não** bloqueia rotas de UI para roles. O controle de exibição do bloco 21 é feito na UI (`PRE_SALES_INTERNAL_BLOCK_ID`) e na API. Não confiar apenas no middleware para RBAC. |
| Bootstrap administrativo | A seed inicial cria apenas um `SUPER_ADMIN` sem empresa. O primeiro `ADMIN` de cada empresa deve ser criado pelo `SUPER_ADMIN`. |
| Form Builder | A exclusão física de blocos e perguntas não é permitida para não quebrar o histórico de propostas antigas (snapshot). Use a desativação (`active = false`). O isolamento de tenant é garantido na UI e API. |
| `payloadJson` tamanho | Formulário completo tem ~500 campos. `payloadJson` pode ultrapassar 50 KB. Validar limites se migrar para Postgres. |
| Rate limiter | Implementação in-memory (`rateLimit.ts`). Não persiste entre reinicializações e não funciona em ambiente multi-instância. |
| Geração de documentos | `docx` e `pdf-lib` são operações síncronas e pesadas. Não executar dentro de Server Actions sem análise de timeout. |
