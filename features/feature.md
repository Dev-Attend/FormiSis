


Criar uma tela administrativa de Form Builder no FormiSis para `ADMIN` e `SUPER_ADMIN` gerenciarem blocos e perguntas dos questionários dinâmicos por empresa via UI.

Regras principais:
- `SUPER_ADMIN` pode escolher a empresa e gerenciar blocos/perguntas de qualquer tenant.
- `ADMIN` não escolhe empresa e gerencia apenas blocos/perguntas da própria `auth.user.companyId`.
- `COMERCIAL`, `PRE_VENDAS` e `LEITURA` não acessam essa área.
- Não confiar no frontend para isolamento multi-tenant; validar tudo no backend.
- Não fazer delete físico de blocos/perguntas; usar `active = false`.
- Ao criar pergunta, gerar `fieldId` com `toFieldId(label)`.
- Ao editar pergunta existente, não alterar `fieldId` automaticamente ao mudar o label.
- Blocos/perguntas ativos devem aparecer em `GET /api/forms/schema`.
- Blocos/perguntas inativos não devem aparecer em `GET /api/forms/schema`.

Rotas visuais:
- `/admin/questionarios`
  - `SUPER_ADMIN`: exibe seletor de empresa.
  - `ADMIN`: lista direto os blocos da própria empresa.
- `/admin/questionarios/blocos/[blockId]/perguntas`
  - lista/cria/edita/desativa perguntas do bloco.

APIs sugeridas:
- `GET /api/admin/form-blocks`
- `POST /api/admin/form-blocks`
- `PATCH /api/admin/form-blocks/[id]`
- `GET /api/admin/form-blocks/[id]/questions`
- `POST /api/admin/form-blocks/[id]/questions`
- `PATCH /api/admin/form-questions/[id]`

Funcionalidades:
- listar/criar/editar/ativar/desativar blocos;
- ordenar blocos por `order`;
- listar/criar/editar/ativar/desativar perguntas;
- ordenar perguntas por `order`;
- configurar tipo, obrigatoriedade, placeholder, texto de ajuda e opções;
- suportar tipos: `text`, `textarea`, `number`, `select`, `radio`, `checkbox`, `date`, `boolean`.

Critérios:
- usar `requireApiAccess` em todas as APIs;
- usar `db` singleton;
- usar Zod para validar body;
- usar logger Pino, sem `console.log`;
- criar `AuditLog` em mutações;
- não importar Prisma em Client Components;
- manter `rulesEngine.ts` puro;
- reutilizar componentes/padrões visuais existentes;
- criar testes Vitest para isolamento `SUPER_ADMIN`/`ADMIN`;
- rodar `npm test` e `npm run build`.

Trabalhe em etapas pequenas. Após cada etapa essencial:
1. rode testes relevantes;
2. corrija falhas;
3. faça commit com conventional commit.

Commits sugeridos:
1. `feat(admin): add tenant-scoped form block APIs`
2. `feat(admin): add tenant-scoped form question APIs`
3. `feat(admin): add questionnaire management pages`
4. `test(admin): cover form builder tenant access`
5. `chore: validate form builder build`