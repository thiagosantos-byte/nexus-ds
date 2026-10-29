# Relatórios e exportação

A área **Relatórios e exportação** oferece planilhas Excel reais (.xlsx) para o portfólio de projetos e para os resultados de uma banca. A API mantém CSV como formato padrão para clientes antigos; solicite Excel com o parâmetro `format=xlsx`.

## Exportação do portfólio

O arquivo `nexus-projects.xlsx` inclui nome, descrição, categoria, etapa, ano e semestre. Os filtros opcionais são aplicados no servidor:

- `year`: ano entre 2000 e 2200;
- `semester`: `1` ou `2`;
- `student`: UUID de um aluno associado a um projeto acessível.

Exemplo: `GET /api/workspace/{institutionId}/export?type=projects&format=xlsx&year=2026&semester=2&student={studentId}`.

Um identificador de aluno que não esteja associado aos projetos visíveis resulta em uma planilha sem linhas de dados. Os filtros de período inválidos recebem HTTP 400. O backend continua exigindo sessão válida e permissão de gestão; os dados são lidos do contexto institucional autorizado, nunca de parâmetros fornecidos pelo frontend como fonte de autorização.

## Resultados da banca

Use `type=results&event={eventId}&format=xlsx`. O arquivo contém banca, projeto, posição, média, quantidade de avaliações recebidas/esperadas e estado de publicação. O ID da banca é validado contra os resultados retornados para a instituição atual.

## Implementação e validação

O XLSX é gerado pelo backend sem dependência de pacote externo: o arquivo ZIP contém as partes Open XML de um workbook e uma planilha. Valores textuais são células de texto literal, não fórmulas. CSV continua disponível e mantém escape de campos e neutralização de fórmulas.

Testes automatizados cobrem cabeçalhos/assinatura ZIP do XLSX, texto literal, filtros de ano/semestre/aluno, filtro inválido, autorização de exportação e a compatibilidade CSV. Execute `pnpm test:routing` após `pnpm run build:api`.
