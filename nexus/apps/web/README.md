# Nexus — interface

Aplicação React + Vite em português, integrada à API Express e ao Supabase Auth.
A entrada é Google OAuth. A área `/conta` mostra os módulos autorizados para cada
vínculo institucional. Não existe login simulado ou conteúdo de demonstração.

```bash
pnpm --filter @workspace/startup-institution-platform run dev
pnpm --filter @workspace/startup-institution-platform run typecheck
```

Execute a API local na porta 3001; o Vite encaminha `/api` para ela em desenvolvimento.
Configure `.env.local` seguindo `.env.example`. Nunca inclua chaves administrativas.

`src/components/app-ui.tsx` e `src/index.css` compõem o sistema visual compartilhado,
com tipografia de sistema e tokens de cor, espaçamento e bordas. A navegação móvel
usa um menu expansível; tabelas extensas têm rolagem dentro do próprio componente.
As confirmações usam `dialog` nativo com suporte a teclado e restauração de foco.

O som opcional do pódio é gerado localmente. Os dados de projetos, avaliações e
resultados vêm exclusivamente da API, sujeitos às permissões do servidor.

Consulte o [README da raiz](../../README.md) e o [roteiro de uso](../../docs/workspace.md)
para execução integrada, testes e limites conhecidos.

Em hospedagem, a API é externa: configure `VITE_API_URL` com a origem HTTPS do Render. Os módulos ficam em `src/features/workspace`; os seletores compartilhados estão em `src/components/inputs`.


## Acessibilidade e IA

A camada de acessibilidade fica em `src/features/accessibility`: preferências
persistidas, painel com abas (visão, daltonismo, audição, fala e teclado), dock
flutuante, régua de leitura, atalhos e integração opcional com o VLibras. O
assistente fica em `src/features/assistant` e usa a API (`/api/ai/chat`) com
queda segura para o motor local baseado no contexto institucional.

A sala de comando (`features/workspace/overview.tsx`) é o painel principal:
órbita de prontidão, pulso de sinais, linha do ciclo, radar de bancas e
distribuição por etapa. Nenhuma informação depende exclusivamente de cor.
