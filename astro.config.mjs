// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// URL pública definitiva. En Railway se define con la variable SITE_URL.
const SITE = process.env.SITE_URL ?? 'https://www.vendiendoarquitectura.com';
// Subcarpeta de publicación: «/» en producción; «/<repo>» en la vista previa de GitHub Pages.
const BASE = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site: SITE,
  base: BASE,
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'never',
  },
  compressHTML: true,
  // Sin bloques de código en el sitio; Shiki usaría estilos inline incompatibles con la CSP
  markdown: { syntaxHighlight: false },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
      changefreq: 'monthly',
      lastmod: new Date(),
    }),
  ],
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "manifest-src 'self'",
      ],
    },
  },
  image: {
    layout: 'constrained',
    responsiveStyles: false,
  },
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
