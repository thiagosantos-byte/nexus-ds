# Trilha da premiação

Composição e síntese originais feitas para o Nexus. Não utilizam música do Kahoot, gravações de terceiros nem samples externos. Os arquivos e o código seguem a licença MIT do repositório.

- `anticipation.mp3`: cama instrumental em ré menor, com pads, baixo, arpejo e percussão; loop de 10 segundos.
- `reveal.mp3`: assinatura curta de revelação, 1,8 segundo.
- `victory.mp3`: fanfarra melódica em ré maior com resolução final, 10 segundos.

Reprodução opcional, iniciada por interação do usuário; volume inicial de 25%. Áudio entregue como arquivos estáticos pelo frontend. Para regerar: `python3 scripts/compose-podium.py` (numpy, scipy e ffmpeg no ambiente de desenvolvimento).
