/* Slow, soft "drawer" scrolling (Lenis). Skipped for reduced-motion users. */
(function () {
  if (!window.Lenis || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const lenis = new Lenis({ lerp: 0.075, wheelMultiplier: 0.9, smoothWheel: true, syncTouch: true, syncTouchLerp: 0.06, touchInertiaMultiplier: 28 });
  window.lenis = lenis;
  function raf(t) { lenis.raf(t); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
  // in-page links glide too
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href*="#"]');
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    const target = document.querySelector(url.hash);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -72, duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) });
    history.replaceState(null, '', url.hash);
  });
})();
