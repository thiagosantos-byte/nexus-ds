# Nexus — acessibilidade, Nexus IA e sala de comando

Este documento descreve a camada de acessibilidade, o assistente Nexus IA e o
novo painel de visão geral. O nome do produto é **Nexus**; chaves antigas de
armazenamento (`catapimba:*`) são lidas apenas para migrar preferências e nunca
voltam a ser gravadas.

## 1. Sala de comando (`features/workspace/overview.tsx`)

O painel foi reorganizado em cinco blocos, todos alimentados pelos dados que o
vínculo do usuário já pode ler:

1. **Órbita do ciclo** — um índice de prontidão (0–100) e quatro nós (projetos,
   bancas, avaliações e resultados). Cada nó tem forma própria (círculo,
   quadrado, triângulo, losango), rótulo e número.
2. **Pulso Nexus** — sinais gerados a partir dos dados (acessos pendentes,
   avaliações faltantes, bancas próximas, resultados não publicados). Cada
   cartão traz o tom em texto ("Prioridade", "Atenção" etc.), ícone e ação.
3. **Linha do ciclo** — contagem por etapa, sem sugerir taxa de conclusão.
4. **Radar de bancas** — próximos encontros com percentual de avaliações
   registradas.
5. **Distribuição por etapa** — barras com rótulo, número e padrão (quando a
   pessoa ativa "formas e padrões").

Filtros de ano e semestre permanecem no topo e afetam todos os blocos.

## 2. Acessibilidade

As preferências ficam em `localStorage` (`nexus:accessibility:v2`) e são
aplicadas em `document.documentElement` por `data-*`. Consumo:

| Preferência | Atributo | Efeito |
| --- | --- | --- |
| Daltonismo | `data-color-filter` | Filtros SVG para protanopia, deuteranopia, tritanopia e acromatopsia |
| Paleta segura | `data-safe-palette` | Paleta categórica Okabe–Ito (`--chart-1..5`) |
| Padrões | `data-patterns` | Texturas e formas em barras e status |
| Contraste | `data-high-contrast` | Contraste AAA, bordas de 2 px, foco de 4 px |
| Texto ampliado | `data-large-text` | 18 px, linhas mais altas |
| Fonte legível | `data-dyslexia` | Atkinson Hyperlegible/Verdana, espaçamento extra |
| Sublinhar links | `data-underline-links` | Links identificáveis sem cor |
| Régua de leitura | `data-reading-guide` | Faixa que acompanha o ponteiro |
| Leitor de tela | `data-screen-reader` | Anúncios de rota e dicas extras |
| Legendas | `data-captions` | Legendas na premiação e texto sempre visível |
| LIBRAS | `data-libras` | VLibras oficial carregado sob demanda |
| Modo tranquilo | `data-calm` | Remove animações e reduz brilho |

A barra flutuante (`AccessibilityDock`) oferece LIBRAS, legendas, leitura da
página em voz alta e o painel completo. O botão da Nexus IA fica no lado
oposto para não competir com o dock.

### Público-alvo

- **Daltonismo:** filtros por tipo, paleta segura, padrões, rótulos e ícones.
- **Cegueira e baixa visão:** marcos HTML, foco visível, atalhos, anúncios
  `aria-live`, botão "Ouvir", contraste reforçado e fonte de alta legibilidade.
- **Surdez e perda auditiva:** legendas na premiação e nos conteúdos com áudio,
  alertas sem som, transcrição das respostas da IA e LIBRAS via VLibras.
- **Pessoas mudas ou sem fala:** perguntas por texto, ditado opcional, respostas
  escritas e leitura em voz alta pela síntese do navegador.

### Atalhos

- `Alt + Shift + A` — painel de acessibilidade
- `Alt + Shift + K` — Nexus IA
- `Alt + Shift + C` — legendas
- `Alt + Shift + L` — ir ao conteúdo principal
- `Esc` — fechar diálogos

## 3. Nexus IA

- Interface: `apps/web/src/features/assistant/NexusAI.tsx`.
- Motor local e sinais: `apps/web/src/features/assistant/insights.ts`.
- API: `apps/api/src/routes/ai.ts` (`POST /api/ai/chat`).

O cliente envia as últimas mensagens e um retrato compacto do contexto
institucional (contagens, bancas, projetos, resultados). A API:

1. valida sessão Supabase, formato e tamanho do corpo;
2. limita a 20 perguntas por minuto por usuário;
3. envia um prompt de sistema que proíbe inventar dados ou acessar outra
   instituição;
4. se `NEXUS_AI_API_KEY` não estiver configurada, responde `503` com
   `fallback: true`, e o cliente usa o motor local — que também usa apenas os
   dados reais do contexto.

Configuração (API, nunca no frontend):

```bash
NEXUS_AI_API_KEY=...
NEXUS_AI_BASE_URL=https://api.openai.com/v1
NEXUS_AI_MODEL=gpt-4o-mini
```

A IA não executa comandos de escrita. Ela orienta e aponta a tela correta.

## 4. Verificação manual

- Navegar apenas com Tab: menu, filtros, órbita, sinais, painel de
  acessibilidade e IA alcançáveis; foco visível; `Esc` fecha diálogos.
- Ativar cada filtro de daltonismo e a paleta segura: nenhuma informação deve
  desaparecer; números e rótulos permanecem.
- Ativar padrões: barras e status mudam de forma/textura, não só de cor.
- Ativar "Ouvir": a página é lida e o botão vira "Parar".
- Ativar LIBRAS: o botão azul do VLibras aparece; sem rede, o erro é anunciado.
- Na premiação, ativar legendas: o texto acompanha cada fase.
- Com um leitor de tela (NVDA/VoiceOver): troca de rota é anunciada, erros usam
  `role="alert"`, respostas da IA usam `role="log"`.
- Verificar `prefers-reduced-motion`: órbita e aurora ficam estáticas.

## 5. Limites conhecidos

- O VLibras depende do serviço público `vlibras.gov.br`.
- A síntese de voz e o ditado dependem do navegador e das vozes instaladas no
  sistema; não há gravação de áudio.
- A IA generativa exige uma chave de provedor configurada no servidor. Sem ela,
  o modo local cobre os principais temas do domínio, mas não é um modelo de
  linguagem aberto.
