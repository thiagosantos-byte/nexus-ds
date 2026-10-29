# Frontend Vercel e API Render

## Organização e regras

`apps/web` contém o React/Vite. `apps/api` contém o Express. `packages` reúne os contratos/geradores e o scaffold de banco legado; `tools/mockup-sandbox` não é publicado. Os módulos institucionais ficam em `apps/web/src/features/workspace`. A movimentação preserva os nomes dos pacotes pnpm para reduzir mudanças desnecessárias.

Não existe mais função Express em `api/` no Vercel. O frontend usa `apiFetch`, configurado por `VITE_API_URL`. O endereço é a origem do backend (sem `/api`). Todos os módulos, incluindo identidade, instituições, exportações e guia de acesso, utilizam esse mesmo transporte. O cliente envia o JWT por `Authorization`, sem cookies para o backend. Falhas de conexão são explícitas; comandos de escrita não são repetidos automaticamente. O prazo de 75 segundos contempla a partida a frio do Render Free.

O backend usa uma lista exata de origens em `FRONTEND_ORIGINS`, valida preflight de Authorization/Content-Type e recusa origens desconhecidas. Não há liberação genérica para todos os subdomínios Vercel. Requisições sem Origin, como health probes, ainda são aceitas, mas operações protegidas sempre exigem JWT e autorização no banco.

A correção de `private.has_institution_role` remove a concessão implícita do papel exclusivo de avaliador para o superadministrador. Um usuário que também tenha vínculo ativo explícito de avaliador pode avaliar somente se estiver designado para a banca. Revisões da própria nota continuam possíveis durante a abertura; encerramento bloqueia envios. A migration é incremental e não altera notas ou usuários existentes.

## Configuração

Vercel, raiz do monorepo:

- Build: `pnpm run build:web`.
- Publicação: `apps/web/dist/public`.
- Variáveis públicas: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Os retornos OAuth `/auth/callback` dos endereços utilizados devem estar autorizados no Supabase Auth.
- A publicação automática de `main` continua desativada, para evitar releases não revisadas.

Render, raiz do monorepo:

- Node 24.19.0, pnpm 11.25.0.
- Build: `corepack enable && pnpm install --frozen-lockfile && pnpm run build:api`.
- Start: `pnpm run start:api`.
- Variáveis: `NODE_ENV=production`, `FRONTEND_ORIGINS`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CONCIERGE_ENABLED=false`.
- O servidor usa `PORT` do Render e escuta em `0.0.0.0`.
- O endpoint `/api/healthz` verifica o processo, não o banco. O Blueprint `render.yaml` configura esse health check HTTP. A criação pelo conector tem parâmetros limitados e mantém a detecção de porta/health check padrão do Render; para aplicar o path personalizado no serviço criado pelo conector, utilizar Settings → Health Checks no dashboard.

Serviço criado nesta etapa: **catapimba-api**, plano **Free**, região Virginia, workspace **My Workspace**, URL `https://catapimba-api.onrender.com`. Serviço `srv-dbgi4ho473hc73dkgqi0`. Deploy automático desativado. A branch de validação é `feat/render-api-and-workspace-ui`; o Blueprint descreve `main` para consolidação posterior.

O serviço antigo `catapimbas`, de outro repositório, não foi alterado. A cota Free do Render é compartilhada entre os serviços do workspace. Verifique o consumo no painel; a criação de um segundo serviço não duplica a franquia gratuita. Nenhum plano pago ou banco Render foi criado.

## Verificação desta etapa

- Instalação com lockfile congelado: passou após atualização dos caminhos do monorepo; nenhuma versão nova foi adicionada.
- `pnpm run typecheck` e `pnpm run build`: passaram, incluindo os builds das aplicações e da ferramenta de componentes.
- `pnpm test:routing`: 27 testes HTTP passaram, incluindo origens permitidas/negadas, preflight e autenticação.
- `scripts/workspace-browser.py`: 26 testes passaram, com API/identidade de teste, navegador Chromium, viewport móvel e desktop; inclui clique no container, pesquisa/remoção e revisão de notas.
- `scripts/login-browser.py`: 5 testes passaram, incluindo temas, persistência, atalhos, modo tranquilo e WebGL por software.
- SQL `workspace.sql`: passou com rollback para papéis, isolamento, RLS, notas, publicação e auditoria.
- SQL `evaluator-permission.sql`: passou com rollback para impedir privilégio implícito, preservar vínculo explícito, revisões e suspensão.
- O primeiro teste SQL novo foi corrigido durante a preparação das fixtures (UUID e vínculo exigido pela chave estrangeira). Nenhum dado de teste foi persistido.

Esses testes não equivalem a login Google real no novo endereço nem a teste em leitores de tela físicos. O bundle 3D ainda gera aviso de tamanho, permanece isolado e carregado sob demanda. Os avisos do advisor referentes à auditoria privada sem política cliente e proteção de senha desativada continuam os mesmos; o acesso atual é Google, sem senha própria.

## Resultado remoto em 27/10/2026

- API Render: deploy `dep-dbgi4i8473hc73dkgs10`, commit de aplicação `59fbaf1`, estado **live**.
- Vercel: preview `dpl_6CN51DHiSeexc4s2sYynnrVS8RHs`, mesmo commit, estado **READY**. Frontend: `https://catapimba-git-feat-render-api-and-workspace-ui-ovatsug.vercel.app`.
- Probes reais no Render: health 200 JSON, rotas inexistentes e método inválido 404 JSON, requisições protegidas sem token/com token inválido 401 e `no-store`, preflight 204 nas origens aprovadas, origem não aprovada 403, concierge indisponível (`available: false`).
- O preview exige login no Vercel (resposta 302 para proteção SSO). Nenhuma proteção de deployment foi removida.
- Não foi realizada validação de login Google real neste novo preview. Se ainda não estiver autorizado no Supabase, adicionar `https://catapimba-git-feat-render-api-and-workspace-ui-ovatsug.vercel.app/auth/callback` em Authentication → URL Configuration → Redirect URLs. As ferramentas disponíveis não permitem confirmar/alterar essa configuração de Auth.
- Produção `https://catapimba-mu.vercel.app` continua no deployment anterior. A atualização da URL da API no ambiente de produção e a publicação final dependem de autorização explícita, conforme a instrução do projeto.

A branch de acessibilidade foi integrada à `main` por fast-forward, sem reescrever histórico. As novas correções e a implantação separada estão na branch `feat/render-api-and-workspace-ui`, para revisão antes da integração/publicação final.

## Publicação autorizada do PR #3 — 27/10/2026

O PR #3 foi integrado à `main` no commit `edfabee275b276ebefe39cd48d40aa83f7bf666c`, após autorização explícita. O frontend foi publicado como produção no deployment Vercel `dpl_CcsTfLpMjU2S9k74YnWybfT3eapb`, estado **READY**, em `https://catapimba-mu.vercel.app`. `VITE_API_URL` de Production foi configurado como `https://catapimba-api.onrender.com`.

A API Render continua **live** no commit `59fbaf1`; não há diferenças de código de aplicação entre esse commit e a main publicada (somente documentação e metadados de merge). Não houve necessidade de repetir o deploy do backend para essa publicação.

Verificações posteriores: health check Render 200; preflight da origem de produção 204; home, login e rotas SPA 200; JavaScript 200; asset inexistente 404. Não foram encontrados logs de nível error no Render na consulta dessa publicação. A tentativa de navegação remota no Chromium foi limitada pela ausência de confiança do navegador na CA do proxy do ambiente (`ERR_CERT_AUTHORITY_INVALID`); as verificações HTTP mantiveram a validação TLS e passaram. Não foi efetuado login Google real nem verificação autenticada remota em nome do usuário.

Ajustes que ainda precisam do Dashboard Render, pois o conector disponível não oferece atualização dessas propriedades:

1. Em `catapimba-api` → Settings → Build & Deploy, alterar Branch de `feat/render-api-and-workspace-ui` para `main`.
2. Em Settings → Health Checks, configurar Health Check Path como `/api/healthz`. O serviço atualmente usa o health check TCP padrão e está atendendo normalmente.
3. Manter Auto-Deploy em Off para continuar com publicação manual. Depois de alterar a branch, usar Manual Deploy → Deploy latest commit para consolidar o backend na main; o código de aplicação atual já é equivalente.

Não é necessário editar código, recriar banco ou executar migrations manualmente para concluir esses ajustes. O PR #3 está merged e não precisa de outro merge pelo usuário.
