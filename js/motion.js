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
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
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


/* ── Custom pixel cursor ──────────────────────────── */

function initCursor() {
    if (window.matchMedia('(hover: none)').matches) return;

    const rows = [
        'B...............',
        'BB..............',
        'BWB.............',
        'BWWB............',
        'BWWWB...........',
        'BWWWWB..........',
        'BWWWWWB.........',
        'BWWWWWWB........',
        'BWWWWWWWB.......',
        'BWWWWWWWWB......',
        'BWWWWWWWWWB.....',
        'BWWWWWWWWWWB....',
        'BWWWWWWBBBBB....',
        'BWWWBWWB........',
        'BWWB.BWWB.......',
        'BWB..BWWB.......',
        'BB....BWWB......',
        'B.....BWWB......',
        '.......BWWB.....',
        '.......BWWB.....',
        '........BB......',
    ];

    const px = 1.5;
    let rects = '';
    rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c === 'B')
                rects += `<rect x="${x*px}" y="${y*px}" width="${px}" height="${px}" fill="#000"/>`;
            else if (c === 'W')
                rects += `<rect x="${x*px}" y="${y*px}" width="${px}" height="${px}" fill="#fff"/>`;
        }
    });

    const svgW = 16 * px;
    const svgH = rows.length * px;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" shape-rendering="crispEdges">${rects}</svg>`;

    const el = document.createElement('div');
    el.className = 'cursor';
    el.innerHTML = `<div class="cursor-icon">${svg}</div>`;
    document.body.appendChild(el);

    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    document.body.appendChild(dot);

    document.addEventListener('mousemove', e => {
        el.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        if (!el.classList.contains('visible')) el.classList.add('visible');
    });
        document.addEventListener('mouseleave', () => el.classList.remove('visible'));
        document.addEventListener('mouseenter', () => el.classList.add('visible'));

        const hoverEls = 'a, button, [data-hover], input, select, textarea';
        document.addEventListener('mouseover', e => {
            if (e.target.closest(hoverEls)) el.classList.add('hover');
        });
            document.addEventListener('mouseout', e => {
                if (e.target.closest(hoverEls)) el.classList.remove('hover');
            });
}


/* ── Shared page init ─────────────────────────────── */

function initPage() {
    document.documentElement.classList.add('js');
    initCursor();
    initReveal();
    initCounters();
}
