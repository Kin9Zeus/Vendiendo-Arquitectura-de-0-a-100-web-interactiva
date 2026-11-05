/**
 * Enlaces permanentes de los QR impresos en el libro.
 *
 * REGLA DE ORO: una vez impreso un código, NUNCA se borra ni se renombra.
 * Solo se cambia su destino (si la página se mueve) o se añaden códigos nuevos.
 * test/qr-links.test.mjs falla si falta cualquier código ya impreso.
 *
 * Formato: <libro>/<capítulo> → ruta del sitio del libro.
 *   va = «Vendiendo arquitectura de 0 a 100». Libros futuros: otro código (p. ej. «xy/01»).
 * Las redirecciones son 302 y sin caché: así el destino puede cambiar sin tocar el papel.
 */

export const QR_HOST_DEFAULT = 'q.uvalibros.com';
export const SITE_ORIGIN_DEFAULT = 'https://www.uvalibros.com';

export const QR_LINKS = Object.freeze({
  // Libro completo (portada, contraportada o solapa)
  'va': '/',
  // Final de cada capítulo
  'va/01': '/capitulos/finalidad-de-este-libro',
  'va/02': '/capitulos/despertando-de-las-creencias',
  'va/03': '/capitulos/apertura-de-oficina',
  'va/04': '/capitulos/la-intuicion',
  'va/05': '/capitulos/mercado-agresivo-y-cambiante',
  'va/06': '/capitulos/como-cotizar-un-diseno',
  'va/07': '/capitulos/tipos-de-contratos-de-obra',
  'va/08': '/capitulos/contratos-para-empleados',
  'va/09': '/capitulos/entregables',
  'va/10': '/capitulos/correcciones',
  'va/11': '/capitulos/visualizacion',
  'va/12': '/capitulos/estrategias-de-mercadeo',
  'va/13': '/capitulos/regalar-el-trabajo',
  'va/14': '/capitulos/falsas-creencias',
  'va/15': '/capitulos/la-marca-en-la-arquitectura',
  'va/16': '/capitulos/el-riesgo-positivo',
  'va/17': '/capitulos/facturar-no-es-ganar',
  'va/18': '/capitulos/inteligencia-artificial-claude',
  'va/19': '/capitulos/conclusiones-finales',
});

/** Normaliza lo que llega en la URL: mayúsculas, barras sobrantes y «va/6» → «va/06». */
export function normalizeCode(path) {
  let s = String(path || '').trim().toLowerCase();
  try { s = decodeURIComponent(s); } catch { /* se deja tal cual */ }
  s = s.replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
  if (s.startsWith('q/')) s = s.slice(2);
  return s.replace(/^([a-z]{1,8})\/(\d)$/, '$1/0$2');
}

/**
 * Decide la redirección de un QR.
 * @param {{ host: string, pathname: string, qrHost?: string, siteOrigin?: string }} o
 * @returns {string|null} URL de destino, o null si la petición no es de un QR.
 */
export function resolveQr({ host, pathname, qrHost = QR_HOST_DEFAULT, siteOrigin = '' }) {
  const onQrHost = Boolean(qrHost) && String(host || '').toLowerCase().split(':')[0] === qrHost.toLowerCase();
  const isQrPath = /^\/q(\/|$)/i.test(pathname);
  if (!onQrHost && !isQrPath) return null;

  // En el dominio corto una ruta relativa volvería a caer aquí (bucle): siempre destino absoluto.
  const origin = siteOrigin || (onQrHost ? SITE_ORIGIN_DEFAULT : '');
  const target = QR_LINKS[normalizeCode(pathname)];
  // Un código desconocido (mal tecleado o dañado) nunca es un callejón sin salida: va al inicio.
  if (!target) return `${origin}/`;
  return `${origin}${target}${target === '/' ? '' : '?desde=qr'}`;
}
