/**
 * motion.js — Scroll reveal + number counter animations.
 */

function initReveal() {
    const obs = new IntersectionObserver(
        entries => entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('visible');
                obs.unobserve(e.target);
            }
        }),
        { threshold: 0.15, rootMargin: '0px 0px -32px 0px' }
    );
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}


function animateNum(el) {
    const target = parseInt(el.dataset.target, 10);
    if (isNaN(target)) return;
    const dur = target > 10000 ? 1800 : 1200;
    const start = performance.now();

    (function tick(now) {
        const t = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - t, 3);            // ease-out cubic
        el.textContent = Math.round(eased * target).toLocaleString();
        if (t < 1) requestAnimationFrame(tick);
    })(start);
}


function initCounters() {
    const obs = new IntersectionObserver(
        entries => entries.forEach(e => {
            if (!e.isIntersecting) return;

            const el = e.target;
            obs.unobserve(el);

            // Sync with parent reveal delay
            const parent = el.closest('.reveal');
            let wait = 0;
            if (parent) {
                const d = parseFloat(getComputedStyle(parent).getPropertyValue('--d')) || 0;
                wait = d * 100 + 500;
            }
            setTimeout(() => animateNum(el), wait);
        }),
        { threshold: 0.3 }
    );
    document.querySelectorAll('.counter').forEach(el => obs.observe(el));
}
