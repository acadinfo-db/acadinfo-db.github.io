/**
 * landing.js — Landing page: reveal, counters, typing, particles, cursor.
 */

document.documentElement.classList.add('js');

/* ── Custom cursor ────────────────────────────────── */

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

    const px = 2;
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

        const hoverEls = 'a, button, [data-hover], input, select, textarea, .hero-cta, .process-card';
        document.addEventListener('mouseover', e => {
            if (e.target.closest(hoverEls)) el.classList.add('hover');
        });
            document.addEventListener('mouseout', e => {
                if (e.target.closest(hoverEls)) el.classList.remove('hover');
            });
}

/* ── Typing effect with realistic mistakes ────────── */

function typeWithMistakes(el, phrases, opts = {}) {
    const {
        typeSpeed   = 55,
        deleteSpeed = 30,
        pauseAfter  = 2600,
        mistakeRate = 0.07,
    } = opts;

    const textEl = el.querySelector('.hero-typing-text');
    if (!textEl) return;

    let phraseIdx = 0;
    let charIdx   = 0;
    let deleting  = false;
    let current   = '';
    let mistakeBuffer = '';
    let isCorrecting  = false;

    function randomMistake(intended) {
        const nearby = {
            a:'sq', b:'vn', c:'xv', d:'sf', e:'wr', f:'dg', g:'fh',
            h:'gj', i:'uo', j:'hk', k:'jl', l:'k;', m:'n,', n:'bm',
            o:'ip', p:'o[', q:'wa', r:'et', s:'ad', t:'ry', u:'yi',
            v:'cb', w:'qe', x:'zc', y:'tu', z:'xa', ' ':' ',
        };
        const key = intended.toLowerCase();
        const pool = nearby[key] || key;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    function tick() {
        const phrase = phrases[phraseIdx];

        if (isCorrecting) {
            current = current.slice(0, -1);
            textEl.textContent = current;
            if (current.length <= charIdx) {
                isCorrecting = false;
                setTimeout(tick, typeSpeed + Math.random() * 40);
            } else {
                setTimeout(tick, deleteSpeed);
            }
            return;
        }

        if (!deleting) {
            if (charIdx < phrase.length) {
                const intended = phrase[charIdx];

                if (!mistakeBuffer && Math.random() < mistakeRate && charIdx > 2) {
                    const wrong = randomMistake(intended);
                    current += wrong;
                    mistakeBuffer = intended;
                    textEl.textContent = current;
                    setTimeout(() => {
                        isCorrecting = true;
                        setTimeout(tick, 150 + Math.random() * 100);
                    }, 200 + Math.random() * 150);
                    return;
                }

                if (mistakeBuffer) {
                    current += mistakeBuffer;
                    mistakeBuffer = '';
                    charIdx++;
                } else {
                    current += intended;
                    charIdx++;
                }

                textEl.textContent = current;

                let delay = typeSpeed + Math.random() * 30;
                if (intended === '.' || intended === ',') delay += 200;
                if (intended === ' ') delay += 40;

                setTimeout(tick, delay);
            } else {
                setTimeout(() => {
                    deleting = true;
                    tick();
                }, pauseAfter);
            }
        } else {
            if (current.length > 0) {
                current = current.slice(0, -1);
                textEl.textContent = current;
                setTimeout(tick, deleteSpeed + Math.random() * 15);
            } else {
                deleting = false;
                charIdx = 0;
                phraseIdx = (phraseIdx + 1) % phrases.length;
                setTimeout(tick, 400);
            }
        }
    }

    setTimeout(tick, 2000);
}


/* ── Spawn particles ──────────────────────────────── */

function initParticles() {
    const container = document.querySelector('.particles');
    if (!container) return;

    function spawn() {
        const p = document.createElement('div');
        p.className = 'particle';

        const x = 10 + Math.random() * 80;
        const size = 1.5 + Math.random() * 2;
        const dur = 10 + Math.random() * 14;
        const delay = Math.random() * 6;

        p.style.left = x + '%';
        p.style.bottom = '-10px';
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.animationDuration = dur + 's';
        p.style.animationDelay = delay + 's';

        const r = Math.random();
        if (r > 0.65) {
            p.style.background = 'rgba(255, 255, 255, 0.35)';
        } else if (r > 0.4) {
            p.style.background = 'rgba(139, 92, 246, 0.4)';
        }

        container.appendChild(p);
        p.addEventListener('animationend', () => p.remove());
    }

    for (let i = 0; i < 25; i++) spawn();
    setInterval(() => {
        if (document.querySelectorAll('.particle').length < 30) spawn();
    }, 1200);
}


/* ── Nav coordinate display ───────────────────────── */

function initCoords() {
    const el = document.querySelector('.l-nav-coords');
    if (!el) return;

    document.addEventListener('mousemove', e => {
        const x = e.clientX.toString().padStart(4, '0');
        const y = e.clientY.toString().padStart(4, '0');
        el.textContent = `X:${x} Y:${y}`;
    });
}


/* ── Init ─────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {

    try {
        const r = await fetch('data/meta.json');
        if (r.ok) {
            const m = await r.json();
            document.querySelectorAll('.counter[data-key]').forEach(el => {
                const v = m[el.dataset.key];
                if (v != null) el.dataset.target = v;
            });
        }
    } catch (_) {}

    initCursor();
    initReveal();
    initCounters();
    initParticles();
    initCoords();

    const typingEl = document.querySelector('.hero-typing');
    if (typingEl) {
        typeWithMistakes(typingEl, [
            'All data extracted. No rate limits encountered.',
            '515,764 credentials checked in 36 minutes.',
            'Default passwords. Predictable usernames. Zero friction.',
            '1,319 student profiles. 18 fields each. Indexed.',
            'The system had no defenses. We walked in.',
        ]);
    }
});
