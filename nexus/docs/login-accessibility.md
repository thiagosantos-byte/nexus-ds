# Login simplificado e acessibilidade

Login Google com ajuda por texto, temas e preferências de acessibilidade. O layout de uma coluna substitui a tela dividida e o painel 3D, por solicitação do responsável em 27/10/2026.

## Componentes

- `apps/web/src/pages/login.tsx`: login em uma coluna central, com estado e ações reais de `identity-page.tsx`. Entrada Google, tratamento de sessão, erro e callback preservados.
- `src/features/accessibility`: temas, filtros de cor, modo tranquilo, texto ampliado e atalhos de teclado.
- `src/features/login/ConciergeChat.tsx`: guia de acesso por texto recolhível. Não há atividade ligada a uma cena decorativa.
- `src/features/login/login.css`: estilos do login, guia e preferências globais de acessibilidade.

A cena 3D e sua alternativa estática foram removidas por solicitação do usuário. O frontend não depende mais de Three.js, React Three Fiber ou seus tipos. O pódio de resultados em `features/workspace/results.tsx` permanece como estava; a cerimônia animada aguarda autorização futura.

## Acessibilidade e desempenho

- Login Google e ajuda funcionam sem áudio, câmera, microfone ou comandos de voz.
- Erros usam ícone e texto com anúncio acessível; a conversa usa região de log com anúncios educados.
- Foco visível, labels, landmarks, painel modal nativo com Escape e restauração do foco.
- Alt+Shift+A abre as opções; Alt+Shift+L leva ao botão de entrada, quando disponível. A disponibilidade dos atalhos também depende do navegador e sistema operacional.
- Texto ampliado e espaçamentos maiores no modo tranquilo, sem reduzir intencionalmente o contraste do texto.
- Os ajustes para protanopia, deuteranopia, tritanopia e acromatopsia são opcionais e restauráveis. São realces visuais aproximados, não tratamentos ou correções clinicamente calibradas. Não substituem texto, ícones ou contraste.
- O login não carrega WebGL, objetos 3D ou imagens decorativas. O layout central funciona em telas pequenas e grandes, com e sem preferência por movimento reduzido.
- A autenticação e o painel foram separados do bundle público para evitar que a página inicial carregue o SDK de login.

Não se trata de certificação WCAG nem comprovação de compatibilidade com todos os leitores de tela. Safari/iOS e tecnologias assistivas reais continuam exigindo homologação.

## Concierge e IA: estado real

A ajuda guiada funciona localmente por texto e botões. Não é apresentada como IA generativa, não consulta contas e não declara ter enviado pedidos ou recuperado senhas.

Há integração real preparada no Express em `src/routes/concierge.ts`, usando AI SDK 7. O servidor não fornece ferramentas, banco, dados institucionais ou ações de autenticação ao modelo. Ele responde somente com orientações textuais. O modelo é configurado no servidor, nunca enviado pelo navegador.

A geração está **desativada por padrão**, pois não foi confirmado um provedor/cota/orçamento. Não foi feita chamada real a modelos nem contratado serviço. Testes usam gerador simulado. O guia continua utilizável com IA desativada ou indisponível.

Configuração opcional, somente após aprovação de custos e privacidade:

```dotenv
CONCIERGE_ENABLED=false
CONCIERGE_MODEL=
CONCIERGE_ALLOWED_ORIGIN=
AI_GATEWAY_API_KEY=
```

1. Escolher um modelo de texto existente no catálogo atual do AI Gateway e confirmar acesso, preços e limites. O catálogo foi consultado nesta rodada; nenhum modelo foi escolhido automaticamente.
2. Configurar orçamento rígido no serviço/provedor antes de habilitar uso público. Não presumir que cota gratuita seja ilimitada ou que renovará.
3. Definir `CONCIERGE_ALLOWED_ORIGIN` como a origem exata da aplicação (sem caminho), `CONCIERGE_MODEL` como o identificador real e as credenciais somente no backend. No Render é necessária uma credencial própria do provedor; o OIDC da Vercel não está disponível nesse backend. Nunca usar `VITE_*` para credenciais de IA.
4. Revisar retenção de conversas e finalidade/consentimento aplicáveis. A UI avisa para não enviar senhas/documentos/dados pessoais e a opção de geração é voluntária.
5. Só então habilitar a flag e testar uma requisição real autorizada. Confirmar consumo e resposta antes de anunciar a geração como disponível.

A API limita histórico, texto, papéis, tempo, saída, concorrência e tentativas por instância; recusa outras origens, entradas inválidas e campos extras. As respostas protegidas contra cache não expõem detalhes do provedor. O limitador em memória **não é cota global em serverless**: requer limite financeiro no Gateway e controle de abuso distribuído antes de ativar IA publicamente. A verificação de Origin não é autenticação nem impede clientes externos que falsifiquem cabeçalhos.

Não há recuperação de conta via conversa, envio de e-mail ou concessão de acesso pelo modelo. A recuperação continua no Google e a aprovação continua na gestão institucional.

## Verificação

- `pnpm run build:web` e `pnpm run build:api`: tipos e build de cada aplicação.
- `pnpm test:routing`: 27 testes HTTP, incluindo transporte, CORS e concierge. Testam configuração desativada, origem, validação, resposta real do gerador injetado, erro sem detalhes privados e limite de tentativas. Não chamam IA real.
- `python3 scripts/login-browser.py`: temas/persistência, atalhos, preferências, modo tranquilo, guia, dispositivos pequenos, ausência de cena WebGL em ambos os modos de movimento, no celular e desktop.
- `python3 scripts/workspace-browser.py`: regressão dos 26 cenários existentes, incluindo seis perfis, falhas de identidade e permissões, formulários e navegação.

Os testes de navegador usam fixtures de identidade e API, sem credenciais reais ou escrita no banco. Capturas ficam em `/tmp/catapimba-login`. Nenhuma migration, política RLS, regra de negócio institucional ou contrato de sessão foi alterado.

## Simplificação do login — 27/10/2026

Layout central de uma coluna, texto de entrada mais curto, retirada do painel promocional e da cena 3D. Foram removidos também os estilos, callbacks de atividade e pacotes exclusivos dessa cena. Autenticação, temas, preferências, ajuda e controles de acessibilidade continuam disponíveis. O pódio de resultados não foi alterado. A visibilidade dos resultados publicados continua institucional, para vínculos ativos, conforme a regra existente.

Validação desta simplificação: instalação com lockfile congelado e política de idade mínima passou; build e tipos do frontend passaram; quatro testes do login e seis testes de regressão de páginas públicas/identidade/perfis passaram, com fixtures locais. Nenhuma versão de pacote foi adicionada: dezoito pacotes exclusivos do fluxo 3D saíram do lockfile. O arquivo JavaScript separado de aproximadamente 931 kB da cena 3D deixou de ser gerado. Não foram repetidos testes SQL ou de API, pois não houve alterações no backend, banco ou autorização.
