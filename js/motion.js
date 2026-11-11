/* ==========================================================================
   MOTION : Lenis (smooth scroll) + GSAP / ScrollTrigger
   - Animations limitées à transform et opacity (60 images/s)
   - prefers-reduced-motion : version statique, sans loader ni parallax
   - Épinglage / défilement horizontal uniquement ≥ 900 px (mobile allégé)
   ========================================================================== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const header = $('#header');
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  /* ---------- Éléments d'interface indépendants de GSAP ---------- */
  const burger = $('#burger'), menu = $('#menu');
  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    menu.setAttribute('aria-hidden', !open);
    root.style.overflow = open ? 'hidden' : '';
    window.__lenis && (open ? window.__lenis.stop() : window.__lenis.start());
    header.classList.toggle('menu-open', open);
  }
  burger.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false); });

  if (!window.gsap || !window.ScrollTrigger) {
    $('#loader').remove(); document.body.classList.remove('is-loading'); root.classList.add('no-motion'); return;
  }
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Mode sans animation ---------- */
  if (reduce) {
    root.classList.add('no-motion');
    $('#loader').remove(); document.body.classList.remove('is-loading');
    $$('.step').forEach((s, i) => { s.style.opacity = 1; s.style.transform = 'none'; s.style.gridArea = 'auto'; });
    $$('.counter, [data-count]').forEach(el => { el.textContent = el.dataset.count + (el.dataset.suffix || ''); });
    $$('.footer__big span').forEach(s => s.style.webkitTextStroke = '1px rgba(247,242,234,.5)');
    header.classList.add('is-solid');
    window.addEventListener('scroll', () => { header.classList.toggle('is-hidden', false); }, { passive: true });
    const bar = $('#progressBar'); window.addEventListener('scroll', () => { bar.style.transform = `scaleX(${scrollY / (root.scrollHeight - innerHeight || 1)})`; }, { passive: true });
    document.addEventListener('click', e => { const a = e.target.closest('a[href^="#"]'); if (a && a.getAttribute('href').length > 1) { const t = $(a.getAttribute('href')); if (t) { e.preventDefault(); t.scrollIntoView(); } } });
    return;
  }

  root.classList.add('js');

  /* ---------- Lenis ---------- */
  let lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 1 });
    window.__lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const id = a.getAttribute('href'); if (id.length < 2) return;
    const t = $(id); if (!t) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(t, { offset: id === '#top' ? 0 : -4, duration: 1.8, easing: x => 1 - Math.pow(1 - x, 4) });
    else t.scrollIntoView({ behavior: 'smooth' });
  });

  /* ---------- Découpage du texte ---------- */
  function splitWords(el) {
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    el.setAttribute('aria-label', text);
    el.innerHTML = text.split(' ').map(w => `<span class="w" aria-hidden="true"><span>${w}</span></span>`).join(' ');
    return $$('.w > span', el);
  }
  function splitChars(el) {
    const text = el.textContent;
    el.innerHTML = text.split(' ').map(w => `<span class="cw" aria-hidden="true" style="display:inline-block;white-space:nowrap">${[...w].map(c => `<span class="ch">${c}</span>`).join('')}</span>`).join(' ');
    return $$('.ch', el);
  }
  const heroChars = $$('[data-split="chars"]').flatMap(splitChars);
  const wordGroups = $$('[data-split="words"]').map(el => ({ el, words: splitWords(el) }));
  $$('.footer__big span').forEach(s => { const t = s.textContent; s.innerHTML = `<b>${t}</b>`; });

  /* ---------- État initial ---------- */
  gsap.set(heroChars, { yPercent: 115 });
  gsap.set(['.hero__eyebrow', '.hero__lead', '.hero__cta', '.hero .by'], { opacity: 0, y: 28 });
  gsap.set('.hero__bg', { scale: 1.12 });
  gsap.set('.card', { opacity: 0, y: 60 });
  gsap.set('.footer__big b', { yPercent: 110 });
  wordGroups.forEach(g => gsap.set(g.words, { yPercent: 115 }));

  /* ---------- Loader : fil qui se dessine, compteur, rideau de bandes ---------- */
  const path = $('#loaderPath'), len = path.getTotalLength();
  gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
  gsap.set('.loader__title span', { yPercent: 110 });
  gsap.set('.loader__sub', { opacity: 0, y: 12 });
  const counter = { v: 0 }, countEl = $('#loaderCount');
  /* la pelote tourne et rétrécit en lâchant son fil ; le crochet suit le bout du fil, la pointe en avant, et finit avec une petite boucle */
  const ball = $('#loaderBall'), spin = $('#loaderSpin'), hook = $('#loaderHook'), loopEl = $('#loaderLoop');
  const BX = 46, BY = 74, SX = 73.2, SY = 86.7, prog = { p: 0 }, loopS = { s: 0 };
  function wind() {
    const p = prog.p, L = len * p, s = 1 - .3 * p;
    path.style.strokeDashoffset = len - L;
    ball.setAttribute('transform', `translate(${SX} ${SY}) scale(${s.toFixed(3)}) translate(${-SX} ${-SY})`);   /* elle rétrécit vers le point où part le fil */
    spin.setAttribute('transform', `rotate(${(p * 840).toFixed(1)} ${BX} ${BY})`);
    const a = path.getPointAtLength(L), b = path.getPointAtLength(Math.min(len, L + 1)), c = path.getPointAtLength(Math.max(0, L - 1));
    const tilt = 34 - 16 * Math.max(0, (p - .9) / .1);
    hook.setAttribute('transform', `translate(${a.x.toFixed(2)} ${a.y.toFixed(2)}) rotate(${(Math.atan2(b.y - c.y, b.x - c.x) * 180 / Math.PI + tilt).toFixed(1)})`);
    countEl.textContent = Math.round(p * 100);
  }
  wind();
  const pageReady = new Promise(res => { if (document.readyState === 'complete') res(); else window.addEventListener('load', res, { once: true }); setTimeout(res, 2400); });

  function heroIn() {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to('.hero__bg', { scale: 1, duration: 2.4 }, 0)
      .to(heroChars, { yPercent: 0, duration: 1.5, stagger: .035 }, 0.1)
      .to('.hero .by', { opacity: 1, y: 0, duration: 1.2 }, .7)
      .to('.hero__eyebrow', { opacity: 1, y: 0, duration: 1.1 }, .35)
      .to('.hero__lead', { opacity: 1, y: 0, duration: 1.2 }, .8)
      .to('.hero__cta', { opacity: 1, y: 0, duration: 1.2 }, 1)
      ;
    return tl;
  }

  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  intro.to('.loader__title span', { yPercent: 0, duration: .9 }, .05)
    .to('.loader__sub', { opacity: 1, y: 0, duration: .9 }, .5)
    .to(prog, { p: 1, duration: 1.5, ease: 'power2.inOut', onUpdate: wind }, .15)   /* la pelote se déroule, le crochet mène le fil et le compteur monte */
    .to(loopS, { s: 1, duration: .45, ease: 'back.out(2.4)', onUpdate: () => loopEl.setAttribute('transform', `scale(${loopS.s.toFixed(3)})`) }, 1.5)   /* à la fin : une petite boucle sur le crochet */
    .add(() => { intro.pause(); pageReady.then(() => intro.resume()); }, 2)
    .to('.loader__inner', { opacity: 0, y: -40, duration: .7, ease: 'power2.in' }, '>+.1')
    .to('.loader__strips i', { scaleY: 0, duration: 1.0, ease: 'expo.inOut', stagger: { each: .07, from: 'center' } }, '>-.25')
    .add(() => { document.body.classList.remove('is-loading'); heroIn(); }, '<+.35')
    .set('#loader', { display: 'none' });
  /* ---------- Hero : parallax multicouche ---------- */
  gsap.to('.hero__bg', { yPercent: 14, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
  gsap.to('[data-hero-mid]', { yPercent: -16, opacity: .0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: '80% top', scrub: true } });

  /* ---------- En-tête : se cache en descendant, revient en remontant ---------- */
  /* L'en-tête passe en clair quand il survole une zone sombre (hero, atelier, pied de page) */
  const darkEls = ['#hero', '#atelier', '.footer'].map(s => $(s));
  const paintHeader = () => {
    const over = darkEls.some(el => { const r = el.getBoundingClientRect(); return r.top <= 44 && r.bottom >= 44; });
    header.classList.toggle('on-dark', over);
  };
  gsap.ticker.add(paintHeader);
  paintHeader();
  let lastY = 0;
  function onScroll(y, dir) {
    header.classList.toggle('is-solid', y > 40);
    if (menu.classList.contains('is-open')) return;
    if (dir > 0 && y > 260) header.classList.add('is-hidden'); else if (dir < 0 || y < 120) header.classList.remove('is-hidden');
    lastY = y;
  }
  if (lenis) lenis.on('scroll', e => onScroll(e.scroll, e.direction));
  else window.addEventListener('scroll', () => { onScroll(scrollY, scrollY > lastY ? 1 : -1); }, { passive: true });
  header.addEventListener('focusin', () => header.classList.remove('is-hidden'));

  /* ---------- Barre de progression (le fil) ---------- */
  gsap.to('#progressBar', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .3 } });

  /* ---------- Marquee : vitesse et sens liés au scroll ---------- */
  const track = $('.marquee__track');
  const mq = gsap.to(track, { xPercent: -50, repeat: -1, duration: 38, ease: 'none' });
  ScrollTrigger.create({
    onUpdate: self => {
      const v = Math.min(Math.abs(self.getVelocity()) / 260, 7);
      gsap.to(mq, { timeScale: self.direction * (1 + v), duration: .25, overwrite: true, onComplete: () => gsap.to(mq, { timeScale: self.direction, duration: 1.2 }) });
    }
  });

  /* ---------- Révélations génériques ---------- */
  wordGroups.forEach(g => ScrollTrigger.create({ trigger: g.el, start: 'top 88%', once: true, onEnter: () => gsap.to(g.words, { yPercent: 0, duration: 1.3, stagger: .06, ease: 'expo.out' }) }));
  ScrollTrigger.batch('[data-reveal]', { start: 'top 90%', once: true, onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: 1.1, stagger: .1, ease: 'expo.out', overwrite: true }) });
  $$('[data-reveal-mask]').forEach(el => {
    const img = $('img', el);
    ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => {
      gsap.to(el, { clipPath: 'inset(0% 0% 0% 0% round 24px)', duration: 1.5, ease: 'expo.inOut' });
    } });
  });
  ScrollTrigger.batch('.card', { start: 'top 92%', once: true, onEnter: b => gsap.to(b, { opacity: 1, y: 0, duration: 1.2, stagger: .12, ease: 'expo.out', overwrite: true, clearProps: 'opacity,transform' }) });
  ScrollTrigger.create({ trigger: '.footer__big', start: 'top 92%', once: true, onEnter: () => gsap.to('.footer__big b', { yPercent: 0, duration: 1.6, stagger: .12, ease: 'expo.out' }) });

  /* ---------- Compteurs ---------- */
  $$('[data-count]').forEach(el => {
    const target = +el.dataset.count, suffix = el.dataset.suffix || '', o = { v: 0 };
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: target, duration: 2.2, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v) + suffix; } }) });
  });

  /* ---------- Images : léger déplacement dans leur cadre ---------- */
  $$('[data-parallax]').forEach(img => {
    if (img.closest('.models')) return;
    gsap.fromTo(img, { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  /* ---------- Pastilles de couleur : entrée en cascade ---------- */
  gsap.from('.sw', { scale: .6, opacity: 0, stagger: { each: .03, from: 'random' }, duration: 1, ease: 'back.out(1.6)', scrollTrigger: { trigger: '#colorWall', start: 'top 85%', once: true } });

  /* ---------- Desktop : horizontal + section pinnée ---------- */
  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px)', () => {
    const track = $('.models__track'), pin = $('.models__pin');
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    const h = gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: pin, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 } });
    $$('.mpanel__img img', track).forEach(img => {
      gsap.fromTo(img, { scale: 1.2 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: img.closest('.mpanel'), containerAnimation: h, start: 'left 95%', end: 'left 25%', scrub: true } });
    });

    /* Atelier : storytelling étape par étape */
    const steps = $$('.step'), photos = $$('.aph'), dots = $$('.atelier__dots i'), vid = $('.atelier__video');
    let cur = -1;
    const setStep = i => {
      if (i === cur) return; cur = i;
      steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
      photos.forEach((s, k) => s.classList.toggle('is-active', k === i));
      dots.forEach((s, k) => s.classList.toggle('is-active', k === i));
    };
    setStep(0);
    ScrollTrigger.create({ trigger: '.atelier__pin', start: 'top top', end: '+=330%', pin: true, anticipatePin: 1, onUpdate: self => setStep(Math.min(steps.length - 1, Math.floor(self.progress * steps.length))) });
    /* fond : la fiche de tous les modèles défile du haut (paniers) vers le bas (sacs) pendant les quatre étapes */
    const panMax = () => Math.max(0, vid.offsetHeight - $('.atelier__pin').offsetHeight);
    gsap.fromTo(vid, { y: 0 }, { y: () => -panMax(), ease: 'none', scrollTrigger: { trigger: '.atelier__pin', start: 'top top', end: '+=330%', scrub: true, invalidateOnRefresh: true } });
    return () => { setStep(0); };
  });
  mm.add('(max-width: 899px)', () => {
    $$('.step').forEach(s => s.classList.add('is-active'));
    $$('.aph').forEach((s, i) => s.classList.toggle('is-active', i === 0));
  });

  /* ---------- Micro-interactions : aimant, inclinaison 3D, reflet ---------- */
  if (finePointer) {
    $$('.magnetic').forEach(el => {
      const xTo = gsap.quickTo(el, 'x', { duration: .6, ease: 'elastic.out(1, .5)' }), yTo = gsap.quickTo(el, 'y', { duration: .6, ease: 'elastic.out(1, .5)' });
      el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); xTo((e.clientX - (r.left + r.width / 2)) * .28); yTo((e.clientY - (r.top + r.height / 2)) * .38); });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
    const tilt = (el, max) => {
      const rx = gsap.quickTo(el, 'rotationX', { duration: .5, ease: 'power3.out' }), ry = gsap.quickTo(el, 'rotationY', { duration: .5, ease: 'power3.out' });
      gsap.set(el, { transformPerspective: 900 });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        ry((px - .5) * max * 2); rx(-(py - .5) * max * 2);
        el.style.setProperty('--mx', px * 100 + '%'); el.style.setProperty('--my', py * 100 + '%');
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); });
    };
    $$('.card').forEach(c => tilt(c, 5));
    $$('[data-tilt]').forEach(c => tilt(c, 7));
  }

  /* ---------- Rafraîchissements ---------- */
  const refresh = () => ScrollTrigger.refresh();
  window.addEventListener('load', () => setTimeout(refresh, 200));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(refresh, 100));
  window.addEventListener('mpc:layout', () => {
    const visible = $$('.card').filter(c => !c.hidden);
    gsap.fromTo(visible, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .9, stagger: .07, ease: 'expo.out', clearProps: 'opacity,transform' });
    setTimeout(refresh, 80);
  });
  $$('details').forEach(d => d.addEventListener('toggle', () => setTimeout(refresh, 50)));
})();


