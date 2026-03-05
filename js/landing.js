/**
 * landing.js — Landing page: typing, particles, coords.
 */

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

    let phraseIdx = 0, charIdx = 0, deleting = false;
    let current = '', mistakeBuffer = '', isCorrecting = false;

    function nearby(ch) {
        const map = {
            a:'sq',b:'vn',c:'xv',d:'sf',e:'wr',f:'dg',g:'fh',h:'gj',
            i:'uo',j:'hk',k:'jl',l:'k;',m:'n,',n:'bm',o:'ip',p:'o[',
            q:'wa',r:'et',s:'ad',t:'ry',u:'yi',v:'cb',w:'qe',x:'zc',
            y:'tu',z:'xa',' ':' ',
        };
        const pool = map[ch.toLowerCase()] || ch;
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
                const ch = phrase[charIdx];
                if (!mistakeBuffer && Math.random() < mistakeRate && charIdx > 2) {
                    current += nearby(ch);
                    mistakeBuffer = ch;
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
                    current += ch;
                    charIdx++;
                }
                textEl.textContent = current;
                let d = typeSpeed + Math.random() * 30;
                if (ch === '.' || ch === ',') d += 200;
                if (ch === ' ') d += 40;
                setTimeout(tick, d);
            } else {
                setTimeout(() => { deleting = true; tick(); }, pauseAfter);
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


function initParticles() {
    const c = document.querySelector('.particles');
    if (!c) return;

    function spawn() {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = (10 + Math.random() * 80) + '%';
        p.style.bottom = '-10px';
        const s = 1.5 + Math.random() * 2;
        p.style.width = s + 'px';
        p.style.height = s + 'px';
        p.style.animationDuration = (10 + Math.random() * 14) + 's';
        p.style.animationDelay = (Math.random() * 6) + 's';
        const r = Math.random();
        if (r > 0.65) p.style.background = 'rgba(255,255,255,0.35)';
        else if (r > 0.4) p.style.background = 'rgba(139,92,246,0.4)';
        c.appendChild(p);
        p.addEventListener('animationend', () => p.remove());
    }

    for (let i = 0; i < 25; i++) spawn();
    setInterval(() => {
        if (document.querySelectorAll('.particle').length < 30) spawn();
    }, 1200);
}


function initCoords() {
    const el = document.querySelector('.l-nav-coords');
    if (!el) return;
    document.addEventListener('mousemove', e => {
        el.textContent = `X:${String(e.clientX).padStart(4,'0')} Y:${String(e.clientY).padStart(4,'0')}`;
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

    initPage();
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
