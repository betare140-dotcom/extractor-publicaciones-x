const INFOGRAPHIC_HINTS = [
  "infografía",
  "infografia",
  "requisitos",
  "pasos para",
  "conoce los pasos",
  "datos clave",
  "cifras",
  "convocatoria",
  "consulta aquí",
  "consulta aqui",
  "recomendaciones",
];

export function normalizeHandle(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\?.*$/, "")
    .replace(/\/$/, "");
}

export function validateHandle(value) {
  const normalized = normalizeHandle(value);
  if (!/^[A-Za-z0-9_]{1,15}$/.test(normalized)) {
    throw new Error("El usuario de X debe contener entre 1 y 15 letras, números o guiones bajos.");
  }
  return normalized;
}

export function normalizeText(value) {
  return String(value || "")
    .replace(/https?:\/\/t\.co\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function fold(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function summarizeText(value, maxLength = 180) {
  const text = normalizeText(value);
  if (text.length <= maxLength) return text || "Publicación sin texto";
  const shortened = text.slice(0, maxLength + 1);
  const boundary = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, boundary > 80 ? boundary : maxLength).trim()}…`;
}

export function classifyProject(text, projects) {
  const haystack = fold(text);
  let best = null;

  for (const project of projects || []) {
    let score = 0;
    for (const keyword of project.keywords || []) {
      const needle = fold(keyword);
      if (needle && haystack.includes(needle)) score += Math.max(1, needle.split(" ").length);
    }
    if (score > 0 && (!best || score > best.score)) best = { name: project.name, score };
  }

  return best?.name || "Otros";
}

export function classifyFormat(rawPost) {
  if (rawPost.hasVideo) return { format: "Video", estimated: false };
  if (!rawPost.hasPhoto) return { format: "Texto", estimated: false };

  const text = fold(rawPost.text);
  const infographic = INFOGRAPHIC_HINTS.some((hint) => text.includes(fold(hint)));
  return {
    format: infographic ? "Infografía" : "Foto",
    estimated: true,
  };
}

export function localParts(isoDate, timeZone = "America/Mexico_City") {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) throw new Error(`Fecha inválida: ${isoDate}`);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    hour: Number(parts.hour),
    month: Number(parts.month),
  };
}

export function assignBlock(hour, blocks) {
  const match = (blocks || []).find((block) => hour >= block.startHour && hour <= block.endHour);
  return match?.code || "";
}

export function enrichPost(rawPost, options) {
  const parts = localParts(rawPost.publishedAt, options.timeZone);
  const detectedFormat = classifyFormat(rawPost);
  const text = normalizeText(rawPost.text);
  const project = classifyProject(text, options.projects);

  return {
    id: rawPost.id,
    publishedAt: rawPost.publishedAt,
    dateTime: `${parts.date} ${parts.time}`,
    date: parts.date,
    month: parts.month,
    block: assignBlock(parts.hour, options.blocks),
    topic: summarizeText(text),
    fullText: text,
    format: detectedFormat.format,
    origin: "Propia",
    project,
    url: rawPost.url,
    mediaUrls: rawPost.mediaUrls || [],
    needsReview: detectedFormat.estimated || project === "Otros",
  };
}

export function parseDateRange(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(to || "")) {
    throw new Error("Las fechas deben usar el formato YYYY-MM-DD.");
  }
  const start = new Date(`${from}T00:00:00-06:00`);
  const end = new Date(`${to}T23:59:59.999-06:00`);
  if (start > end) throw new Error("La fecha inicial no puede ser posterior a la fecha final.");
  return { start, end };
}

export function buildSummary(posts, projects) {
  const formats = Object.fromEntries(["Foto", "Video", "Infografía", "Texto"].map((key) => [key, 0]));
  const months = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [index + 1, 0]));
  const blocks = Object.fromEntries(["A", "B", "C", "D"].map((key) => [key, 0]));
  const projectCounts = Object.fromEntries([...(projects || []).map((project) => project.name), "Otros"].map((key) => [key, 0]));

  for (const post of posts) {
    formats[post.format] = (formats[post.format] || 0) + 1;
    months[post.month] = (months[post.month] || 0) + 1;
    blocks[post.block] = (blocks[post.block] || 0) + 1;
    projectCounts[post.project] = (projectCounts[post.project] || 0) + 1;
  }

  return {
    total: posts.length,
    origins: { Propia: posts.length, Gobernador: 0, "Gobierno del Estado": 0 },
    formats,
    months,
    blocks,
    projects: projectCounts,
    review: posts.filter((post) => post.needsReview).length,
  };
}
