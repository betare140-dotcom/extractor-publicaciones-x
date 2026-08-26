import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { chromium } from "playwright";
import { buildReportHtml } from "./report.mjs";

const CSV_HEADERS = [
  "Fecha y Hora",
  "Bloque Operativo",
  "Texto/Tema Principal",
  "Formato",
  "Origen",
  "Proyecto / Categoría",
];
const MONTHS = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvContent(posts) {
  const rows = posts.map((post) => [post.dateTime, post.block, post.topic, post.format, post.origin, post.project]);
  return `\uFEFF${[CSV_HEADERS, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function styleTitle(cell) {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 15 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF073C37" } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
}

function styleHeader(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16685E" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FFB6C9C5" } } };
  });
}

function addSection(sheet, titleRange, title, headerRow, headers, values) {
  sheet.mergeCells(titleRange);
  const titleCell = sheet.getCell(titleRange.split(":")[0]);
  titleCell.value = title;
  titleCell.font = { bold: true, color: { argb: "FF073C37" }, size: 12 };
  titleCell.alignment = { horizontal: "center" };
  const row = sheet.getRow(headerRow);
  headers.forEach((header, index) => { row.getCell(index + 1).value = header; });
  styleHeader(row);
  const valueRow = sheet.getRow(headerRow + 1);
  values.forEach((value, index) => { valueRow.getCell(index + 1).value = value; });
  valueRow.alignment = { horizontal: "center" };
}

async function exportWorkbook(filePath, metadata, posts, summary, projects) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Extractor institucional de X";
  workbook.created = new Date();
  workbook.modified = new Date();

  const detail = workbook.addWorksheet("Publicaciones", { views: [{ state: "frozen", ySplit: 3 }] });
  detail.mergeCells("A1:J1");
  detail.getCell("A1").value = `PUBLICACIONES DE X - @${metadata.handle}`;
  styleTitle(detail.getCell("A1"));
  detail.getRow(1).height = 28;
  detail.mergeCells("A2:J2");
  detail.getCell("A2").value = `Periodo: ${metadata.from} al ${metadata.to} · Orden: más antigua a más reciente`;
  detail.getCell("A2").alignment = { horizontal: "center" };
  detail.getCell("A2").font = { color: { argb: "FF66756F" }, italic: true, size: 10 };

  const headers = [...CSV_HEADERS, "Texto completo", "Enlace", "ID", "Revisión"];
  const headerRow = detail.getRow(3);
  headers.forEach((header, index) => { headerRow.getCell(index + 1).value = header; });
  styleHeader(headerRow);

  for (const post of posts) {
    detail.addRow([
      post.dateTime,
      post.block,
      post.topic,
      post.format,
      post.origin,
      post.project,
      post.fullText,
      post.url,
      post.id,
      post.needsReview ? "Revisar" : "Listo",
    ]);
  }
  detail.autoFilter = { from: "A3", to: "J3" };
  detail.columns = [
    { width: 19 }, { width: 11 }, { width: 42 }, { width: 14 }, { width: 13 },
    { width: 31 }, { width: 64 }, { width: 43 }, { width: 23 }, { width: 12 },
  ];
  detail.eachRow((row, rowNumber) => {
    if (rowNumber > 3) {
      row.alignment = { vertical: "top", wrapText: true };
      row.height = 36;
      row.eachCell((cell) => {
        cell.border = { bottom: { style: "hair", color: { argb: "FFDDE6E3" } } };
      });
    }
  });
  detail.getColumn(8).eachCell((cell, rowNumber) => {
    if (rowNumber > 3) cell.font = { color: { argb: "FF1254BD" }, underline: true };
  });

  const report = workbook.addWorksheet("Resumen", { views: [{ showGridLines: false }] });
  report.mergeCells("A1:N1");
  report.getCell("A1").value = `RESUMEN DE PUBLICACIONES - X - @${metadata.handle}`;
  styleTitle(report.getCell("A1"));
  report.getRow(1).height = 30;

  report.mergeCells("A3:D3");
  report.getCell("A3").value = "ORIGEN";
  report.getCell("A3").font = { bold: true, color: { argb: "FF073C37" }, size: 12 };
  report.getCell("A3").alignment = { horizontal: "center" };
  ["PROPIAS", "GOBERNADOR", "GOBIERNO DEL ESTADO", "TOTAL"].forEach((header, index) => {
    report.getRow(4).getCell(index + 1).value = header;
  });
  styleHeader(report.getRow(4));
  report.getRow(4).height = 30;
  report.getRow(5).values = [summary.origins.Propia, summary.origins.Gobernador, summary.origins["Gobierno del Estado"], summary.total];
  report.getRow(5).alignment = { horizontal: "center" };

  report.mergeCells("F3:G3");
  report.getCell("F3").value = "FORMATO";
  report.getCell("F3").font = { bold: true, color: { argb: "FF073C37" }, size: 12 };
  report.getCell("F3").alignment = { horizontal: "center" };
  report.getRow(4).getCell(6).value = "TIPO";
  report.getRow(4).getCell(7).value = "TOTAL";
  for (const cell of [report.getCell("F4"), report.getCell("G4")]) {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16685E" } };
    cell.alignment = { horizontal: "center" };
  }
  Object.entries(summary.formats).forEach(([label, value], index) => {
    report.getCell(5 + index, 6).value = label.toUpperCase();
    report.getCell(5 + index, 7).value = value;
  });

  report.mergeCells("I3:J3");
  report.getCell("I3").value = "TOTAL DE PUBLICACIONES POR MES";
  report.getCell("I3").font = { bold: true, color: { argb: "FF073C37" }, size: 12 };
  report.getCell("I3").alignment = { horizontal: "center" };
  report.getCell("I4").value = "MES";
  report.getCell("J4").value = "TOTAL";
  for (const cell of [report.getCell("I4"), report.getCell("J4")]) {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16685E" } };
    cell.alignment = { horizontal: "center" };
  }
  MONTHS.forEach((month, index) => {
    report.getCell(5 + index, 9).value = month;
    report.getCell(5 + index, 10).value = summary.months[index + 1] || 0;
  });
  report.getCell("I17").value = "TOTAL";
  report.getCell("J17").value = { formula: "SUM(J5:J16)", result: summary.total };

  report.mergeCells("A9:B9");
  report.getCell("A9").value = "PROYECTOS / CATEGORÍAS";
  report.getCell("A9").font = { bold: true, color: { argb: "FF073C37" }, size: 12 };
  report.getCell("A9").alignment = { horizontal: "center" };
  report.getCell("A10").value = "PROYECTO";
  report.getCell("B10").value = "TOTAL";
  for (const cell of [report.getCell("A10"), report.getCell("B10")]) {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16685E" } };
  }
  [...projects.map((project) => project.name), "Otros"].forEach((name, index) => {
    report.getCell(11 + index, 1).value = name;
    report.getCell(11 + index, 2).value = summary.projects[name] || 0;
  });

  report.mergeCells("D9:E9");
  report.getCell("D9").value = "BLOQUES OPERATIVOS";
  report.getCell("D9").font = { bold: true, color: { argb: "FF073C37" }, size: 12 };
  report.getCell("D9").alignment = { horizontal: "center" };
  report.getCell("D10").value = "BLOQUE";
  report.getCell("E10").value = "TOTAL";
  for (const cell of [report.getCell("D10"), report.getCell("E10")]) {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16685E" } };
  }
  Object.entries(summary.blocks).forEach(([label, value], index) => {
    report.getCell(11 + index, 4).value = label;
    report.getCell(11 + index, 5).value = value;
  });

  report.columns = [
    { width: 34 }, { width: 14 }, { width: 26 }, { width: 14 }, { width: 14 }, { width: 19 }, { width: 12 }, { width: 3 }, { width: 18 }, { width: 12 },
  ];
  report.eachRow((row, rowNumber) => {
    if (rowNumber > 1) row.alignment = { vertical: "middle", wrapText: true };
  });

  const config = workbook.addWorksheet("Configuración", { views: [{ showGridLines: false }] });
  config.getRow(1).values = ["Campo", "Valor"];
  styleHeader(config.getRow(1));
  [
    ["Cuenta", `@${metadata.handle}`],
    ["Fecha inicial", metadata.from],
    ["Fecha final", metadata.to],
    ["Zona horaria", metadata.timeZone],
    ["Regla de inclusión", "Publicaciones propias; se excluyen reposts y respuestas"],
    ["Bloques", "A 00-05; B 06-11; C 12-17; D 18-23"],
    ["Nota de formato", "Foto/Infografía es una estimación y requiere revisión"],
  ].forEach((row) => config.addRow(row));
  config.columns = [{ width: 25 }, { width: 78 }];
  config.getColumn(2).alignment = { wrapText: true, vertical: "top" };

  await workbook.xlsx.writeFile(filePath);
}

async function exportPdf(html, htmlPath, pdfPath) {
  await fs.writeFile(htmlPath, html, "utf8");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1320, height: 1020 } });
    await page.setContent(html, { waitUntil: "load" });
    await page.pdf({
      path: pdfPath,
      format: "Letter",
      landscape: true,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  } finally {
    await browser.close().catch(() => {});
  }
}

export async function exportAll({ outputDir, metadata, posts, summary, projects, diagnostics, skipPdf = false }) {
  await fs.mkdir(outputDir, { recursive: true });
  const stem = `${metadata.handle}_${metadata.from}_${metadata.to}`;
  const files = {
    csv: path.join(outputDir, `publicaciones_${stem}.csv`),
    json: path.join(outputDir, `datos_${stem}.json`),
    xlsx: path.join(outputDir, `dependencia_${stem}.xlsx`),
    html: path.join(outputDir, `reporte_${stem}.html`),
  };

  await fs.writeFile(files.csv, csvContent(posts), "utf8");
  await fs.writeFile(files.json, JSON.stringify({ metadata, diagnostics, summary, posts }, null, 2), "utf8");
  await exportWorkbook(files.xlsx, metadata, posts, summary, projects);
  const html = buildReportHtml({ ...metadata, projects, posts, summary });
  if (skipPdf) {
    await fs.writeFile(files.html, html, "utf8");
  } else {
    files.pdf = path.join(outputDir, `reporte_${stem}.pdf`);
    await exportPdf(html, files.html, files.pdf);
  }
  return files;
}
