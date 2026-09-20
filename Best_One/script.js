/* ============================================================
   RADSHIPS — Interaction engine
   - scrolling: Lenis virtual smooth scroll (CDN) with native
     fallback — platform-feeling momentum either way
   - cursor light: lerped transform + velocity-reactive scale
     (single compositor write per frame)
   - hero parallax: scroll-linked transform/opacity, rAF-fed
   - shrinking header, scroll reveals, keyboard lights, rain
   Hot paths never read layout and never write anything
   but transform/opacity.
   ============================================================ */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- 0. Lenis smooth scroll (graceful fallback) ---------- */
  let lenis = null;
  const initLenis = () => {
    if (reduceMotion || typeof window.Lenis === 'undefined') return;
    try {
      lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
      document.documentElement.classList.add('lenis-on');
      const raf = (time) => {
        lenis.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    } catch (err) {
      lenis = null;
    }
  };

  const headerOffset = () => {
    const bar = document.querySelector('.topbar');
    return (bar ? bar.getBoundingClientRect().height : 0) + 12;
  };

  /* ---------- 1. Cursor light ---------- */
  const initSpotlight = () => {
    if (reduceMotion || !finePointer) return;
    const spot = document.querySelector('.spotlight');
    if (!spot) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight * 0.4;
    let currentX = targetX;
    let currentY = targetY;
    let scale = 1;
    let targetScale = 1;
    let prevX = targetX;
    let prevY = targetY;
    let rafId = null;
    let shown = false;

    const tick = () => {
      // Exponential damping on position = springy trail
      currentX += (targetX - currentX) * 0.14;
      currentY += (targetY - currentY) * 0.14;
      // Cursor speed puffs the glow up a touch — feels alive
      const speed = Math.hypot(targetX - prevX, targetY - prevY);
      prevX = targetX;
      prevY = targetY;
      targetScale = 1 + Math.min(speed / 220, 0.16);
      scale += (targetScale - scale) * 0.1;
      // The ONLY per-frame write: one compositor transform
      spot.style.transform =
        `translate3d(${currentX.toFixed(1)}px, ${currentY.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;

      const settled =
        Math.abs(targetX - currentX) < 0.1 &&
        Math.abs(targetY - currentY) < 0.1 &&
        Math.abs(targetScale - scale) < 0.002;
      if (settled) {
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!shown) {
        shown = true;
        document.body.classList.add('has-spot');
        currentX = targetX;
        currentY = targetY;
        prevX = targetX;
        prevY = targetY;
      }
      if (rafId === null) rafId = requestAnimationFrame(tick);
    }, { passive: true });

    window.addEventListener('mouseleave', () => {
      document.body.classList.remove('has-spot');
      shown = false;
    });
  };

  /* ---------- 2. Anchors (via Lenis when present) ---------- */
  const initAnchors = () => {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const id = link.getAttribute('href');
        if (!id || id.length < 2) return;
        const destination = document.querySelector(id);
        if (!destination) return;
        event.preventDefault();
        if (lenis) {
          lenis.scrollTo(destination, { offset: -headerOffset(), duration: 1.35 });
        } else {
          // scroll-margin-top in CSS covers the sticky header here
          destination.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        }
        destination.setAttribute('tabindex', '-1');
        destination.focus({ preventScroll: true });
      });
    });
  };

  /* ---------- 3. Hero parallax (scroll-linked, transform only) ---------- */
  const initParallax = () => {
    if (reduceMotion) return;
    const hero = document.querySelector('.hero');
    const content = document.querySelector('.hero-content');
    if (!hero || !content) return;

    let heroHeight = hero.offsetHeight;
    window.addEventListener('resize', () => {
      heroHeight = hero.offsetHeight;
    });

    let ticking = false;
    const update = (y) => {
      ticking = false;
      if (y < 0 || y > heroHeight) return;
      const p = y / heroHeight;
      content.style.transform = `translate3d(0, ${(y * 0.22).toFixed(1)}px, 0)`;
      content.style.opacity = (1 - p * 0.55).toFixed(3);
    };
    const requestUpdate = (y) => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => update(y));
    };

    if (lenis) {
      lenis.on('scroll', ({ scroll }) => requestUpdate(scroll));
    } else {
      window.addEventListener('scroll', () => requestUpdate(window.scrollY), { passive: true });
    }
  };

  /* ---------- 4. Shrinking header ---------- */
  const initHeader = () => {
    const hero = document.querySelector('.hero');
    const sync = () => {
      document.body.classList.toggle('scrolled', window.scrollY > 40);
    };

    if ('IntersectionObserver' in window && hero) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          document.body.classList.toggle('scrolled', !entry.isIntersecting);
        },
        { rootMargin: '-64px 0px 0px 0px', threshold: 0 }
      );
      observer.observe(hero);
    }
    window.addEventListener('scroll', sync, { passive: true });
    sync();
  };

  /* ---------- 5. Scroll reveals ---------- */
  const initReveals = () => {
    const targets = document.querySelectorAll(
      '.section-header, .brief-row, .buildlog-row, .faq-item, .keyboard-visualizer, .buildlog, .cta-content, .ysws-pill'
    );
    if (!('IntersectionObserver' in window) || reduceMotion) return;

    const groups = new Map();
    targets.forEach((el) => {
      const parent = el.parentElement;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(el);
    });
    groups.forEach((siblings) => {
      siblings.forEach((el, i) => {
        el.style.setProperty('--reveal-delay', `${Math.min(i * 80, 240)}ms`);
        el.classList.add('reveal');
      });
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -32px 0px' }
    );
    targets.forEach((el) => observer.observe(el));
  };

  /* ---------- 6. Keyboard visualizer ---------- */
  const initKeyboard = () => {
    const viz = document.querySelector('.keyboard-visualizer');
    if (!viz) return;
    const keys = Array.from(viz.querySelectorAll('.key'));

    const lightUp = () => {
      keys.forEach((key, i) => {
        window.setTimeout(() => key.classList.add('lit'), reduceMotion ? 0 : 200 + i * 110);
      });
    };

    if ('IntersectionObserver' in window && !reduceMotion) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              lightUp();
              observer.disconnect();
            }
          });
        },
        { threshold: 0.4 }
      );
      observer.observe(viz);
    } else {
      lightUp();
    }

    keys.forEach((key) => {
      key.addEventListener('click', () => key.classList.toggle('lit'));
    });

    if (finePointer) {
      window.addEventListener('keydown', (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
        const match = viz.querySelector(`[data-key="${e.key.toUpperCase()}"]`);
        if (!match) return;
        match.classList.add('lit');
        match.classList.remove('pressed');
        void match.offsetWidth;
        match.classList.add('pressed');
      });
    }
  };

  /* ---------- 7. Hero raindrops ---------- */
  const initRaindrops = () => {
    if (reduceMotion) return;
    const field = document.querySelector('.raindrops');
    if (!field) return;
    for (let i = 0; i < 12; i++) {
      const drop = document.createElement('span');
      drop.className = 'raindrop';
      const size = 2 + Math.random() * 4;
      drop.style.left = `${Math.random() * 100}%`;
      drop.style.width = `${size}px`;
      drop.style.height = `${size}px`;
      drop.style.animationDuration = `${5 + Math.random() * 7}s`;
      drop.style.animationDelay = `${-Math.random() * 10}s`;
      field.appendChild(drop);
    }
  };

  /* ---------- Boot (Lenis first — parallax/anchors need it) ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initLenis();
    initSpotlight();
    initAnchors();
    initParallax();
    initHeader();
    initReveals();
    initKeyboard();
    initRaindrops();
  });
})();
