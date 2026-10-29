# Configuração Supabase e autenticação

## Estado verificado

Projeto de desenvolvimento: `catapimba`, referência `sahxhhbpagnygnpjtfxz`, região
São Paulo (`sa-east-1`), organização `gustavorosario721` no plano Free.

A migration `20261025130235_identity_foundation.sql` foi aplicada pela conexão
Supabase e está registrada no histórico remoto. O arquivo foi criado inicialmente
pela CLI; seu prefixo foi alinhado à versão efetivamente registrada pelo servidor.
Não reaplicar manualmente a migration em um banco que já a possui.

As migrations seguintes acrescentam instituições administráveis, projetos, equipes,
critérios, bancas e avaliações. O histórico está em `supabase/migrations`. Não execute
resets nem reaplique migrations já registradas. Fixtures vivem apenas em `supabase/tests`
e são desfeitas por rollback.
`supabase/tests/identity-rls.sql` executa fixtures temporárias com rollback e verifica
RLS sob os papéis PostgreSQL `authenticated` e `anon`. Isso testa as políticas no
banco real; não equivale a concluir uma autenticação Google ponta a ponta.

A validação anterior do advisor registrou RLS sem políticas em `private.audit_events`
e proteção contra senhas vazadas desabilitada no Auth (o aplicativo usa Google).
O aviso sobre auditoria é intencional: a tabela de auditoria é privada,
sem grants aos clientes e sem leitura/escrita pública.
[Descrição do aviso](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

## Rotas desta entrega

- `/login`: entrada Google, sem seletor de identidade fictícia.
- `/auth/callback`: conclusão PKCE e tratamento de acesso cancelado/incompleto.
- `/conta` e `/app/*`: módulos reais conforme os vínculos e as capacidades da pessoa.
- `/solicitar-acesso`: instruções, sem envio; solicitação real fica em `/app/access`.
- `/recuperar-senha`: orientação para recuperação Google, sem senha própria.
- `/api/auth/me`: valida o bearer token com Supabase Auth e consulta vínculos pela
  Data API com o mesmo JWT. Sem token/malformado: 401. Configuração ou serviço
  indisponível: 503. Respostas usam `Cache-Control: no-store`.

`/instituicao` e os outros endereços antigos encaminham para módulos reais, com
verificação de sessão. Não há seletor de identidades, login simulado ou dados
fictícios no aplicativo.

## Ativação Google — ação no painel

Após a configuração pelo responsável, `/auth/v1/settings` confirmou
`external.google = true`. O usuário confirmou o login Google no preview e apresentou
a tela Minha conta com a identidade validada pela API. O logout/relogin ainda
depende de confirmação explícita do usuário.
A conexão Supabase disponível não inclui alteração das credenciais do provedor.
A entrada real já foi observada; as instruções abaixo documentam a configuração.

1. Abra o [projeto Supabase](https://supabase.com/dashboard/project/sahxhhbpagnygnpjtfxz).
2. Em Authentication, abra os provedores de login e selecione Google.
3. Crie/configure um cliente OAuth do tipo aplicação web no Google Cloud, com a tela
   de consentimento. Se o aplicativo Google estiver em modo de teste, inclua as
   contas que participarão do teste, conforme os requisitos exibidos pelo Google.
4. Cadastre no cliente Google o callback Supabase:
   `https://sahxhhbpagnygnpjtfxz.supabase.co/auth/v1/callback`.
5. Cole Client ID e Client Secret diretamente no painel Supabase e habilite Google.
   Não versionar, imprimir em logs nem enviar essas credenciais no chat.
6. Em URL Configuration do Supabase, configure Site URL e a allowlist de retorno
   usando a URL estável do preview desta branch (confirmar no deploy) e o caminho
   `/auth/callback`. Para desenvolvimento, permitir também
   `http://localhost:5173/auth/callback`. Evite um wildcard geral `*.vercel.app`.
7. Abra `/login`, entre com Google, confirme `/conta`, saia e verifique que a conta
   deixa de ser exibida. Teste também cancelamento e uma sessão inválida na API.

Não conceder privilégio administrativo a quem completar esse fluxo. A conta sem vínculos pode solicitar acesso em Meus acessos. A solicitação fica pendente
até aprovação. Papéis institucionais são atribuídos pela gestão autorizada; somente
o superadministrador nomeia administradores institucionais.

## Variáveis e execução local

No frontend Vercel, configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` e `VITE_API_URL`. No backend Render, configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `FRONTEND_ORIGINS`. A chave Supabase utilizada é publicável, não administrativa.

Os exemplos ficam em `apps/web/.env.example` e `apps/api/.env.example`. O Vite lê o `.env.local` do frontend. Para a API local, compile com `pnpm run build:api` e execute `PORT=3001 node --env-file=apps/api/.env.local apps/api/dist/index.mjs` na raiz. Nenhuma conexão privilegiada Postgres é necessária para `/api/auth/me`.

Não usar `DATABASE_URL` ou a service-role para simular acesso de um usuário.
Não executar `drizzle-kit push` em paralelo com as migrations SQL desta fundação.

## Bootstrap restrito

Após a primeira entrada real, identificar o UUID correto em Authentication/Users.
O arquivo `supabase/bootstrap-superadmin.sql` é um procedimento de operador via
psql com conexão privilegiada, nunca um endpoint público. Exige UUID explícito,
não reativa concessões revogadas e registra uma nova concessão na auditoria.
O primeiro bootstrap foi executado em 25/10/2026, após autorização do responsável
e verificação da conta Google confirmada. A concessão por UUID e o evento de
auditoria foram gravados na mesma transação. Há exatamente uma concessão ativa e
um evento de bootstrap. Os testes no banco confirmaram visibilidade própria,
isolamento de outra identidade, bloqueio de autopromoção e revogação efetiva; a
revogação de teste foi revertida, preservando o administrador ativo.

A interface em Minha conta inclui o painel real de instituições para a concessão
administrativa. A demonstração antiga foi removida; `/superadmin` encaminha para
`/app/institutions`, que exige a concessão real.

## Painel real de instituições

A conta superadministradora acessa a área real em `/conta`, mesmo sem vínculo
institucional. O módulo `/app/institutions` lista, cria, suspende e reativa instituições
persistidas no Supabase. A suspensão exige confirmação na interface. As operações
continuam sujeitas às mesmas verificações do servidor e do banco.

`GET/POST /api/admin/institutions` e `PATCH /api/admin/institutions/:id` validam a
identidade e a concessão atual no servidor. As mutações usam RPCs com a identidade
do usuário; não usam service-role. Os wrappers públicos são SECURITY INVOKER e as
implementações privilegiadas ficam no schema privado, com search_path vazio,
checagem de auth.uid(), bloqueio compartilhado da concessão ativa e EXECUTE limitado.
Não há grant direto de escrita nas tabelas. Cada alteração e seu evento de auditoria
são atômicos; reaplicar o mesmo status não duplica o histórico.

As migrations `platform_institutions` e `isolate_platform_operations` foram aplicadas
e alinhadas às versões do histórico remoto. `supabase/tests/platform-institutions.sql`
passou no banco real com fixtures desfeitas, incluindo negação a anônimos, usuários
comuns e administradores revogados, validação de entradas e auditoria. Os 17 testes HTTP existentes usam um Supabase simulado para isolar o transporte e
a autorização da API. Os testes de navegador também usam fixtures explícitas, sem
sessão Google real. Eles verificam a interface e estados de erro; não comprovam RLS.
A validação de banco foi feita anteriormente com testes SQL e rollback. Nesta rodada
de refinamento não houve alteração nem reexecução de migrations no banco remoto.
Consulte `workspace.md` para o fluxo atual e a homologação com contas reais.

O advisor não aponta mais RPCs privilegiadas no schema exposto. A auditoria privada
permanece sem políticas de leitura pública por intenção; o aviso de proteção contra
senhas vazadas no Auth é independente destas operações e não foi alterado.
