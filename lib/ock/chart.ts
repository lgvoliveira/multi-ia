// Renderiza um GRÁFICO (barra, linha ou pizza) a partir de uma especificação que a IA monta.
// A IA devolve os dados em JSON; aqui a OCK desenha o SVG (sem rodar código, seguro). Só o servidor usa.

export interface ChartSpec {
  type: "barra" | "linha" | "pizza";
  title: string;
  labels: string[];
  series: { name: string; values: number[] }[];
}

const W = 760;
const H = 460;
const M = { top: 54, right: 24, bottom: 74, left: 64 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;
const PALETTE = ["#2A3BD1", "#E0792B", "#1F9E6B", "#C0392B", "#8E44AD", "#16A085", "#D4A017", "#2E86DE"];

/** Lê o JSON de gráfico que a IA devolveu. Null se não veio no formato esperado. */
export function parseChartSpec(text: string): ChartSpec | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let data: unknown;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const o = data as Record<string, unknown>;
  const rawType = typeof o.tipo === "string" ? o.tipo : o.type;
  const type: ChartSpec["type"] = rawType === "linha" || rawType === "line" ? "linha" : rawType === "pizza" || rawType === "pie" ? "pizza" : "barra";
  const labels = asStrings(o.rotulos ?? o.labels);
  const series = asSeries(o.series ?? o.dados);
  if (labels.length === 0 || series.length === 0) return null;
  const title = typeof o.titulo === "string" ? o.titulo : typeof o.title === "string" ? o.title : "Gráfico";
  return { type, title, labels, series };
}

function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

function asSeries(v: unknown): { name: string; values: number[] }[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((s, i) => {
      const o = (s ?? {}) as Record<string, unknown>;
      const raw = o.valores ?? o.values;
      const values = Array.isArray(raw) ? raw.map((n) => Number(n) || 0) : [];
      const name = typeof o.nome === "string" ? o.nome : typeof o.name === "string" ? o.name : `Série ${i + 1}`;
      return { name, values };
    })
    .filter((s) => s.values.length > 0);
}

/** Desenha o gráfico como SVG (string). */
export function renderChart(spec: ChartSpec): string {
  const body = spec.type === "pizza" ? pie(spec) : spec.type === "linha" ? lines(spec) : bars(spec);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Arial, sans-serif"><rect width="${W}" height="${H}" fill="#ffffff"/><text x="${W / 2}" y="32" text-anchor="middle" font-size="20" font-weight="700" fill="#111111">${esc(spec.title)}</text>${body}${spec.type === "pizza" ? "" : legend(spec)}</svg>`;
}

function maxValue(spec: ChartSpec): number {
  return Math.max(1, ...spec.series.flatMap((s) => s.values));
}

/** Eixo Y (linha de base + 4 marcas) e eixo X. */
function axes(max: number): string {
  let out = `<line x1="${M.left}" y1="${M.top}" x2="${M.left}" y2="${M.top + PLOT_H}" stroke="#cccccc"/><line x1="${M.left}" y1="${M.top + PLOT_H}" x2="${M.left + PLOT_W}" y2="${M.top + PLOT_H}" stroke="#cccccc"/>`;
  for (let i = 0; i <= 4; i++) {
    const y = M.top + PLOT_H - (i / 4) * PLOT_H;
    const val = (max * i) / 4;
    out += `<line x1="${M.left}" y1="${y.toFixed(1)}" x2="${M.left + PLOT_W}" y2="${y.toFixed(1)}" stroke="#eeeeee"/><text x="${M.left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="#777777">${fmt(val)}</text>`;
  }
  return out;
}

function bars(spec: ChartSpec): string {
  const max = maxValue(spec);
  const n = spec.labels.length;
  const groupW = PLOT_W / Math.max(1, n);
  const inner = groupW * 0.72;
  const barW = inner / spec.series.length;
  let out = axes(max);
  spec.labels.forEach((label, i) => {
    const gx = M.left + i * groupW + (groupW - inner) / 2;
    spec.series.forEach((s, si) => {
      const v = s.values[i] ?? 0;
      const h = (v / max) * PLOT_H;
      const x = gx + si * barW;
      const y = M.top + PLOT_H - h;
      out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barW * 0.88).toFixed(1)}" height="${h.toFixed(1)}" fill="${PALETTE[si % PALETTE.length]}"/>`;
    });
    out += `<text x="${(M.left + i * groupW + groupW / 2).toFixed(1)}" y="${(M.top + PLOT_H + 18).toFixed(1)}" text-anchor="middle" font-size="11" fill="#444444">${esc(trunc(label))}</text>`;
  });
  return out;
}

function lines(spec: ChartSpec): string {
  const max = maxValue(spec);
  const n = spec.labels.length;
  const step = PLOT_W / Math.max(1, n - 1);
  let out = axes(max);
  spec.series.forEach((s, si) => {
    const pts = s.values.map((v, i) => `${(M.left + i * step).toFixed(1)},${(M.top + PLOT_H - (v / max) * PLOT_H).toFixed(1)}`);
    out += `<polyline fill="none" stroke="${PALETTE[si % PALETTE.length]}" stroke-width="2.5" points="${pts.join(" ")}"/>`;
    s.values.forEach((v, i) => {
      out += `<circle cx="${(M.left + i * step).toFixed(1)}" cy="${(M.top + PLOT_H - (v / max) * PLOT_H).toFixed(1)}" r="3" fill="${PALETTE[si % PALETTE.length]}"/>`;
    });
  });
  spec.labels.forEach((label, i) => {
    out += `<text x="${(M.left + i * step).toFixed(1)}" y="${(M.top + PLOT_H + 18).toFixed(1)}" text-anchor="middle" font-size="11" fill="#444444">${esc(trunc(label))}</text>`;
  });
  return out;
}

function pie(spec: ChartSpec): string {
  const values = spec.labels.map((_, i) => spec.series[0]?.values[i] ?? 0);
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const cx = M.left + PLOT_W / 2;
  const cy = M.top + PLOT_H / 2;
  const r = Math.min(PLOT_W, PLOT_H) / 2 - 8;
  let angle = -Math.PI / 2;
  let out = "";
  values.forEach((v, i) => {
    const slice = (v / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += slice;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = slice > Math.PI ? 1 : 0;
    out += `<path d="M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${PALETTE[i % PALETTE.length]}"/>`;
  });
  // legenda ao lado
  spec.labels.forEach((label, i) => {
    const ly = M.top + 10 + i * 20;
    out += `<rect x="${M.left + PLOT_W - 150}" y="${ly}" width="12" height="12" fill="${PALETTE[i % PALETTE.length]}"/><text x="${M.left + PLOT_W - 132}" y="${ly + 11}" font-size="12" fill="#333333">${esc(trunc(label))} (${Math.round((values[i] / total) * 100)}%)</text>`;
  });
  return out;
}

function legend(spec: ChartSpec): string {
  if (spec.series.length <= 1) return "";
  return spec.series
    .map((s, i) => {
      const x = M.left + i * 160;
      const y = H - 18;
      return `<rect x="${x}" y="${y - 10}" width="12" height="12" fill="${PALETTE[i % PALETTE.length]}"/><text x="${x + 18}" y="${y}" font-size="12" fill="#333333">${esc(trunc(s.name, 18))}</text>`;
    })
    .join("");
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function trunc(s: string, max = 12): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function esc(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] ?? c);
}
