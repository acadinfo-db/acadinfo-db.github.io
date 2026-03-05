/**
 * motion.js — Shared: scroll reveal, number counters, cursor.
 * Loaded on every page.
 */

/* ── Scroll reveal ────────────────────────────────── */

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
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => obs.observe(el));
}


/* ── Number counters ──────────────────────────────── */

function animateNum(el) {
    const target = parseInt(el.dataset.target, 10);
    if (isNaN(target)) return;
    const dur = target > 10000 ? 1800 : 1200;
    const start = performance.now();

    (function tick(now) {
        const t = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(eased * target).toLocaleString();
        if (t < 1) requestAnimationFrame(tick);
    })(start);
}

function initCounters() {
    const obs = new IntersectionObserver(
        entries => entries.forEach(e => {
            if (!e.isIntersecting) return;
            obs.unobserve(e.target);
            const parent = e.target.closest('.reveal');
            let wait = 0;
            if (parent) {
                const d = parseFloat(getComputedStyle(parent).getPropertyValue('--d')) || 0;
                wait = d * 100 + 500;
            }
            setTimeout(() => animateNum(e.target), wait);
        }),
        { threshold: 0.3 }
    );
    document.querySelectorAll('.counter').forEach(el => obs.observe(el));
}


/* ── Custom cursor: sharp inverted pointer ────────── */

function initCursor() {
    if (window.matchMedia('(hover: none)').matches) return;

    const el = document.createElement('div');
    el.className = 'cursor';
    el.innerHTML = `
    <div class="cursor-arrow">
    <svg viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1 1L1 19.5L5.5 15.5L9 23L12.5 21.5L9 14H15.5L1 1Z"
    fill="white" stroke="white" stroke-width="0.5"
    stroke-linejoin="round"/>
    </svg>
    </div>
    `;
    document.body.appendChild(el);

    let mx = -100, my = -100;

    document.addEventListener('mousemove', e => {
        mx = e.clientX;
        my = e.clientY;
        el.style.transform = `translate(${mx}px, ${my}px)`;
        if (!el.classList.contains('visible')) el.classList.add('visible');
    }, { passive: true });

        document.addEventListener('mouseleave', () => el.classList.remove('visible'));
        document.addEventListener('mouseenter', () => el.classList.add('visible'));
}


/* ── Shared page init ─────────────────────────────── */

function initPage() {
    document.documentElement.classList.add('js');
    initCursor();
    initReveal();
    initCounters();
}
