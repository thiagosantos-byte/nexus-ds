# Área institucional real

A área autenticada está em `/conta` e `/app/*`. Os fluxos de demonstração foram removidos do código de produção. Endereços antigos como `/instituicao`, `/projetos` e `/bancas` encaminham para as áreas reais com autenticação. Caminhos desconhecidos mostram uma página em português, sem conteúdo de exemplo.

## Primeiro uso

1. Entre com Google. O superadministrador existente pode selecionar SENAI CIMATEC no topo e abrir todos os módulos de gestão.
2. As demais pessoas precisam entrar com Google pelo menos uma vez. Podem solicitar acesso em **Meus acessos** escolhendo instituição e papel. Não há concessão pública de administração.
3. Em **Usuários e acessos**, revise solicitações, aprove ou suspenda vínculos e atribua papéis. O superadministrador pode nomear administradores institucionais; estes gerenciam os demais perfis, sem promover a si mesmos ou administrar outros administradores.
4. Cadastre projetos e vincule alunos e orientadores ativos. Cada projeto já representa uma equipe; não há entidade de equipe independente nesta entrega.
5. Cadastre critérios, pesos e cinco descritores. Prepare uma banca, selecione projetos e avaliadores e abra as avaliações.
6. Cada avaliador atribuído envia notas inteiras de 1 a 5. Pode revisar enquanto a banca estiver aberta. O envio repetido atualiza a avaliação existente e não duplica seu peso.
7. Encerre quando todas as combinações projeto × avaliador tiverem avaliação. Depois publique os resultados. Publicar e ocultar são ações distintas do encerramento.
8. Consulte relatórios CSV, classificação, [pódio individual com suspense e música opcional](podium.md), e auditoria. A cerimônia exige banca encerrada, completa e publicada; membros ativos da instituição podem assistir, mesmo sem integrar os projetos premiados.

No celular, use **Abrir menu** no cabeçalho para ver todos os módulos permitidos. O menu aceita teclado e Escape. Tabelas podem ser percorridas horizontalmente dentro da região identificada, também acessível pelo teclado.

## Permissões

| Perfil | Acesso |
| --- | --- |
| Superadministrador | Instituições, nomeação de administradores e gestão nas instituições ativas |
| Administrador institucional | Usuários, projetos/equipes, critérios, bancas, resultados, relatórios e auditoria da instituição |
| Coordenador | Consulta projetos, organiza bancas, atribui avaliadores, encerra/publica e exporta resultados |
| Orientador | Consulta projetos vinculados, equipes, bancas relacionadas e resultados publicados |
| Avaliador | Consulta projetos e bancas atribuídos, envia/revisa suas avaliações enquanto abertas |
| Aluno | Consulta projetos vinculados e altera somente sua descrição; consulta resultados publicados |

Cada vínculo institucional possui exatamente um papel real; a mesma conta pode ter papéis diferentes em instituições diferentes. Se uma migração encontrar vários papéis em um vínculo, ela registra a lista anterior em uma tabela privada de auditoria e conserva o papel de maior privilégio na ordem Administrador institucional, Coordenador, Avaliador, Orientador e Aluno. A conta de apresentação explicitamente allowlisted pode ativar um papel de demonstração por sessão e instituição; a autorização é verificada no banco em cada operação, o contexto é auditado e os privilégios globais de superadministrador ficam suspensos durante a demonstração. Suspensão da instituição ou vínculo bloqueia novas operações. Resultados publicados são visíveis aos membros ativos da instituição inteira, sem conceder acesso aos detalhes dos projetos de outras equipes.

## Cálculo e ciclo das bancas

Cada avaliação usa `soma(nota × peso) / soma(pesos)`. O resultado do projeto é a média entre as avaliações, arredondada a quatro casas para classificação. Se a gestão institucional definir um critério ativo como prioritário, empates na média final são resolvidos pela maior média nesse critério; a escolha fica congelada no momento em que a banca é aberta. Se também houver empate no critério prioritário, os projetos compartilham a posição (`dense_rank`). A interface mostra duas casas. Antes do encerramento os resultados são parciais e restritos à gestão.

Abrir a banca congela critérios, descritores e pesos. Alterar o cadastro de critérios depois não muda avaliações daquela banca. Projetos e avaliadores só são editados durante a preparação. Cancelamento preserva os registros e não gera premiação. Não é possível reabrir banca encerrada nesta entrega. Se um avaliador abandonar uma banca aberta com pendências, cancele e prepare outra banca com a composição correta.

## Segurança implementada

Express valida a sessão com Supabase Auth e encaminha o JWT do próprio usuário junto com a chave publicável. Não utiliza `service_role`, senha de banco nem papel privilegiado de conexão. As tabelas têm RLS e permitem apenas SELECT autenticado com políticas de escopo. Escritas passam por RPCs autorizadas e auditadas na mesma transação.

As RPCs públicas são SECURITY INVOKER. Elas chamam funções SECURITY DEFINER no schema `private`, com `search_path=''`, privilégios explicitamente restritos e verificações de `auth.uid()`, instituição ativa, vínculo ativo, papéis e associação do recurso. Como essas funções elevadas ultrapassam RLS, sua proteção depende dessas verificações explícitas, que também são testadas. A função interna de classificação não é executável diretamente pelos clientes.

E-mails de terceiros são expostos apenas à gestão de usuários da instituição. O coordenador recebe um diretório de avaliadores ativos sem e-mails. Relatórios não incluem e-mails. CSV neutraliza fórmulas e escapa campos. A auditoria não guarda texto livre das avaliações. O frontend nunca determina os privilégios do servidor.

O aviso de RLS sem política em `private.audit_events` é intencional: acesso direto é negado; leitura e escrita são mediadas pelas funções autorizadas. O aviso de proteção contra senhas vazadas refere-se à configuração Auth: este aplicativo usa Google, sem formulário de senha.

## Testes verificáveis

- `pnpm run build:web` e `pnpm run build:api`: tipos e builds separados.
- `pnpm test:routing`: 17 testes HTTP, com Supabase simulado para validação de transporte, erros, identidade encaminhada, exportação e regressões de roteamento.
- `supabase/tests/workspace.sql`: testes SQL no PostgreSQL real em transação com rollback.
- `supabase/tests/single-role-demo.sql`: cardinalidade de um papel por vínculo, troca temporária allowlisted, restauração do papel real e bloqueio de alternância para contas não autorizadas. Cobrem aprovação, papéis institucionais, isolamento, SELECT direto com RLS, edição restrita de aluno, pesos congelados, notas inválidas, envio duplicado, encerramento, publicação, empates, suspensão e auditoria.
- `supabase/tests/platform-institutions.sql`: administração global sem vínculo e concessão controlada/revogação.
- `scripts/workspace-browser.py`: testes opcionais com Python Playwright e Chromium em `/usr/bin/chromium`, contra `vite preview` na porta 5173. Fixtures e sessão simulada ficam exclusivamente nesse teste, sem conexão ao banco. Cobrem os seis perfis, rotas antigas, páginas públicas, carregamento/erros, saída da sessão, solicitação de acesso, filtros vazios, formulários, confirmação por teclado, resultados, exportação, navegação móvel e responsividade. Não substituem OAuth Google real nem a homologação dos fluxos com contas institucionais.

Para executar o navegador:

```bash
pnpm --filter @workspace/startup-institution-platform run build
pnpm --filter @workspace/startup-institution-platform exec vite preview --host 127.0.0.1 --port 5173
# Em outro terminal, com Playwright Python e Chromium instalados:
python3 scripts/workspace-browser.py
```

As variáveis opcionais `CATAPIMBA_TEST_ORIGIN`, `CATAPIMBA_CHROMIUM` e `CATAPIMBA_TEST_ARTIFACTS` substituem o endereço local, binário e pasta de capturas. Capturas contêm apenas fixtures, não contas reais.

## Identidade e comportamento das ações

`/solicitar-acesso` explica o procedimento e encaminha para **Meus acessos**; não envia dados. A solicitação verdadeira usa `access.request` na API e só aparece como pendente após a resposta real e a releitura da identidade. Um erro mantém o formulário e não confirma sucesso.

`/recuperar-senha` informa que não existe senha Nexus e oferece a recuperação do próprio Google. Não há formulário nem promessa de envio de e-mail. Login e callback mantêm PKCE e as URLs autorizadas existentes.

A saída usa `supabase.auth.signOut({ scope: 'local' })`. Se o SDK limpar o navegador mas falhar na revogação remota, a interface explica essa condição em vez de afirmar sucesso completo ou exibir dados da conta. Como no próprio Supabase, um access token já emitido pode permanecer válido até expirar.

O visual é compartilhado entre páginas públicas, autenticação e módulos, com fontes do sistema (sem requisição ao Google Fonts), contraste, foco visível, redimensionamento e respeito a movimento reduzido. Cancelar banca e suspender instituição exigem confirmação acessível, preservando os registros existentes.


## Limites para a próxima rodada

Esta entrega é um núcleo funcional para homologação. Ainda exige teste manual com contas reais de cada perfil antes de uso institucional. Não inclui anexos, notificações por e-mail, convites por SMTP, relatórios PDF, recuperação de banca encerrada, equipe reutilizável entre projetos ou integração acadêmica externa.

A leitura do contexto institucional retorna os recursos autorizados em um único JSON; antes de grandes volumes, implementar paginação e limites de exportação. Monitorar cotas dos planos gratuitos. Não foi contratado serviço pago. A produção usa a branch `main`; recursos em branches de trabalho dependem de revisão e autorização para publicação. O histórico das implantações está em [deployment.md](deployment.md).

LGPD ainda requer decisões institucionais sobre finalidade, base legal, retenção/exclusão, política de privacidade, responsáveis pelo tratamento e atendimento a titulares. Controle técnico de acesso não equivale a conformidade jurídica completa. Backup, recuperação, limites de requisições e operação em escala precisam de homologação própria.

## Evidência do refinamento

Consulte [refinement-validation.md](refinement-validation.md) para alterações, os 23 testes de navegador executados nesta rodada, comparação de tamanho do build e limites da validação local. O código refinado foi consolidado na `main`; os registros históricos de publicação estão em `refinement-validation.md`; a arquitetura atual está em `deployment.md`.


## Consulta unificada e encerramento de banca

A navegação **Resultados e relatórios** reúne a classificação da banca, a listagem do portfólio e as exportações. Os filtros de ano, semestre e aluno são aplicados à listagem visível e à classificação; quando exportado, o arquivo Excel usa os mesmos filtros. A exportação continua restrita à gestão institucional.

Depois que uma banca é encerrada, os projetos associados e suas equipes ficam congelados. A interface oculta as ações de edição e a camada PostgreSQL rejeita alterações diretas no projeto ou nos participantes, preservando a integridade do resultado encerrado. Projetos que não participaram de uma banca encerrada continuam editáveis conforme as permissões existentes.
