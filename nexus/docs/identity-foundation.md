# Identidade e isolamento institucional

A fundação de identidade está implementada e é utilizada pela área `/conta` e pelos
módulos `/app/*`. Consulte [workspace.md](workspace.md) para uso, papéis e limites e
[setup-supabase.md](setup-supabase.md) para configuração e evidências de integração.
As páginas e identidades fictícias foram removidas.

## Identidade e sessão

O identificador de `auth.users` é a identidade global. Google OAuth usa Authorization
Code com PKCE pelo SDK oficial Supabase, com persistência e renovação de sessão já
existentes. Não há senha própria, seleção artificial de perfis nem credenciais
administrativas no navegador. Nome e e-mail servem para apresentação e vinculação;
não são prova de papel ou instituição.

O cliente envia o JWT Supabase em `Authorization: Bearer`. Express usa Supabase Auth
para validar a identidade e cria um cliente por requisição com o mesmo JWT e a chave
publicável. Ausência ou invalidez de token retorna 401 sem conteúdo institucional;
indisponibilidade pode retornar 503. As respostas protegidas usam `no-store`.

A saída usa escopo `local`, preservando sessões de outros dispositivos. O SDK pode
apagar a sessão local mesmo diante de falha remota; a interface informa essa condição.
Não promete invalidar imediatamente access tokens já emitidos.

## Vínculos e autorização

- A conta pode participar de várias instituições e acumular papéis em cada vínculo.
- Autenticação por si só não concede acesso aos projetos. É preciso instituição e
  vínculo ativos, além do papel e da associação ao recurso quando aplicável.
- Solicitação pública de administração não existe. A solicitação autenticada de
  perfil comum fica pendente e não concede papéis até a aprovação autorizada.
- A suspensão bloqueia a operação seguinte, sem exigir novo login.
- Somente a administração global concede administração institucional e administra
  instituições. Administradores institucionais gerenciam os demais perfis de sua instituição.
- Metadados editáveis do Google/Supabase nunca concedem privilégios.
- A interface não oferece matriz de permissões editável; as capacidades são
  declaradas no servidor e no banco. Esconder um botão não concede nem revoga acesso.

## RLS e funções SQL

A Data API recebe o JWT do próprio usuário, permitindo `auth.uid()` nas políticas.
Os grants e RLS restringem SELECT direto. Escritas passam por RPCs, sem escrita
livre nas tabelas. Wrappers públicos são SECURITY INVOKER; funções privilegiadas
ficam em `private`, com `search_path=''`, EXECUTE restrito e autorização explícita.
Como SECURITY DEFINER pode ultrapassar RLS, essas verificações são necessárias.
As mutações e a auditoria são atômicas.

Não usar `pg.Pool`, `DATABASE_URL` privilegiada ou service-role para operações de
usuário e afirmar que RLS as protege automaticamente. As migrations SQL são o
histórico oficial; não recriar o esquema com comandos Drizzle.

## Superadministrador inicial

`supabase/bootstrap-superadmin.sql` é um procedimento restrito por UUID exato,
sem endpoint público. A concessão inicial já foi executada de forma controlada e
auditada. Não promover a primeira pessoa que entrar nem usar domínio de e-mail
como concessão administrativa. Não repetir bootstrap para resolver problemas visuais.

## Evidências e limites

Os testes SQL em `supabase/tests` validaram no PostgreSQL real, com rollback,
isolamento, papéis, revogação e operações de negócio. Os testes HTTP usam upstream
Supabase simulado. Os testes Playwright usam identidades e respostas simuladas
restritas ao processo de teste. Essas evidências são diferentes e não substituem
homologação com contas Google reais de cada perfil.

Nenhuma migration, tabela, política RLS ou regra de autorização foi alterada durante
o refinamento visual e remoção da demonstração. Não foi feito reset do banco.

## Operação

O orçamento continua R$ 0 no desenvolvimento. Antes de uso institucional, definir
retenção, exclusão, base legal e atendimento a titulares conforme a LGPD, além de
homologar backup e recuperação. A existência de Auth e RLS não assegura conformidade
jurídica nem disponibilidade operacional por si só.
