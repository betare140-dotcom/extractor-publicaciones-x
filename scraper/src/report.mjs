const MONTHS = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
const FORMAT_COLORS = {
  Foto: "#b7b7b7",
  Video: "#b05498",
  "Infografía": "#f4d34f",
  Texto: "#1254bd",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function percent(value, total) {
  return total ? `${((value / total) * 100).toFixed(1)}%` : "0.0%";
}

function barChart(items, color = "#477bf0") {
  const max = Math.max(1, ...items.map((item) => item.value));
  return `<div class="bar-chart">${items.map((item) => `
    <div class="bar-item">
      <div class="bar-value">${item.value}</div>
      <div class="bar-track"><div class="bar-fill" style="height:${Math.max(item.value ? 8 : 0, (item.value / max) * 100)}%;background:${item.color || color}"></div></div>
      <div class="bar-label">${escapeHtml(item.label)}</div>
    </div>`).join("")}</div>`;
}

function donut(summary) {
  const entries = Object.entries(summary.formats);
  let offset = 0;
  const stops = entries.map(([name, value]) => {
    const start = offset;
    offset += summary.total ? (value / summary.total) * 360 : 0;
    return `${FORMAT_COLORS[name]} ${start}deg ${offset}deg`;
  });
  if (!summary.total) stops.push("#e5e7eb 0deg 360deg");
  return `<div class="donut" style="background:conic-gradient(${stops.join(",")})"><div><strong>${summary.total}</strong><span>TOTAL</span></div></div>`;
}

function topProject(summary) {
  return Object.entries(summary.projects).sort((left, right) => right[1] - left[1])[0] || ["Otros", 0];
}

export function buildReportHtml({ handle, from, to, projects, posts, summary }) {
  const formatItems = Object.entries(summary.formats).map(([label, value]) => ({ label, value, color: FORMAT_COLORS[label] }));
  const monthlyItems = MONTHS.map((label, index) => ({ label: label.slice(0, 3), value: summary.months[index + 1] || 0 }));
  const projectItems = Object.entries(summary.projects)
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));
  const [leadingProject, leadingProjectCount] = topProject(summary);
  const leadingFormat = Object.entries(summary.formats).sort((left, right) => right[1] - left[1])[0] || ["Sin datos", 0];

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Reporte de publicaciones de @${escapeHtml(handle)}</title>
  <style>
    @page { size: letter landscape; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #273039; font-family: Arial, Helvetica, sans-serif; background: #fff; }
    .page { width: 11in; height: 8.5in; overflow: hidden; page-break-after: always; position: relative; padding: .62in .72in .72in; }
    .page:last-child { page-break-after: auto; }
    .cover, .closing { align-items: center; background: #073c37; color: white; display: flex; justify-content: center; text-align: center; }
    .cover::before, .cover::after, .closing::before, .closing::after { border: 46px solid #286a60; border-radius: 999px; content: ""; height: 330px; position: absolute; width: 330px; }
    .cover::before { left: -125px; top: -155px; }
    .cover::after { bottom: -180px; right: -70px; }
    .closing::before { left: -190px; top: -190px; }
    .closing::after { bottom: -190px; right: -190px; }
    .cover-inner, .closing-inner { max-width: 700px; position: relative; z-index: 1; }
    .kicker { color: #f09b50; font-size: 13px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    h1 { font-size: 38px; line-height: 1.16; margin: 22px 0 16px; text-transform: uppercase; }
    .cover p { color: #c8ded9; font-size: 17px; margin: 6px 0; }
    .report-header { align-items: center; background: #073c37; color: white; display: flex; height: .58in; justify-content: space-between; left: 0; padding: 0 .72in; position: absolute; right: 0; top: 0; }
    .report-header strong { font-size: 13px; text-transform: uppercase; }
    .report-header span { color: #b9d8d1; font-size: 11px; }
    .page-content { padding-top: .38in; }
    h2 { color: #606060; font-size: 30px; margin: 0 0 24px; }
    h3 { color: #073c37; font-size: 16px; margin: 0 0 12px; }
    .project-list { columns: 2; column-gap: 60px; font-size: 18px; line-height: 1.65; margin: 24px 20px; }
    .project-list li { break-inside: avoid; margin-bottom: 5px; }
    .kpi-grid { display: grid; gap: 16px; grid-template-columns: repeat(4, 1fr); margin: 18px 0 30px; }
    .kpi { background: #f2f6f5; border-left: 7px solid #16685e; border-radius: 10px; padding: 18px; }
    .kpi span { color: #68737b; display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .kpi strong { color: #073c37; display: block; font-size: 29px; margin-top: 8px; }
    .columns { display: grid; gap: 36px; grid-template-columns: 1.1fr .9fr; }
    .panel { background: #f7f8f8; border-radius: 12px; padding: 22px; }
    .bar-chart { align-items: end; display: flex; gap: 12px; height: 250px; padding-top: 26px; }
    .bar-item { align-items: center; display: flex; flex: 1; flex-direction: column; height: 100%; justify-content: end; min-width: 0; }
    .bar-value { color: #20262a; font-size: 12px; font-weight: 800; margin-bottom: 5px; }
    .bar-track { align-items: end; border-bottom: 1px solid #bfc6cb; display: flex; height: 190px; justify-content: center; width: 100%; }
    .bar-fill { border-radius: 9px 9px 0 0; min-height: 0; width: 72%; }
    .bar-label { font-size: 9px; font-weight: 700; line-height: 1.15; margin-top: 7px; min-height: 22px; overflow-wrap: anywhere; text-align: center; }
    .donut { align-items: center; border-radius: 50%; display: flex; height: 215px; justify-content: center; margin: 10px auto; width: 215px; }
    .donut > div { align-items: center; background: white; border-radius: 50%; display: flex; flex-direction: column; height: 112px; justify-content: center; width: 112px; }
    .donut strong { color: #073c37; font-size: 28px; }
    .donut span { color: #7a858d; font-size: 9px; font-weight: 800; }
    .legend { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; margin: 12px auto; max-width: 300px; }
    .legend div { align-items: center; display: flex; font-size: 10px; gap: 7px; }
    .legend i { border-radius: 3px; display: block; height: 10px; width: 10px; }
    .narrative { color: #3f494f; font-size: 13px; line-height: 1.55; margin-top: 16px; }
    .note { background: #e9f4f2; border-radius: 10px; color: #24534d; font-size: 12px; line-height: 1.5; margin-top: 18px; padding: 13px 16px; }
    .footer { bottom: .23in; color: #80908d; font-size: 9px; left: .72in; position: absolute; right: .72in; text-align: right; }
    .closing h2 { color: white; font-size: 34px; margin-bottom: 12px; }
    .closing p { color: #c0d9d4; font-size: 16px; }
  </style>
</head>
<body>
  <section class="page cover">
    <div class="cover-inner">
      <div class="kicker">Monitoreo digital institucional</div>
      <h1>Reporte de publicaciones de X</h1>
      <p>@${escapeHtml(handle)}</p>
      <p>${escapeHtml(from)} al ${escapeHtml(to)}</p>
    </div>
  </section>

  <section class="page">
    <header class="report-header"><strong>Proyectos y categorías</strong><span>@${escapeHtml(handle)}</span></header>
    <div class="page-content">
      <h2>Proyectos monitoreados</h2>
      <ol class="project-list">${projects.map((project) => `<li>${escapeHtml(project.name)}</li>`).join("")}</ol>
      <div class="note">La clasificación se realiza mediante palabras clave editables. Las publicaciones sin coincidencia se agrupan en “Otros” para revisión.</div>
    </div>
    <footer class="footer">Generado automáticamente a partir de publicaciones públicas visibles.</footer>
  </section>

  <section class="page">
    <header class="report-header"><strong>Resumen</strong><span>${escapeHtml(from)} — ${escapeHtml(to)}</span></header>
    <div class="page-content">
      <h2>Publicaciones</h2>
      <div class="kpi-grid">
        <div class="kpi"><span>Total contabilizado</span><strong>${summary.total}</strong></div>
        <div class="kpi"><span>Publicaciones propias</span><strong>${summary.origins.Propia}</strong></div>
        <div class="kpi"><span>Proyecto principal</span><strong>${leadingProjectCount}</strong></div>
        <div class="kpi"><span>Por revisar</span><strong>${summary.review}</strong></div>
      </div>
      <div class="columns">
        <div class="panel"><h3>Publicaciones por proyecto</h3>${barChart(projectItems.length ? projectItems : [{ label: "Sin coincidencias", value: 0 }], "#16685e")}</div>
        <div>
          <h3>Lectura general</h3>
          <p class="narrative">Se contabilizaron <strong>${summary.total}</strong> publicaciones propias de @${escapeHtml(handle)}. El proyecto con mayor número de coincidencias fue <strong>${escapeHtml(leadingProject)}</strong>, con ${leadingProjectCount} publicaciones. ${summary.review} registros quedaron señalados para confirmar formato o categoría.</p>
          <div class="note">El scraper excluye reposts y respuestas. Los resultados se ordenan de la publicación más antigua a la más reciente.</div>
        </div>
      </div>
    </div>
    <footer class="footer">Reporte X · ${escapeHtml(handle)}</footer>
  </section>

  <section class="page">
    <header class="report-header"><strong>Formatos</strong><span>${summary.total} publicaciones</span></header>
    <div class="page-content">
      <h2>Distribución de formatos</h2>
      <div class="columns">
        <div class="panel">${barChart(formatItems, "#16685e")}</div>
        <div>
          ${donut(summary)}
          <div class="legend">${formatItems.map((item) => `<div><i style="background:${item.color}"></i>${escapeHtml(item.label)}: ${item.value} (${percent(item.value, summary.total)})</div>`).join("")}</div>
          <p class="narrative">El formato predominante fue <strong>${escapeHtml(leadingFormat[0])}</strong>, con ${leadingFormat[1]} publicaciones (${percent(leadingFormat[1], summary.total)} del total). La distinción entre fotografía e infografía es una estimación y debe revisarse antes de cerrar el informe.</p>
        </div>
      </div>
    </div>
    <footer class="footer">Clasificación automática con revisión recomendada.</footer>
  </section>

  <section class="page">
    <header class="report-header"><strong>Evolución</strong><span>Total: ${summary.total}</span></header>
    <div class="page-content">
      <h2>Evolución de publicaciones</h2>
      <div class="panel">${barChart(monthlyItems, "#477bf0")}</div>
      <div class="note">Periodo consultado: ${escapeHtml(from)} al ${escapeHtml(to)}. Las fechas y horas se presentan en la zona America/Mexico_City.</div>
    </div>
    <footer class="footer">Fuente: publicaciones públicas visibles en X.</footer>
  </section>

  <section class="page closing">
    <div class="closing-inner"><h2>Reporte concluido</h2><p>@${escapeHtml(handle)} · ${posts.length} publicaciones procesadas</p></div>
  </section>
</body>
</html>`;
}
