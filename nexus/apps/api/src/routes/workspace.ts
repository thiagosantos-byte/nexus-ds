import { Router, type Response } from "express";
import { authenticate } from "../lib/identity";

export const workspaceRouter = Router();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const actions = new Set([
  "access.request",
  "member.save",
  "project.save",
  "project.team",
  "criterion.save",
  "criterion.tiebreaker",
  "event.save",
  "event.status",
  "event.publish",
  "evaluation.submit",
]);
function failure(res: Response, error: { code?: string; message?: string }) {
  const status =
    error.code === "42501"
      ? 403
      : error.code === "P0002"
        ? 404
        : [
              "22023",
              "22P02",
              "22007",
              "22008",
              "23502",
              "23503",
              "23505",
              "23514",
            ].includes(error.code ?? "")
          ? 400
          : 503;
  const message =
    status === 403
      ? "Você não possui acesso a esta operação neste contexto."
      : status === 404
        ? "Registro não encontrado neste contexto."
        : status === 400
          ? error.code === "22023" &&
            error.message &&
            /[áéíóúãõç]/i.test(error.message)
            ? error.message
            : "Verifique os campos e vínculos informados."
          : "Não foi possível concluir a operação. Tente novamente.";
  res.status(status).json({ error: message });
}
workspaceRouter.get("/workspace/catalog", async (req, res) => {
  const identity = await authenticate(req, res);
  if (!identity) return;
  const { data, error } = await identity.client.rpc("workspace_catalog");
  if (error) {
    failure(res, error);
    return;
  }
  res.json(data);
});
workspaceRouter.post("/workspace/:institutionId/demo-role", async (req, res) => {
  const identity = await authenticate(req, res);
  if (!identity) return;
  const body = req.body;
  if (
    !uuid.test(String(req.params.institutionId)) ||
    !body || Array.isArray(body) ||
    Object.keys(body).some((key) => key !== "role") ||
    (body.role !== null && typeof body.role !== "string") ||
    (typeof body.role === "string" && !["institution_admin", "coordinator", "mentor", "evaluator", "student"].includes(body.role))
  ) {
    res.status(400).json({ error: "Perfil de demonstração inválido." });
    return;
  }
  const { data, error } = await identity.client.rpc("demo_role_switch", {
    p_institution: req.params.institutionId,
    p_role: body.role,
  });
  if (error) {
    failure(res, error);
    return;
  }
  res.json(data);
});
workspaceRouter.get("/workspace/:institutionId", async (req, res) => {
  const identity = await authenticate(req, res);
  if (!identity) return;
  if (!uuid.test(String(req.params.institutionId))) {
    res.status(400).json({ error: "Instituição inválida." });
    return;
  }
  const { data, error } = await identity.client.rpc("workspace_read", {
    p_institution: req.params.institutionId,
  });
  if (error) {
    failure(res, error);
    return;
  }
  res.json(data);
});
workspaceRouter.post("/workspace/:institutionId/commands", async (req, res) => {
  const identity = await authenticate(req, res);
  if (!identity) return;
  const body = req.body;
  if (
    !uuid.test(String(req.params.institutionId)) ||
    !body ||
    Array.isArray(body) ||
    Object.keys(body).some((k) => !["action", "data"].includes(k)) ||
    !actions.has(body.action) ||
    !body.data ||
    typeof body.data !== "object" ||
    Array.isArray(body.data)
  ) {
    res.status(400).json({ error: "Operação ou dados inválidos." });
    return;
  }
  if (body.action === "criterion.tiebreaker") {
    if (
      Object.keys(body.data).length !== 1 ||
      !uuid.test(String(body.data.id ?? ""))
    ) {
      res.status(400).json({ error: "Critério de desempate inválido." });
      return;
    }
    const { data, error } = await identity.client.rpc("workspace_set_tiebreaker", {
      p_institution: req.params.institutionId,
      p_criterion: body.data.id,
    });
    if (error) {
      failure(res, error);
      return;
    }
    res.json(data);
    return;
  }
  const { data, error } = await identity.client.rpc("workspace_command", {
    p_institution: req.params.institutionId,
    p_action: body.action,
    p_data: body.data,
  });
  if (error) {
    failure(res, error);
    return;
  }
  res.json(data);
});

function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index: number) {
  let name = "";
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26))
    name = String.fromCharCode(65 + ((value - 1) % 26)) + name;
  return name;
}

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Small dependency-free XLSX writer. Cells are written as text or numbers;
// user-provided text is never interpreted as a spreadsheet formula.
export function xlsxBuffer(rows: unknown[][], sheetName = "Relatorio") {
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, colIndex) => {
      const ref = `${columnName(colIndex)}${rowIndex + 1}`;
      if (typeof value === "number" && Number.isFinite(value))
        return `<c r="${ref}"><v>${value}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const safeSheetName = xmlEscape(sheetName.slice(0, 31) || "Relatorio");
  const files: Array<[string, string]> = [
    ["[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
    ["_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safeSheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
    ["xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`],
  ];
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of files) {
    const nameBytes = Buffer.from(name);
    const body = Buffer.from(content);
    const crc = crc32(body);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(body.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    local.push(header, nameBytes, body);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(body.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);
    offset += header.length + nameBytes.length + body.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBytes, end]);
}

export function csvCell(value: unknown) {
  let cell = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(cell) || /^[\t\r]/.test(cell)) cell = `'${cell}`;
  return `"${cell.replaceAll('"', '""')}"`;
}
workspaceRouter.get("/workspace/:institutionId/export", async (req, res) => {
  const identity = await authenticate(req, res);
  if (!identity) return;
  if (
    !uuid.test(String(req.params.institutionId)) ||
    !["projects", "results"].includes(String(req.query.type)) ||
    (req.query.format !== undefined && !["csv", "xlsx"].includes(String(req.query.format)))
  ) {
    res.status(400).json({ error: "Exportação inválida." });
    return;
  }
  const { data, error } = await identity.client.rpc("workspace_read", {
    p_institution: req.params.institutionId,
  });
  if (error) {
    failure(res, error);
    return;
  }
  if (!data.capabilities.manageEvents) {
    res
      .status(403)
      .json({ error: "Exportação restrita à gestão institucional." });
    return;
  }
  const year = req.query.year === undefined ? null : Number(req.query.year);
  const semester = req.query.semester === undefined ? null : Number(req.query.semester);
  if ((year !== null && (!Number.isInteger(year) || year < 2000 || year > 2200)) ||
      (semester !== null && ![1, 2].includes(semester))) {
    res.status(400).json({ error: "Filtros de período inválidos." });
    return;
  }
  let rows: unknown[][];
  if (req.query.type === "projects") {
    const requestedStudent = typeof req.query.student === "string" ? req.query.student : "";
    const allowedStudentIds = new Set(
      (Array.isArray(data.participants) ? data.participants : [])
        .filter((participant: { kind: string; user_id: string }) => participant.kind === "student")
        .map((participant: { user_id: string }) => participant.user_id),
    );
    if (requestedStudent && !allowedStudentIds.has(requestedStudent)) {
      rows = [["Projeto", "Descrição", "Categoria", "Etapa", "Ano", "Semestre"]];
    } else {
      const projects = data.projects.filter((project: Record<string, unknown>) =>
        (year === null || project.year === year) &&
        (semester === null || project.semester === semester) &&
        (!requestedStudent || (Array.isArray(data.participants) ? data.participants : []).some((participant: { project_id: string; user_id: string; kind: string }) =>
          participant.project_id === project.id && participant.user_id === requestedStudent && participant.kind === "student")),
      );
      rows = [
        ["Projeto", "Descrição", "Categoria", "Etapa", "Ano", "Semestre"],
        ...projects.map((p: Record<string, unknown>) => [
          p.name, p.summary, p.category, p.stage, p.year, p.semester,
        ]),
      ];
    }
  } else {
    const event = data.results.find(
      (e: { event_id: string }) => e.event_id === req.query.event,
    );
    if (!event) {
      res.status(404).json({ error: "Banca não encontrada neste contexto." });
      return;
    }
    const requestedStudent = typeof req.query.student === "string" ? req.query.student : "";
    const allowedStudentIds = new Set(
      (Array.isArray(data.participants) ? data.participants : [])
        .filter((participant: { kind: string; user_id: string }) => participant.kind === "student")
        .map((participant: { user_id: string }) => participant.user_id),
    );
    const hasFilters = year !== null || semester !== null || requestedStudent !== "";
    const resultRows = !hasFilters ? event.rows : event.rows.filter((row: Record<string, unknown>) => {
      const project = data.projects.find((candidate: Record<string, unknown>) => candidate.id === row.id);
      if (!project) return false;
      return (year === null || project.year === year) &&
        (semester === null || project.semester === semester) &&
        (!requestedStudent || (allowedStudentIds.has(requestedStudent) &&
          (Array.isArray(data.participants) ? data.participants : []).some((participant: { project_id: string; user_id: string; kind: string }) =>
            participant.project_id === row.id && participant.user_id === requestedStudent && participant.kind === "student")));
    });
    rows = [
      [
        "Banca",
        "Projeto",
        "Posição",
        "Média",
        "Avaliações",
        "Esperadas",
        "Publicado",
      ],
      ...resultRows.map((r: Record<string, unknown>) => [
        event.name,
        r.name,
        r.position,
        r.score,
        r.submitted,
        r.expected,
        event.published ? "Sim" : "Não",
      ]),
    ];
  }
  if (req.query.format === "xlsx") {
    const workbook = xlsxBuffer(rows, req.query.type === "projects" ? "Projetos" : "Resultados");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="nexus-${req.query.type}.xlsx"`);
    res.send(workbook);
    return;
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="nexus-${req.query.type}.csv"`,
  );
  res.send(
    "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n"),
  );
});
