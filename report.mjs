import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSummary, enrichPost, parseDateRange, validateHandle } from "./classify.mjs";
import { exportAll } from "./exporters.mjs";
import { scrapeXProfile } from "./scraper.mjs";

const currentFile = fileURLToPath(import.meta.url);
const scraperRoot = path.resolve(path.dirname(currentFile), "..");

function parseArguments(argv) {
  return Object.fromEntries(argv.slice(2).map((argument) => {
    const match = argument.match(/^--([^=]+)=(.*)$/s);
    if (!match) throw new Error(`Argumento inválido: ${argument}. Usa --nombre=valor.`);
    return [match[1], match[2]];
  }));
}

export function parseProfiles(value) {
  const handles = String(value || "")
    .split(/[\n,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(validateHandle);
  const unique = [...new Map(handles.map((handle) => [handle.toLowerCase(), handle])).values()];
  if (!unique.length) throw new Error("Escribe al menos un perfil de X.");
  if (unique.length > 20) throw new Error("La ejecución admite un máximo de 20 perfiles.");
  return unique;
}

async function loadJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(scraperRoot, relativePath), "utf8"));
}

async function appendStepSummary({ from, to, completed, failures }) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  const totalPosts = completed.reduce((sum, result) => sum + result.total, 0);
  const successLines = completed.map((result) => `- @${result.handle}: ${result.total} publicaciones`).join("\n");
  const failureLines = failures.length
    ? `\n### Perfiles no completados\n${failures.map((failure) => `- @${failure.handle}: ${failure.message}`).join("\n")}\n`
    : "";
  await fs.appendFile(summaryPath, `## Extracción terminada\n\n- Periodo: ${from} a ${to}\n- Perfiles completados: ${completed.length}\n- Publicaciones: ${totalPosts}\n\n${successLines}${failureLines}`);
}

async function main() {
  const args = parseArguments(process.argv);
  const handles = parseProfiles(args.perfiles || args.usuarios || args.usuario || args.handle);
  const from = args.desde || args.from;
  const to = args.hasta || args.to;
  const maxPosts = Math.min(5000, Math.max(1, Number(args.maximo || args.max || 1000)));
  if (!Number.isFinite(maxPosts)) throw new Error("El máximo de publicaciones debe ser un número.");
  const timeZone = "America/Mexico_City";
  const { start, end } = parseDateRange(from, to);
  const projects = await loadJson("config/projects.json");
  const blocks = await loadJson("config/blocks.json");
  const outputDir = path.join(scraperRoot, "output");
  const skipPdf = args["skip-pdf"] === "true";
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  const completed = [];
  const failures = [];
  for (const handle of handles) {
    try {
      let rawPosts;
      let diagnostics;
      if (args.fixture) {
        rawPosts = JSON.parse(await fs.readFile(path.resolve(args.fixture), "utf8"));
        diagnostics = { fixture: true, uniqueOwnPostsSeen: rawPosts.length, iterations: 0 };
      } else {
        console.log(`\nConsultando publicaciones públicas de @${handle} entre ${from} y ${to}…`);
        const result = await scrapeXProfile({ handle, start, end, maxPosts, timeZone });
        rawPosts = result.posts;
        diagnostics = result.diagnostics;
      }

      const posts = rawPosts
        .map((post) => enrichPost(post, { timeZone, projects, blocks }))
        .sort((left, right) => new Date(left.publishedAt) - new Date(right.publishedAt));
      const summary = buildSummary(posts, projects);
      const metadata = { handle, from, to, timeZone };
      const profileOutput = handles.length > 1 ? path.join(outputDir, handle) : outputDir;
      const files = await exportAll({ outputDir: profileOutput, metadata, posts, summary, projects, diagnostics, skipPdf });
      completed.push({ handle, total: summary.total, review: summary.review, files: Object.values(files).map((file) => path.relative(outputDir, file)) });
      console.log(`Extracción de @${handle} terminada: ${summary.total} publicaciones.`);
    } catch (error) {
      failures.push({ handle, message: error.message });
      console.error(`No se completó @${handle}: ${error.message}`);
    }
  }

  const runSummary = { from, to, maxPosts, completed, failures };
  await fs.writeFile(path.join(outputDir, "resumen_ejecucion.json"), JSON.stringify(runSummary, null, 2), "utf8");
  await appendStepSummary({ from, to, completed, failures });
  if (!completed.length) throw new Error("No se pudo completar ninguno de los perfiles solicitados.");

  console.log(`\nProceso terminado: ${completed.length} de ${handles.length} perfiles completados.`);
  if (failures.length) console.log("Consulta resumen_ejecucion.json para ver los perfiles pendientes.");
}

if (path.resolve(process.argv[1] || "") === currentFile) {
  main().catch((error) => {
    console.error(`\nNo se pudo completar la extracción: ${error.message}`);
    if (process.env.ACTIONS_STEP_DEBUG === "true") console.error(error.stack);
    process.exitCode = 1;
  });
}
