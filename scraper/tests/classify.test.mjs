import assert from "node:assert/strict";
import test from "node:test";
import {
  assignBlock,
  buildSummary,
  classifyFormat,
  classifyProject,
  enrichPost,
  normalizeHandle,
  parseDateRange,
  validateHandle,
} from "../src/classify.mjs";
import { parseProfiles } from "../src/cli.mjs";

const projects = [
  { name: "Contraloría Social", keywords: ["contraloría social"] },
  { name: "Ética e integridad", keywords: ["ética", "integridad"] },
];
const blocks = [
  { code: "A", startHour: 0, endHour: 5 },
  { code: "B", startHour: 6, endHour: 11 },
  { code: "C", startHour: 12, endHour: 17 },
  { code: "D", startHour: 18, endHour: 23 },
];

test("normaliza y valida usuarios de X", () => {
  assert.equal(normalizeHandle("https://x.com/GobiernoPuebla/"), "GobiernoPuebla");
  assert.equal(validateHandle("@Cuenta_01"), "Cuenta_01");
  assert.throws(() => validateHandle("usuario inválido"));
  assert.deepEqual(parseProfiles("@Cuenta_01, segunda\nCUENTA_01"), ["CUENTA_01", "segunda"]);
});

test("clasifica proyectos y formatos", () => {
  assert.equal(classifyProject("Fortalecemos la Contraloría Social", projects), "Contraloría Social");
  assert.equal(classifyProject("Mensaje general", projects), "Otros");
  assert.deepEqual(classifyFormat({ hasVideo: true, hasPhoto: true, text: "" }), { format: "Video", estimated: false });
  assert.equal(classifyFormat({ hasVideo: false, hasPhoto: true, text: "Consulta los requisitos" }).format, "Infografía");
});

test("asigna bloques y valida intervalos", () => {
  assert.equal(assignBlock(0, blocks), "A");
  assert.equal(assignBlock(15, blocks), "C");
  assert.equal(assignBlock(23, blocks), "D");
  assert.doesNotThrow(() => parseDateRange("2026-01-01", "2026-01-31"));
  assert.throws(() => parseDateRange("2026-02-01", "2026-01-31"));
});

test("enriquece publicaciones y genera resumen", () => {
  const post = enrichPost({
    id: "123",
    publishedAt: "2026-08-25T20:30:00.000Z",
    text: "Impulsamos la ética y la integridad",
    url: "https://x.com/cuenta/status/123",
    hasPhoto: false,
    hasVideo: false,
    mediaUrls: [],
  }, { timeZone: "America/Mexico_City", projects, blocks });
  assert.equal(post.dateTime, "2026-08-25 14:30");
  assert.equal(post.block, "C");
  assert.equal(post.project, "Ética e integridad");
  const summary = buildSummary([post], projects);
  assert.equal(summary.total, 1);
  assert.equal(summary.formats.Texto, 1);
  assert.equal(summary.origins.Propia, 1);
});
