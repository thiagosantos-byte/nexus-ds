> Registro histórico da etapa anterior. A estrutura e a hospedagem atuais estão em [deployment.md](deployment.md).

# Refinamento do Nexus — validação local

Data: 25/10/2026. Branch: `feat/identity-foundation`, partindo de `71b9dd3`.
A etapa de refinamento foi validada localmente, sem push ou deploy naquele momento.
Em seguida, a pedido do responsável, o código foi consolidado na branch `main` para
ser a padrão do GitHub. O deploy automático dessa branch permanece desativado; o
preview publicado continua no estado anterior até autorização de publicação.

## Remoções

- `src/demo-data.ts`, a aplicação simulada de `App.tsx`, layout com seletor de
  identidades e páginas antigas de avaliações, relatórios e premiação.
- Formulários públicos que simulavam cadastro, acesso e recuperação; links para
  demonstração, métricas e atividades inventadas da página pública.
- Componentes/helpers sem consumidores após a remoção, incluindo o scaffold UI
  não utilizado do frontend, seus hooks e dependências diretas. As bibliotecas
  compartilhadas de API e o sandbox auxiliar não publicado foram preservados.
- CSS antigo e fontes externas concorrentes. A etapa legítima de projeto chamada
  **Protótipo** foi preservada; não se trata de modo de demonstração.

Os endereços antigos agora redirecionam para módulos autenticados. Endereços
inexistentes têm uma página de erro em português. Fixtures permanecem somente nos
scripts de teste, sem imports no aplicativo ou conteúdo no bundle de produção.

## Interface e correções

`src/components/app-ui.tsx` e `src/index.css` concentram a base visual: identidade
Nexus, fontes do sistema, azul-petróleo, verde-menta, contraste, superfícies
claras, bordas consistentes e foco visível. Páginas públicas e autenticadas usam
essa mesma base. A meta viewport permite zoom, e animações respeitam movimento reduzido.

- Menu expansível móvel com todos os módulos, indicação da página atual, Escape,
  retorno do foco e comportamento correto ao redimensionar para desktop.
- Tabelas com região nomeada/focável e rolagem própria; formulários maiores,
  áreas de toque de 44 px e telas vazias distintas de falhas de carregamento.
- Mensagem de falha de logout visível e distinção entre sessão local encerrada e
  revogação remota não confirmada, conforme o comportamento do SDK Supabase instalado.
- Falhas de catálogo e contexto com repetição explícita da consulta, sem indicar
  erroneamente falta de vínculo ou sucesso de gravação.
- Filtros sem resultados em projetos, pessoas, bancas e classificação.
- Cancelar edição de critério/vínculo restaura os valores padrão, sem transportar
  valores antigos para um novo cadastro.
- UI de vínculos respeita as restrições já existentes sobre administração do
  próprio vínculo e de administradores institucionais; o banco continua impondo-as.
- Confirmações nativas acessíveis ao cancelar banca ou suspender instituição.
- Exportação com estado de preparação, erro honesto e liberação da URL do arquivo
  após iniciar o download. Som do pódio é liberado ao trocar de banca/sair da tela.
- Proxy local Vite `/api` → Express na porta 3001, alinhando o comando de desenvolvimento
  ao fluxo integrado já usado na Vercel. Configuração Vercel preservada.

## Verificações desta rodada

| Verificação | Resultado observado |
| --- | --- |
| Instalação offline com `--frozen-lockfile` | Passou; versões preservadas e dependências não usadas removidas do frontend |
| `pnpm run build:vercel` | Passou: bibliotecas, TypeScript da API/frontend e ambos os builds |
| `python3 scripts/workspace-browser.py` | 23 testes passaram; inclui subcasos dos seis perfis e várias larguras |
| Página pública | Verificada em 320, 390, 768 e 1440 px, sem dados fictícios nem transbordamento |
| Área autenticada com nomes longos | Verificada em 320, 768 e 1440 px; zoom de texto de 200% verificado em mobile |
| Fluxos de erro e identidade | Callback cancelado, provedor desabilitado, identidade recusada, logout e falha remota, solicitação aceita/recusada e gravação recusada |
| CRUD e apresentação no navegador | Projeto, edição restrita do aluno, formulário de banca, instituição/suspensão, filtros, cancelamento por dialog, avaliação e exportação |
| Proxy local com API real | Health: 200 JSON; identidade e catálogo sem token: 401 JSON; endpoint inexistente: 404 JSON |
| Busca no código e bundle de produção | Nenhuma referência a dados/seletor/login de demonstração ou nomes das antigas fixtures |
| `git diff --check` | Passou |
| Backend, SQL, API spec e `vercel.json` | Sem alterações, conferidas pelo diff |

Os testes Playwright usam sessão e respostas HTTP simuladas exclusivamente em
`scripts/workspace-browser.py`. Nenhum dado é gravado no Supabase por esses testes.
A checagem de proxy usa Express real para health e negações sem token, sem simular
sucesso de operações protegidas.

Os 17 testes HTTP de negócio/roteamento e os testes SQL da etapa anterior foram
preservados. Não foram repetidos nesta rodada: implementação da API, migrations,
RLS, grants e funções SQL não mudaram. Não há uma nova alegação de validação remota
ou de login Google ponta a ponta por esses testes de interface.

Tamanhos de saída Vite, sem gzip: CSS de 108,69 KB para 24,29 KB; JavaScript de
540,06 KB para 481,14 KB. Não foram adicionadas dependências. Capturas de inspeção
ficam em `/tmp/catapimba-refinement/`, com conteúdo de teste identificado.

## Arquivos principais

| Arquivos | Motivo |
| --- | --- |
| `artifacts/startup-institution-platform/src/App.tsx` | Remover aplicação simulada e tornar rotas explícitas |
| `src/pages/public-pages.tsx`, `identity-page.tsx`, `not-found.tsx` | Página pública real, orientações honestas e erros de identidade |
| `src/components/app-ui.tsx`, `src/index.css`, `index.html`, `public/favicon.svg` | Sistema visual único, acessibilidade, zoom e marca |
| `src/workspace/*`, `src/pages/platform-panel.tsx` | Menu móvel, estados de erro/vazio, formulários e confirmações |
| `package.json` do frontend e `pnpm-lock.yaml` | Remover dependências sem consumidores, sem atualizar versões |
| `vite.config.ts` | Proxy de desenvolvimento, sem alterar implantação |
| `scripts/workspace-browser.py` | Regressões de interface com fixtures isoladas |
| README da raiz/frontend e `docs/*` | Instruções atuais, limites e evidências |

Na tabela, `src/*`, `index.html`, `vite.config.ts` e `public/*` são relativos a
`artifacts/startup-institution-platform`.

## Pendências de homologação

- Publicação na Vercel depende de autorização explícita; o site remoto ainda não
  recebeu o refinamento. A `main` usa `git.deploymentEnabled.main=false` para evitar
  deploy implícito. Depois da publicação autorizada, validar a URL implantada.
- Homologar Google e operações de cada perfil com contas reais; fixtures de navegador
  não provam integração completa com o banco.
- Não foi feita auditoria completa por leitor de tela, Safari/iOS ou certificação WCAG;
  houve validação por teclado, contraste de texto/controles e Chromium responsivo.
- Permanecem os limites de produto/operação em `workspace.md`, incluindo LGPD,
  backup, paginação para volume maior, anexos e notificações. Não são apresentados
  ao usuário como operações já realizadas.

## Branch padrão

A `main` foi criada com o código validado e todo o histórico ancestral. As branches
anteriores foram preservadas. O bloqueio de deploy automático da `main` é uma medida
para respeitar a instrução de não publicar em produção sem autorização; pode ser
removido quando a implantação for autorizada e suas variáveis/OAuth estiverem prontos.

A criação e o push da `main` foram confirmados no GitHub. A tentativa de alterar
a branch padrão via API retornou HTTP 403 (`Resource not accessible by integration`).
Esse ajuste permanece pendente no painel Settings → General → Default branch.
A branch padrão observada após a tentativa ainda é `replit-agent`. Não houve deploy
da `main`, conforme a consulta de implantações da Vercel.

## Implantação autorizada em produção

Em 25/10/2026, após pedido explícito de deploy da `main`, o commit `89430e0` foi
implantado como produção no projeto Vercel existente. Deployment:
`dpl_E9hjRHYkhVTrXL6q55d6EQ8yry2P`, estado confirmado READY, URL pública
https://catapimba-mu.vercel.app. As quatro variáveis publicáveis/URL do Supabase
foram configuradas para o ambiente production. Nenhuma chave administrativa foi usada.

O script `check-deployment.ts` passou contra a URL pública, incluindo health check,
rotas da SPA, erros JSON da API, bundle e asset ausente. As negações sem token no
catálogo e com token inválido na identidade foram verificadas remotamente.

A conexão Supabase disponível não permite consultar/alterar URL Configuration do Auth.
O retorno Google precisa incluir `https://catapimba-mu.vercel.app/auth/callback` na
allowlist. Login Google completo em produção ainda depende de homologação pelo usuário.
O deploy automático da main continua desativado; esta publicação foi manual e autorizada.
