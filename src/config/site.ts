/**
 * Configuración central del sitio. Todo dato «por confirmar» vive aquí
 * para cambiarlo en un solo lugar.
 */
export const SITE = {
  name: 'Vendiendo arquitectura de 0 a 100',
  shortName: 'Vendiendo arquitectura',
  tagline: 'Estrategias reales en un mundo y gremio que se sofoca económicamente por no tener un método.',
  description:
    'El libro de Sebastián Arias Duque que enseña lo que la academia omite: cómo abrir una oficina, cotizar para que te aprueben, cobrar, administrar y vender arquitectura. Tomo 01 de Arquitectura Disruptiva · 2.ª edición · Editorial UVA.',
  locale: 'es_CO',
  lang: 'es',
  themeColor: '#141416',
  /** URL base; la define astro.config.mjs (variable SITE_URL en Railway). */
  url: import.meta.env.SITE as string,
} as const;

export const CONTACT = {
  /** WhatsApp comercial (aparece en la página legal del libro). Por confirmar. */
  whatsapp: '573005203788',
  email: 'arquitecturauva@gmail.com',
  instagram: 'https://www.instagram.com/uvarq/',
  instagramHandle: '@uvarq',
  web: 'https://uvarq.com',
  city: 'Pereira',
  region: 'Risaralda',
  country: 'CO',
} as const;

/** Datos del responsable del tratamiento (documentos legales). Confirmar NIT y dirección. */
export const LEGAL = {
  company: 'Unidad Vectorial de Arquitectura S.A.S.',
  brand: 'UVA Arquitectura · Editorial UVA',
  nit: 'NIT por confirmar',
  address: 'Calle 19 # 9-50, Edificio Diario del Otún, oficina 1208, Pereira, Risaralda, Colombia',
  email: 'arquitecturauva@gmail.com',
  phone: '+57 300 520 3788',
  updated: '28 de octubre de 2026',
  version: '2.0',
} as const;

export const BUY_MESSAGE =
  'Hola, quiero el libro «Vendiendo arquitectura de 0 a 100». ¿Cómo lo consigo?';

export const whatsappLink = (text: string = BUY_MESSAGE) =>
  `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`;
