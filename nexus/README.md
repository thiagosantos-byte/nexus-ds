# Nexus — Gestão e Avaliação de Projetos

Plataforma multi-institucional em português. **Frontend React/Vite no Vercel; API Express no Render; PostgreSQL e Google OAuth no Supabase.** Não há login simulado nem dados de demonstração embutidos no produto. Os dados de teste autorizados ficam exclusivamente na instituição identificada como laboratório.

## Estrutura

- `apps/web`: interface, autenticação pelo SDK Supabase, acessibilidade e módulos institucionais em `src/features/workspace`.
- `apps/api`: validação de tokens, endpoints institucionais, exportação e integração Supabase com a identidade do usuário.
- `packages/api-spec`, `packages/api-client-react`, `packages/api-zod`: contrato OpenAPI e código gerado.
- `packages/db`: scaffold Drizzle legado; não representa o esquema real. Não usar `push` para recriar o banco.
- `supabase/migrations` e `supabase/tests`: histórico do banco e testes SQL com rollback.
- `tools/mockup-sandbox`: ferramenta de componentes separada, não publicada como produto.
- `scripts` e `docs`: verificações e documentação.

## Preparação e execução local

Use Node.js 24 e pnpm 11.25.0. Não execute `npm install`.

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
```

Configure `apps/web/.env.local` e `apps/api/.env.local` a partir dos respectivos `.env.example`. As variáveis `VITE_*` são públicas. Nunca inclua service-role, senha de banco ou segredos OAuth nelas.

```bash
# Terminal do frontend, porta 5173
pnpm --filter @workspace/startup-institution-platform run dev

# Terminal da API: iniciar após build:api, carregando seu arquivo local
PORT=3001 NODE_ENV=development node --env-file=apps/api/.env.local apps/api/dist/index.mjs
```

Em desenvolvimento, `VITE_API_URL` pode ficar vazio para usar o proxy local `/api`. Em hospedagem, configure a origem HTTPS do Render, sem `/api`, por exemplo `https://SUA-API.onrender.com`. A API usa `FRONTEND_ORIGINS` com as origens exatas autorizadas, separadas por vírgula. CORS não substitui autenticação e autorização.

## Build e hospedagem

```bash
pnpm run build:web  # Somente frontend, usado pelo Vercel
pnpm run build:api  # Somente backend, usado pelo Render
pnpm run start:api  # Express, lê PORT e escuta em 0.0.0.0
```

O Vercel publica `apps/web/dist/public` e as rotas da SPA. Não há função Express em `api/`. O Render executa a API, cujo health check é `/api/healthz`. `render.yaml` documenta um serviço Free com deploy automático desativado. A configuração via API do Render é registrada em [implantação](docs/deployment.md).

O login Google retorna ao frontend em `/auth/callback`, autorizado na configuração do Supabase. O backend não hospeda essa página. O primeiro superadministrador continua sendo concedido por procedimento controlado.

## Validação

```bash
pnpm test:routing
pnpm test:podium
python3 scripts/workspace-browser.py
python3 scripts/login-browser.py
python3 scripts/podium-browser.py
pnpm check:deployment https://FRONTEND https://API
```

Os testes HTTP e de navegador usam fixtures, não sessões reais. Os testes de navegador exigem Playwright/Chromium e um preview Vite local. Os SQL usam transações com rollback. Consulte [permissões e uso](docs/workspace.md), [relatórios e Excel](docs/reporting.md), [configuração Supabase](docs/setup-supabase.md) e [implantação](docs/deployment.md).

## Acessibilidade e Nexus IA

O sistema atende pessoas com daltonismo, baixa visão, cegueira, surdez e pessoas mudas: ajustes de cor com paleta segura e padrões, leitor de tela e régua de leitura, legendas visuais, tradução em LIBRAS (VLibras), voz sintetizada e ditado por texto. Atalhos: `Alt+Shift+A` (acessibilidade), `Alt+Shift+K` (Nexus IA), `Alt+Shift+C` (legendas) e `Alt+Shift+L` (conteúdo). A configuração da IA usa `NEXUS_AI_API_KEY`, `NEXUS_AI_BASE_URL` e `NEXUS_AI_MODEL` na API; detalhes em [docs/nexus.md](docs/nexus.md).

## Premiação

O pódio apresenta resultados encerrados, completos e publicados, com suspense, revelação do terceiro ao primeiro lugar e tratamento de empates. Cada pessoa assiste no próprio ritmo, com música instrumental opcional, pausa, repetição, tela cheia e modo tranquilo. A primeira visita ao pódio inicia a apresentação sem som; a visão geral avisa sobre premiações ainda não assistidas. Consulte [funcionamento, dados de teste e validação](docs/podium.md).

## Segurança e orçamento

Papéis pertencem ao vínculo institucional. Ser superadministrador não concede o papel de avaliador: são exigidos vínculo ativo explícito e designação para a banca. O avaliador pode revisar suas próprias notas enquanto a banca estiver aberta; após o encerramento, o banco bloqueia novos envios. Todas as operações protegidas verificam tokens, permissões e instituição no servidor/banco.

Meta de custo: R$ 0 para desenvolvimento e demonstração. Nenhum plano pago foi contratado. O Render Free hiberna após inatividade e tem cotas compartilhadas de uso. O frontend apresenta espera e erros de conexão sem repetir automaticamente comandos de escrita. Vercel e Supabase também têm limites de uso. A Nexus IA está disponível em todas as telas autenticadas: analisa apenas os dados já autorizados ao perfil, responde por escrito, pode ler em voz alta e não executa alterações. Sem provedor configurado, o motor local responde com os mesmos dados. Veja [Nexus IA e acessibilidade](docs/nexus.md).

O merge da branch `feat/login-accessibility` em `main` foi solicitado e realizado. Publicações em produção continuam sendo ações separadas; um merge não comprova que o site já recebeu o código novo.

O PR #3 foi integrado à `main` e publicado com autorização em 27/10/2026. O endereço principal é https://catapimba-mu.vercel.app, com API em https://catapimba-api.onrender.com. Consulte o registro em [deployment.md](docs/deployment.md), inclusive os ajustes restantes de Branch e Health Check no painel Render.
