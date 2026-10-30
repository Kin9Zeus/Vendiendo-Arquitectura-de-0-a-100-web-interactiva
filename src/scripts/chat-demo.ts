/**
 * Modo demostración del asistente (sin IA).
 * Se usa cuando el servidor de IA no está disponible: vista previa estática,
 * desarrollo local sin GEMINI_API_KEY o servicio desactivado. Responde solo con
 * contenido ya público del sitio: títulos, resúmenes e ideas clave de cada capítulo.
 */
import { CHAPTERS, type Chapter } from '../data/book';

export type DemoAnswer = { text: string; sources: { n: number; title: string; slug: string }[] };

const STOP = new Set(`a al algo ante como con contra cual cuales cuando de del desde donde el ella ellas ellos en entre era es esa ese eso esta este esto estos fue ha hay la las le les lo los mas me mi mucho muy nada ni no nos o otra otro para pero poco por porque que quien se ser si sin sobre son su sus tambien tan te tiene todo tu un una uno unos y ya yo libro capitulo dice habla explica explicame cual cuales seria puedo puede debo debe quiero hola gracias favor propone recomienda autor`.split(/\s+/));

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Raíz aproximada: prefijo de 6 letras (suficiente para el español del índice). */
export function stems(text: string): string[] {
  return (normalize(text).match(/[a-z0-9ñ]+/g) || [])
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map((w) => (w.length > 6 ? w.slice(0, 6) : w));
}

/** Vocabulario con el que la gente pregunta por cada capítulo (además de su título y resumen). */
const KEYWORDS: Record<number, string> = {
  3: 'abrir oficina empresa emprender registro camara comercio facturacion electronica seguimiento economico',
  4: 'intuicion decidir decision aceptar rechazar proyecto viable',
  5: 'mercado competencia redes sociales digital voz a voz clientes nuevos',
  6: 'cotizar cotizacion cotizo propuesta presupuesto aprobar aprueben aprobacion precio',
  7: 'contrato contratos obra construccion aiu administracion delegada llave en mano todo costo',
  8: 'metro cuadrado m2 cobrar cobro cobra honorarios tarifa precio empleados empleado nomina laboral contratar',
  9: 'entregables entregar entrega bim lod anteproyecto planos revit',
  10: 'correcciones corregir cambios revisiones cliente pide',
  11: 'render renders visualizacion 3d lumion twinmotion imagenes',
  12: 'mercadeo marketing vender ventas clientes instagram estrategias miedo escasez',
  13: 'portafolio gratis regalar gratuito primeros proyectos',
  14: 'creencias dinero habitos mentalidad',
  15: 'marca branding logo identidad',
  16: 'riesgo positivo incertidumbre',
  17: 'facturar finanzas caja flujo utilidad ganancia ganar contador salario costos fijos',
  18: 'inteligencia artificial ia claude chatgpt automatizar herramientas',
  19: 'conclusiones universidad academia',
};

const index = CHAPTERS.map((c) => ({
  c,
  title: new Set([...stems(c.title), ...stems(KEYWORDS[c.n] ?? '')]),
  body: new Set(stems(`${c.summary} ${c.ideas.join(' ')} ${c.byline ?? ''}`)),
}));

/** Capítulos más afines a la pregunta (o el capítulo citado por número). */
export function matchChapters(question: string, max = 2): Chapter[] {
  const byNumber = normalize(question).match(/\b(?:cap(?:itulo)?\.?\s*)(\d{1,2})\b/);
  if (byNumber) {
    const c = CHAPTERS.find((x) => x.n === Number(byNumber[1]));
    if (c) return [c];
  }
  const q = [...new Set(stems(question))];
  if (!q.length) return [];
  return index
    .map(({ c, title, body }) => ({ c, score: q.reduce((s, t) => s + (title.has(t) ? 3 : 0) + (body.has(t) ? 1 : 0), 0) }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score || a.c.n - b.c.n)
    .slice(0, max)
    .map((x) => x.c);
}

const num = (n: number) => String(n).padStart(2, '0');

export function demoAnswer(question: string): DemoAnswer {
  const found = matchChapters(question);
  if (!found.length) {
    return {
      text: 'No encontré ese tema en el índice del libro. Prueba preguntando por cotizar un diseño, tipos de contrato, entregables y BIM, correcciones, visualización, mercadeo, marca, finanzas de la oficina o inteligencia artificial.',
      sources: [],
    };
  }
  const [main, second] = found;
  const lines = [
    `**Capítulo ${num(main.n)} · ${main.title}.** ${main.summary}`,
    '',
    'Ideas clave del capítulo:',
    ...main.ideas.map((i) => `- ${i}`),
  ];
  if (/relaciona|conecta|resto del libro/i.test(question)) {
    const prev = CHAPTERS.find((c) => c.n === main.n - 1);
    const next = CHAPTERS.find((c) => c.n === main.n + 1);
    const near = [prev, next].filter(Boolean).map((c) => `cap. ${num(c!.n)} (${c!.title})`).join(' y ');
    if (near) lines.push('', `En el recorrido del libro se apoya en el ${near}.`);
  } else if (second) {
    lines.push('', `También se relaciona con el **capítulo ${num(second.n)} · ${second.title}**.`);
  }
  lines.push('', 'El desarrollo completo, con ejemplos y modelos reales, está en el libro impreso.');
  return {
    text: lines.join('\n'),
    sources: found.map((c) => ({ n: c.n, title: c.title, slug: c.slug })),
  };
}
