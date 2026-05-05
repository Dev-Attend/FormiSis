# Revisão de fluxos e erros — FormSis (`formsis-app`)

**Data da revisão:** 2026-05-04  
**Escopo:** aplicação Next.js (App Router), APIs em `src/app/api`, componentes em `src/components`, regras em `src/lib`.

**Verificações executadas**

- `npm run test` (Vitest) — **OK** (5 testes em 2 ficheiros).
- `npm run lint` (ESLint) — **OK com avisos** (4 `no-unused-vars` em `ProposalForm.tsx`).
- `npx tsc --noEmit` — **OK**.
- `npm run build` (Next.js) — **OK** (última execução na sessão de desenvolvimento).
- Leitura dirigida de fluxos: autenticação, propostas (`/api/forms`), pré-vendas (`PATCH` + UI), geração de documentos (`/api/document`), motor de regras.

---

## O que foi corrigido (estado atual do código)

Estes itens estão **implementados no repositório**; descrevem causas reais de falha ou inconsistência que foram endereçadas ao longo da evolução do projeto (incluindo a sessão recente).

| Área | Problema | Correção resumida |
|------|-----------|-------------------|
| **PDF / documento** | `pdfkit` lia ficheiros `.afm` em `node_modules` (`Helvetica.afm`), quebrando com bundling / caminhos (`ENOENT`, ex.: `C:\ROOT\node_modules\...`). | Geração de PDF passou a **`pdf-lib`** (`src/lib/generateTechnicalPdf.ts`), sem dependência de ficheiros externos no disco. Teste unitário com cabeçalho `%PDF-`. |
| **API `POST /api/document`** | Bloqueio por regras mesmo com proposta já **FINALIZED** / re-download; conflitos de revisão desnecessários em sessão terminal; corpo JSON inválido sem resposta clara. | Sessões **FINALIZED** e **ARCHIVED** tratadas como terminais: sem re-finalização, sem bloqueio por `allErrors` nesse modo; **sem verificação de revisão** em sessão terminal; validação de `data`; `try/catch` com JSON 500. |
| **Cliente — geração documento** | Mensagem genérica “Falha na geração…” quando a resposta não era JSON. | `ProposalForm`: lê `res.text()`, tenta JSON, senão mostra HTTP + excerto; `credentials: "same-origin"`. |
| **Motor de regras** | `ha_restricao_de_nat_cgnat` bloqueava fluxo como **erro** após parecer / finalização. | Regra passou a **aviso** (`rulesEngine.ts` + teste ajustado). |
| **Bloco 21 (interno pré-vendas)** | `visibleBlocks` em `avaliarRegras` só incluía `bloco1`–`bloco20`; o **bloco 21** existia no schema mas **nunca aparecia** na UI de pré-vendas nem na validação coerente. | Constante `PRE_SALES_INTERNAL_BLOCK_ID`; UI (`ProposalForm`, página de validação) acrescenta o bloco para **PRE_VENDAS / ADMIN / `preSalesReview`**; `listMissingRequiredFields` com `excludeBlockIds` / `extraRequiredBlockIds`; envio à fila **exclui** bloco 21 para o comercial; **aprovação** **exige** preenchimento do bloco 21; `getVisibleFieldIds` com opção em aprovação. |
| **Build / SSR** | `useSearchParams` em páginas prerendered gerava erro de build / Suspense. | Leitura de query via `window.location.search` em `useEffect` em várias páginas (com comentários eslint onde aplicável). |
| **Pré-vendas ↔ comercial** | Ajustes (`CHANGES_REQUESTED`) pouco visíveis; envio com dados que travavam o pré-vendas. | Fluxo com `requestedFieldIds`, checklist, validação mapeada por campos visíveis, modo `preSalesReview` no formulário, etc. |
| **`rulesEngine` — robustez** | Crash com `toLowerCase` em valor indefinido (`link_principal_ou_complementar`). | Uso defensivo `String(... ?? "")`. |

---

## O que não foi corrigido (pendências, riscos ou fora de âmbito)

Estes pontos **não foram alterados** nesta revisão ou continuam como **dívida técnica / limitação conhecida**.

| Item | Gravidade | Notas |
|------|------------|--------|
| **Avisos ESLint** (`ProposalForm.tsx`: `labelCompactClass`, `etapaPreVendasPt`, `statusPropostaPt`, `backHref` não usados) | Baixa | Não quebra build; polui lint e pode confundir manutenção. |
| **Cobertura de testes** | Média | Apenas `rulesEngine.test.ts` e `generateTechnicalPdf.test.ts`. **Sem** testes de integração para `PATCH /api/forms`, login, pré-vendas ou UI. |
| **`rateLimit` em memória** (`src/lib/rateLimit.ts`) | Média (produção) | Não partilhado entre instâncias; reinício do processo zera contadores. |
| **Aviso Next.js — `middleware` deprecated** | Baixa | Build sugere migração para convenção `proxy`; comportamento atual ainda funciona. |
| **Cookie `Secure` em `next start` (produção)** | Baixa (dev) | Chamadas **HTTP** a APIs autenticadas podem falhar se o cliente não enviar cookie; esperado em HTTPS ou `next dev`. |
| **Perfil `LEITURA` e bloco 21** | Baixa | No `ProposalForm`, o bloco interno é mostrado para PRE_VENDAS/ADMIN/`preSalesReview`; **LEITURA** não foi incluído explicitamente (pode não ver o bloco 21 na mesma UI). |
| **Base SQLite** | Contextual | Concorrência elevada pode gerar `database is locked`; não há fila de escrita nem Postgres neste pacote. |
| **Conteúdo DOCX/PDF** | Funcional | PDF é texto simples (Helvetica standard); documentos muito longos ou caracteres fora de WinAnsi podem ser substituídos por `?` na função segura do PDF. |
| **Auditoria manual de UX** | — | Não foi feito teste E2E no browser (login, filas, todos os estados de proposta) nesta revisão documental. |

---

## Resumo executivo

- **Fluxos principais** (criar/editar proposta, pré-vendas, finalizar, gerar DOCX/PDF) encontram-se **consistentes com o código atual** e com **build + tipos + testes unitários existentes a passar**.
- As **falhas mais graves** tratadas na evolução recente foram: **geração de PDF inoperante** (pdfkit/`ENOENT`), **bloqueios falsos de documento** em propostas terminadas, e **ausência do bloco 21** no fluxo de pré-vendas por causa de `visibleBlocks` só até ao bloco 20.
- O maior **gap restante** para “revisão completa” ao nível de produção é **cobertura de testes e testes E2E**, não a deteção de erros de sintaxe ou de tipo.

---

*Ficheiro gerado para auditoria interna. Atualizar quando forem corrigidos itens da secção “não corrigido”.*
