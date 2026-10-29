> Registro histórico do primeiro preview. O painel foi integrado à main; consulte [deployment.md](deployment.md) para a etapa atual.

# Preview do painel institucional

O painel em `feat/login-accessibility` usa o contexto real já retornado pela API. Não contém instituições, projetos ou contagens de exemplo.

- `workspace/overview.tsx`: indicadores, leitura do ciclo, próximos passos por capacidade e até quatro projetos ativos, ordenados por criação mais recente.
- `workspace/overview.css`: apresentação em petróleo e menta, indicadores em duas colunas no celular, ciclo vertical em telas pequenas e compatibilidade com temas e modo de carga cognitiva reduzida.
- `workspace/app.tsx`: integração do componente com a sessão e o contexto institucional existentes.

As contagens representam somente registros visíveis ao perfil. Resultados publicados são filtrados pelo campo `published`; não há cálculo de progresso percentual. Bancas em preparação e abertas são contadas separadamente. Não foram alterados contratos da API, políticas de banco ou autenticação.

A publicação deste trabalho é somente de preview, sem promoção para produção. O ambiente de execução local estava indisponível durante esta etapa. A compilação e a checagem de tipos devem ser verificadas nos logs do deployment Vercel. Os testes HTTP e de navegador anteriores não equivalem à validação deste novo layout; não foram reexecutados nesta etapa. A revisão visual com dados reais depende de uma sessão autenticada no preview.
