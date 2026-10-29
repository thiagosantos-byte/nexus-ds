# Cerimônia individual do pódio

## Experiência

A cerimônia utiliza exclusivamente os resultados que a API já autoriza para a instituição selecionada. Não há transmissão sincronizada, WebSocket, processo no Render, chamada de IA ou novo serviço pago.

1. A gestão encerra a banca com todas as avaliações completas e publica o resultado.
2. A visão geral mostra um aviso de nova premiação para quem ainda não assistiu nesse navegador. O aviso leva ao pódio da banca; não interrompe automaticamente o login.
3. Na primeira visita ao pódio dessa versão do resultado, a cerimônia começa **sem som**. O botão **Ativar música** precisa de uma ação explícita da pessoa, conforme as políticas dos navegadores.
4. A sequência normal dura cerca de 25 segundos: abertura, terceiro lugar, segundo lugar, suspense, primeiro lugar e celebração. Se houver menos posições, a sequência se adapta. As posições vêm do banco, sem reclassificação pelo frontend; todos os projetos empatados recebem o mesmo destaque.
5. Há pausa/continuação, volume, confetes opcionais, modo tranquilo, tela cheia quando suportada, resultado imediato, consulta da classificação e repetição. A sequência pausa ao ocultar a aba e aguarda uma ação para continuar. Fechar a janela encerra o áudio.

O marcador de visualização fica no `localStorage`, separado por usuário, instituição e banca, com uma versão do resultado. Guarda identificadores e uma impressão da versão, sem nomes, notas ou e-mails. Só marca como visto na celebração final ou ao pedir o resultado imediato. Fechar antes permite retomar pela primeira apresentação na próxima visita. Sem armazenamento disponível, usa memória da página. Não sincroniza entre dispositivos; limpar os dados do navegador permite a primeira apresentação novamente.

Resultados não publicados, bancas abertas/canceladas, classificações vazias ou avaliações incompletas não iniciam a cerimônia. A página de classificação continua disponível conforme as permissões existentes. O estado de visualização nunca determina acesso a dados.

## Visual, acessibilidade e áudio

- Componentes isolados em `apps/web/src/features/podium`, com carregamento da cerimônia sob demanda. Não foram adicionadas dependências nem renderização WebGL/3D.
- Palco em azul-petróleo, posições dourada/prateada/bronze, entradas animadas e confetes finitos. Nomes e posições também são textuais. Empates, nomes longos e poucos premiados têm tratamento próprio.
- Diálogo nativo com título, foco, Escape e devolução do foco ao botão; anúncios textuais das revelações, controles identificados e progresso acessível. O resultado não depende de ouvir a trilha.
- Respeita a preferência de movimento reduzido e o modo tranquilo compartilhado. Ambos removem deslocamentos e confetes; o modo tranquilo também usa a paleta do tema. Há rolagem vertical no diálogo em telas pequenas, sem recortar nomes horizontalmente.
- Três MP3 locais originais: trilha de antecipação, passagem e vitória. A vitória combina melodia, acordes e percussão; não utiliza música do Kahoot nem amostras comerciais. São cerca de 265 KB no total, buscados somente após ativar a música. Origem, licença e reprodução em [audio/README.md](../apps/web/src/features/podium/audio/README.md).
- O motor Web Audio acompanha as etapas e controla pausa, volume e descarte. Falhas de carregamento mostram um aviso; a apresentação continua sem som e permite tentar novamente. Não há áudio automático, mesmo na repetição.

## Laboratório autorizado no banco

Em 27/10/2026, a pedido do responsável, foi criada a instituição **Nexus — Laboratório de Testes**. A conta existente do responsável recebeu os papéis explícitos de administrador institucional, coordenador e avaliador **somente nesse laboratório**. Nenhuma conta Auth fictícia permanente foi criada.

Para experimentar: entre com sua conta Google, selecione o laboratório no cabeçalho, abra **Pódio** e escolha uma das bancas. Ative a música se desejar. Há:

| Banca | Classificação |
| --- | --- |
| `[TESTE] Jornada de Inovação — premiação` | Aurora Solar 4,80; Rota Acessível 4,40; Horta Circular 4,00; Água Viva 3,40 |
| `[TESTE] Vitória compartilhada — empate` | Aurora Solar e Rota Acessível 4,80 (1º); Horta Circular 4,40 (2º); Água Viva 4,00 (3º) |

São quatro projetos, três critérios e oito avaliações. Instituição, bancas, projetos, critérios e observações identificam a finalidade de teste. As duas bancas estão encerradas e publicadas. Esses registros não representam trabalhos acadêmicos reais e não foram misturados à instituição SENAI CIMATEC.

O arquivo opt-in `supabase/fixtures/podium-lab.sql` registra o procedimento: exige o UUID de um superadministrador existente em `catapimba.seed_owner`, usa as RPCs de negócio e verifica as notas e o empate antes do commit. Só deve ser executado por um operador autorizado no ambiente escolhido. Exemplo no SQL Editor:

```sql
select set_config('catapimba.seed_owner', '<UUID_DO_SUPERADMINISTRADOR_EXISTENTE>', false);
-- Executar em seguida o conteúdo de supabase/fixtures/podium-lab.sql.
```

O script não faz parte das migrations, builds ou inicialização. A repetição reconhece o marcador de auditoria e preserva o laboratório existente, sem sobrescrever alterações. Uma instituição homônima sem o marcador esperado interrompe a operação. Não há reset, truncamento, alteração de regras SQL ou exclusão de dados reais. O laboratório permanece para revisão do responsável.

## Validação desta implementação

- `pnpm run build:web`: tipos e build do frontend concluídos. O backend, contratos e migrations não foram alterados.
- `pnpm test:podium`: quatro testes de regras de elegibilidade, sequência/adaptação/empates, versão do resultado e separação das chaves de visualização.
- `scripts/podium-browser.py`: oito testes Chromium com sessões/API de fixtures; ordem real das revelações, suspense, pausa, primeira visualização/repetição, restrições de publicação, telas de 320 a 1440 px, nomes longos, empate com seis projetos, modo tranquilo, áudio MP3 real, volume, descarte, falha de áudio e pausa por aba oculta. A sequência animada também foi conferida com relógio real e captura de tela; relógios virtuais não simulam integralmente a linha do tempo das animações do navegador.
- `scripts/workspace-browser.py`: 26 testes de regressão passaram, incluindo resultados não publicados sem cerimônia e exportação existente.
- `scripts/login-browser.py`: quatro testes passaram; a tela de login permanece sem o antigo artefato 3D.
- Banco real: execução prévia com rollback, criação persistida e repetição idempotente verificadas; quatro projetos, duas bancas publicadas, oito avaliações e um marcador de auditoria. Outra transação com rollback confirmou que um aluno ativo do laboratório, sem projeto atribuído, lê as duas classificações publicadas e nenhum detalhe de projeto; o acesso à outra instituição foi negado.

Não houve nova rodada indiscriminada de testes HTTP da API, pois os endpoints e regras do servidor permaneceram iguais. Os testes locais não comprovam OAuth Google em um navegador real nem compatibilidade audiovisual em todos os aparelhos. Ainda cabe revisar a experiência com som em celular/Safari, com leitores de tela reais e equipamentos de projeção; a música foi decodificada e controlada pelo Chromium automatizado, sem avaliação auditiva humana. A altura da janela pode exigir rolagem no celular. Publicação em produção depende de autorização separada após a revisão do preview.
