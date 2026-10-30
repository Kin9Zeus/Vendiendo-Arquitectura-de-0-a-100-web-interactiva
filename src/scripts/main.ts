/**
 * Motor de interacción del sitio.
 * - Lenis (scroll suave) sincronizado con el ticker de GSAP.
 * - ScrollTrigger para pines, scrub y revelados; SplitText para tipografía.
 * - Todo el contenido es visible sin JS; las animaciones solo se montan
 *   cuando html.motion está presente (siempre, salvo ?motion=0 para capturas).
 */
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

const root = document.documentElement;
const motion = root.classList.contains('motion');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document) => el.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document) => Array.from(el.querySelectorAll<T>(s));
const pad3 = (n: number) => String(Math.round(n)).padStart(3, '0');
const fmt = new Intl.NumberFormat('es-CO');

let lenis: Lenis | null = null;

/* ------------------------------------------------------------------ */
function initLenis() {
  if (!motion) return;
  lenis = new Lenis({ lerp: 0.11, smoothWheel: true, anchors: { offset: -64 }, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis?.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* ------------------------------------------------------------------ */
function initPreloader(): Promise<void> {
  const el = $('.preloader');
  if (!el || !root.classList.contains('is-loading')) {
    root.classList.remove('is-loading');
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const done = () => {
      root.classList.remove('is-loading');
      lenis?.start();
      resolve();
    };
    const safety = window.setTimeout(done, 4000);
    lenis?.stop();
    const num = $('[data-pre-num]', el)!;
    const counter = { v: 0 };
    gsap.timeline({ onComplete: () => { clearTimeout(safety); done(); } })
      .to(counter, { v: 100, duration: 1.15, ease: 'power2.inOut', onUpdate: () => { num.textContent = pad3(counter.v); } })
      .to('[data-pre-bar]', { scaleX: 1, duration: 1.15, ease: 'power2.inOut' }, 0)
      .to(el, { clipPath: 'inset(0 0 100% 0)', duration: 0.85, ease: 'expo.inOut' }, '+=0.12');
  });
}

/* ------------------------------------------------------------------ */
function initRuler() {
  const ruler = $('[data-ruler]');
  const value = $('[data-ruler-value]');
  const marker = $('.ruler__marker');
  $$('[data-tick]').forEach((t) => { t.style.bottom = `${t.dataset.tick}%`; });
  const bar = $('.progress-top');
  const lost = Boolean($('.lost')); // en la 404 la escala se sale de rango
  if (lost && value) value.textContent = '404';
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (self) => {
      const p = self.progress;
      ruler?.style.setProperty('--p', String(p));
      bar?.style.setProperty('--p', String(p));
      if (marker) marker.style.bottom = `${p * 100}%`;
      if (value) value.textContent = lost ? '404' : pad3(p * 100);
    },
  });
}

/* ------------------------------------------------------------------ */
function initNav() {
  const nav = $('[data-nav]');
  if (!nav) return;
  let lastY = 0;
  const onScroll = (y: number) => {
    nav.classList.toggle('is-scrolled', y > 24);
    const menuOpen = $('[data-menu]')?.classList.contains('is-open');
    nav.classList.toggle('is-hidden', !menuOpen && y > 320 && y > lastY);
    lastY = y;
  };
  if (lenis) lenis.on('scroll', ({ scroll }: { scroll: number }) => onScroll(scroll));
  else addEventListener('scroll', () => onScroll(scrollY), { passive: true });
  onScroll(scrollY);

  // Menú móvil
  const toggle = $<HTMLButtonElement>('[data-menu-toggle]');
  const menu = $('[data-menu]');
  if (!toggle || !menu) return;
  const label = toggle.querySelector('.sr-only');
  const setOpen = (open: boolean) => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    if (label) label.textContent = open ? 'Cerrar menú' : 'Abrir menú';
    if (open) {
      lenis?.stop();
      document.body.style.overflow = 'hidden';
      nav.classList.remove('is-hidden');
      $<HTMLAnchorElement>('a', menu)?.focus({ preventScroll: true });
      if (motion) gsap.fromTo($$('li', menu), { y: 40, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.06, duration: 0.7, ease: 'expo.out', delay: 0.2 });
    } else {
      lenis?.start();
      document.body.style.overflow = '';
    }
  };
  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  $$('[data-menu-link], a', menu).forEach((a) => a.addEventListener('click', () => setOpen(false)));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
  });
}

/** Se crea al final: debe calcularse después de los pines (orden de refresco). */
function initActiveLinks() {
  $$<HTMLAnchorElement>('[data-navlink]').forEach((a) => {
    const id = a.hash.slice(1);
    const sec = id && document.getElementById(id);
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec, start: 'top 45%', end: 'bottom 45%',
      onToggle: (self) => (self.isActive ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')),
    });
  });
}

/* ------------------------------------------------------------------ */
function initCursor() {
  const c = $('.cursor');
  if (!c || !finePointer || !motion) return;
  root.classList.add('has-cursor');
  const h = $('.cursor__h', c)!, v = $('.cursor__v', c)!, ring = $('.cursor__ring', c)!, xy = $('.cursor__xy', c)!;
  const hy = gsap.quickTo(h, 'y', { duration: 0.25, ease: 'power3' });
  const vx = gsap.quickTo(v, 'x', { duration: 0.25, ease: 'power3' });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  const tx = gsap.quickTo(xy, 'x', { duration: 0.3, ease: 'power3' });
  const ty = gsap.quickTo(xy, 'y', { duration: 0.3, ease: 'power3' });
  addEventListener('pointermove', (e) => {
    hy(e.clientY); vx(e.clientX); rx(e.clientX); ry(e.clientY); tx(e.clientX); ty(e.clientY);
    xy.textContent = `X ${String(e.clientX).padStart(4, '0')} · Y ${String(e.clientY).padStart(4, '0')}`;
  }, { passive: true });
  const hoverSel = 'a, button, summary, [data-card], [data-toc-row]';
  document.addEventListener('pointerover', (e) => {
    if ((e.target as Element).closest?.(hoverSel)) c.classList.add('is-hover');
  });
  document.addEventListener('pointerout', (e) => {
    if ((e.target as Element).closest?.(hoverSel)) c.classList.remove('is-hover');
  });
  document.addEventListener('pointerleave', () => gsap.to(c, { opacity: 0, duration: 0.3 }));
  document.addEventListener('pointerenter', () => gsap.to(c, { opacity: 1, duration: 0.3 }));
}

function initMagnetic() {
  if (!finePointer || !motion) return;
  $$('[data-magnetic]').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * 0.28);
      y((e.clientY - r.top - r.height / 2) * 0.35);
    });
    el.addEventListener('pointerleave', () => { x(0); y(0); });
  });
}

/* ------------------------------------------------------------------ */
/** Prepara trazos SVG para dibujarse con stroke-dashoffset. */
function prepDraw(els: SVGGeometryElement[]) {
  els.forEach((p) => {
    const len = p.getTotalLength?.() || 300;
    p.style.strokeDasharray = `${len}`;
    p.style.strokeDashoffset = `${len}`;
  });
  return els;
}

function heroIntro() {
  const hero = $('[data-hero]');
  if (!hero) return;
  const book = $('#hero-book');
  const circle = $<SVGCircleElement>('[data-hero-circle] circle');
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  if (circle) {
    const len = circle.getTotalLength();
    gsap.set(circle, { strokeDasharray: len, strokeDashoffset: len, rotate: -90, transformOrigin: '50% 50%' });
    tl.to(circle, { strokeDashoffset: 0, duration: 2, ease: 'power3.inOut' }, 0.15);
  }
  tl.from('[data-hero-line]', { yPercent: 110, duration: 1.3, stagger: 0.1 }, 0)
    .from('[data-hero-kicker]', { opacity: 0, x: -24, duration: 1, stagger: 0.08 }, 0.2)
    .from('[data-hero-fade]', { opacity: 0, y: 24, duration: 1, stagger: 0.1 }, 0.55)
    .from('[data-hero-ghost]', { opacity: 0, scale: 0.85, duration: 1.8 }, 0.1);
  if (book) tl.from(book, { rotationY: -95, rotationX: 18, y: 80, opacity: 0, duration: 1.8 }, 0.2);

  // Parallax al salir del hero
  gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.8 } })
    .to('[data-hero-ghost]', { yPercent: -35, ease: 'none' }, 0)
    .to('[data-hero-circle]', { scale: 1.25, opacity: 0, ease: 'none' }, 0)
    .to('[data-hero-book]', { yPercent: -18, ease: 'none' }, 0)
    .to('.hero__copy', { yPercent: -12, opacity: 0.25, ease: 'none' }, 0);

  // Inclinación del libro con el puntero
  if (book && finePointer) {
    const ry = gsap.quickTo(book, 'rotationY', { duration: 0.9, ease: 'power3' });
    const rx = gsap.quickTo(book, 'rotationX', { duration: 0.9, ease: 'power3' });
    hero.addEventListener('pointermove', (e) => {
      const nx = e.clientX / innerWidth - 0.5;
      const ny = e.clientY / innerHeight - 0.5;
      ry(-28 + nx * 26);
      rx(6 - ny * 14);
    });
    hero.addEventListener('pointerleave', () => { ry(-28); rx(6); });
  }
}

/* ------------------------------------------------------------------ */
function initManifesto(desktop: boolean) {
  const sec = $('[data-manifesto]');
  const text = $('[data-words]', sec ?? document);
  if (!sec || !text) return;
  const split = SplitText.create(text, { type: 'words', wordsClass: 'w' });
  const book = $('#manifesto-book');
  const tl = gsap.timeline({
    scrollTrigger: desktop
      ? { trigger: sec, start: 'top top', end: '+=160%', pin: '.manifesto__pin', scrub: 0.7, anticipatePin: 1 }
      : { trigger: text, start: 'top 80%', end: 'bottom 40%', scrub: 0.6 },
  });
  tl.to(split.words, { opacity: 1, stagger: 0.08, ease: 'none', duration: 0.6 }, 0);
  if (book) tl.fromTo(book, { rotationY: -18 }, { rotationY: 162, ease: 'none', duration: tl.duration() }, 0);
  return () => split.revert();
}

/* ------------------------------------------------------------------ */
function initFindings(desktop: boolean) {
  const sec = $('[data-findings]');
  const track = $('[data-findings-track]');
  if (!sec || !track) return;
  const cards = $$('[data-card]', track);
  const glyphs = cards.map((c) => prepDraw($$<SVGGeometryElement>('.card__glyph *:not(.dim)', c)));

  if (desktop) {
    const distance = () => Math.max(0, track.scrollWidth - (track.parentElement?.clientWidth ?? innerWidth) + 48);
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: sec, start: 'top top', end: () => `+=${distance()}`,
        pin: '.findings__pin', scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: (self) => gsap.set('[data-findings-progress]', { scaleX: self.progress }),
      },
    });
    cards.forEach((card, i) => {
      gsap.timeline({ scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 92%', toggleActions: 'play none none reverse' } })
        .from(card, { opacity: 0.25, y: 40, duration: 0.8, ease: 'expo.out' }, 0)
        .to(glyphs[i], { strokeDashoffset: 0, duration: 1.4, stagger: 0.08, ease: 'power2.inOut' }, 0.1);
    });
  } else {
    cards.forEach((card, i) => {
      gsap.timeline({ scrollTrigger: { trigger: card, start: 'top 85%', toggleActions: 'play none none none' } })
        .from(card, { opacity: 0, y: 48, duration: 0.9, ease: 'expo.out' }, 0)
        .to(glyphs[i], { strokeDashoffset: 0, duration: 1.3, stagger: 0.08, ease: 'power2.inOut' }, 0.15);
    });
  }
}

/* ------------------------------------------------------------------ */
function initLadder(desktop: boolean) {
  const sec = $('[data-ladder]');
  if (!sec) return;
  const bars = $$<SVGGElement>('[data-bar]', sec);
  const levels = $$('[data-level]', sec);
  const readout = $('[data-ladder-readout]', sec);
  const state = { v: -1 };
  const LEVELS = bars.map((b) => Number(b.dataset.bar));
  gsap.set(bars, { scaleY: 0.04, transformOrigin: '50% 100%' });
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: desktop
      ? { trigger: sec, start: 'top top', end: '+=220%', pin: '.ladder__pin', scrub: 0.6, anticipatePin: 1 }
      : { trigger: $('[data-ladder-visual]', sec) ?? sec, start: 'top 75%', end: 'bottom 35%', scrub: 0.6 },
  });
  const sync = () => {
    if (readout) readout.textContent = pad3(Math.max(0, state.v));
    // nivel alcanzado = el mayor escalón que ya superó la lectura
    const reached = LEVELS.filter((l) => l <= state.v + 0.5);
    const cur = reached.length ? reached[reached.length - 1] : -1;
    levels.forEach((l) => {
      const n = Number(l.dataset.level);
      l.classList.toggle('is-on', n <= cur);
      l.classList.toggle('is-current', n === cur);
    });
    bars.forEach((b) => b.classList.toggle('is-hot', Number(b.dataset.bar) === cur));
  };
  bars.forEach((bar, i) => {
    tl.to(bar, { scaleY: 1, duration: 1, ease: 'power2.out' }, i)
      .to(state, { v: LEVELS[i], duration: 1, onUpdate: sync }, i);
  });
  tl.to({}, { duration: 0.6 });
}

/* ------------------------------------------------------------------ */
function initDims() {
  $$('[data-dim]').forEach((dim) => {
    const line = $('.dim__line i', dim);
    const num = $('[data-count]', dim);
    const target = Number(num?.dataset.count ?? 0);
    const o = { v: 0 };
    gsap.timeline({ scrollTrigger: { trigger: dim, start: 'top 85%' } })
      .from(line, { scaleX: 0, duration: 1.2, ease: 'expo.inOut' }, 0)
      .to(o, { v: target, duration: 1.6, ease: 'power3.out', onUpdate: () => { if (num) num.textContent = fmt.format(Math.round(o.v)); } }, 0.15)
      .from($$('.dim__label, .dim__note', dim), { opacity: 0, y: 14, stagger: 0.08, duration: 0.8, ease: 'expo.out' }, 0.3);
  });
}

/* ------------------------------------------------------------------ */
function initPaperTheme() {
  const paper = $('[data-paper]');
  if (!paper || root.classList.contains('is-paper')) return;
  ScrollTrigger.create({
    trigger: paper, start: 'top 55%', end: 'bottom 45%',
    toggleClass: { targets: root, className: 'is-paper' },
  });
}

function initToc() {
  const rows = $$('[data-toc-row]');
  if (!rows.length) return;
  ScrollTrigger.batch(rows, {
    start: 'top 92%',
    onEnter: (els) => gsap.from(els, { opacity: 0, y: 34, stagger: 0.05, duration: 0.9, ease: 'expo.out', overwrite: true }),
    once: true,
  });
}

function initAuthor() {
  const fig = $('[data-author-figure]');
  if (!fig) return;
  const frame = $<SVGRectElement>('[data-author-frame]', fig);
  if (frame) {
    frame.setAttribute('pathLength', '1');
    gsap.fromTo(frame, { strokeDasharray: 1, strokeDashoffset: 1 }, {
      strokeDashoffset: 0, ease: 'none',
      scrollTrigger: { trigger: fig, start: 'top 80%', end: 'center 45%', scrub: 0.6 },
    });
  }
  const img = $('img', fig);
  if (img) {
    gsap.fromTo(img, { clipPath: 'inset(100% 0 0 0)' }, {
      clipPath: 'inset(0% 0 0 0)', duration: 1.6, ease: 'expo.inOut',
      scrollTrigger: { trigger: fig, start: 'top 78%' },
    });
  }
}

function initCourse() {
  const box = $('[data-course]');
  if (!box) return;
  gsap.timeline({ scrollTrigger: { trigger: box, start: 'top 80%' } })
    .from(box, { clipPath: 'inset(0 100% 0 0)', duration: 1.2, ease: 'expo.inOut' })
    .from($$('.course__body > *', box), { opacity: 0, y: 20, stagger: 0.1, duration: 0.8, ease: 'expo.out' }, '-=0.4');
}

/* ------------------------------------------------------------------ */
function initSplits() {
  $$('[data-split]').forEach((el) => {
    const caret = el.querySelector('.caret');
    caret?.remove();
    SplitText.create(el, {
      type: 'lines,words',
      mask: 'lines',
      autoSplit: true,
      onSplit: (self) => {
        // el cursor «_» viaja pegado a la última palabra para no quedar solo en una línea
        const last = self.words[self.words.length - 1];
        if (caret && last) last.appendChild(caret);
        return gsap.from(self.words, {
          yPercent: 110, duration: 1.1, stagger: 0.05, ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 85%' },
        });
      },
    });
  });
  $$('[data-split-lines]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines',
      autoSplit: true,
      onSplit: (self) => gsap.fromTo(self.lines, { opacity: 0.12 }, {
        opacity: 1, stagger: 0.3, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 50%', scrub: 0.5 },
      }),
    });
  });
}

function initReveals() {
  const items = $$('[data-reveal]');
  if (!items.length) return;
  ScrollTrigger.batch(items, {
    start: 'top 90%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, stagger: 0.08, duration: 1, ease: 'expo.out', overwrite: true }),
  });
}

function initMarquee() {
  const tracks = $$('.marquee__track');
  if (!tracks.length) return;
  const skew = gsap.quickTo(tracks, 'skewX', { duration: 0.5, ease: 'power3' });
  ScrollTrigger.create({
    trigger: '.marquee', start: 'top bottom', end: 'bottom top',
    onUpdate: (self) => skew(gsap.utils.clamp(-10, 10, self.getVelocity() / -180)),
  });
}

function initChapterPage() {
  const block = $('[data-ch-block]');
  if (!block) return;
  gsap.timeline({ defaults: { ease: 'expo.out' } })
    .from($('.ch-block__num', block), { yPercent: 40, opacity: 0, duration: 1.3 })
    .from($('.ch-block__rule', block), { scaleX: 0, duration: 1.2, ease: 'expo.inOut' }, 0.15)
    .from($$('.ch-block__kicker, h1, .ch-block__by', block), { opacity: 0, y: 24, stagger: 0.08, duration: 1 }, 0.3);
}

function initDraw() {
  $$('[data-draw]').forEach((svg) => {
    const parts = prepDraw($$<SVGGeometryElement>('.digit, .dimline', svg));
    gsap.to(parts, { strokeDashoffset: 0, duration: 2, stagger: 0.12, ease: 'power2.inOut', delay: 0.2 });
  });
}

/* ------------------------------------------------------------------ */
/** Asistente del libro: el módulo se descarga solo cuando alguien lo abre. */
function initChat() {
  if (!document.querySelector('[data-chat]')) return;
  let mod: Promise<typeof import('./chat')> | null = null;
  const load = () => (mod ??= import('./chat'));
  const launchers = document.querySelectorAll<HTMLElement>('[data-chat-open], [data-chat-ask]');
  launchers.forEach((el) => {
    el.addEventListener('click', async () => {
      const { openChat } = await load();
      openChat(el.dataset.chatAsk);
    });
    el.addEventListener('pointerenter', () => { load(); }, { once: true }); // precarga al acercarse
  });
  window.addEventListener('chat:toggle', (e) => {
    const open = (e as CustomEvent<boolean>).detail;
    if (open) lenis?.stop(); else lenis?.start();
  });
}

/* ------------------------------------------------------------------ */
async function boot() {
  initLenis();
  initRuler();
  initNav();
  initChat();

  if (!motion) {
    initPaperTheme();
    initActiveLinks();
    return;
  }

  initCursor();
  initMagnetic();
  await initPreloader();
  heroIntro();

  const mm = gsap.matchMedia();
  mm.add({ desktop: '(min-width: 1024px)', mobile: '(max-width: 1023.98px)' }, (ctx) => {
    const desktop = Boolean(ctx.conditions?.desktop);
    const undoManifesto = initManifesto(desktop);
    initFindings(desktop);
    initLadder(desktop);
    return () => undoManifesto?.();
  });

  initDims();
  initPaperTheme();
  initToc();
  initAuthor();
  initCourse();
  initSplits();
  initReveals();
  initMarquee();
  initChapterPage();
  initDraw();
  initActiveLinks();

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
}

boot();
