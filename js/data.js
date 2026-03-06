/**
 * data.js — Shared data loader, school state, PIN auth, utilities.
 * acad_INFO v4.3
 */

const DATA = {
    students: null,
    teachers: null,
    meta: null,
    loaded: false,
};

/* ── School state ─────────────────────────────────── */

const SCHOOL = {
    active: localStorage.getItem('acad-school') || 'dpshar',

    set(code) {
        this.active = code;
        localStorage.setItem('acad-school', code);
    },

    students() {
        if (!DATA.students) return [];
        return DATA.students.filter(s => s.school === this.active);
    },

    teachers() {
        if (!DATA.teachers) return [];
        return DATA.teachers.filter(t => t.school === this.active);
    },

    stats() {
        if (!DATA.meta || !DATA.meta.school_stats) return {};
        return DATA.meta.school_stats[this.active] || {};
    },

    info() {
        if (!DATA.meta || !DATA.meta.schools) return { name: this.active, code: this.active, count: 0 };
        return DATA.meta.schools.find(s => s.code === this.active) || { name: this.active, code: this.active, count: 0 };
    },

    sectionCount() {
        const stats = this.stats();
        return Object.keys(stats.section_counts || {}).length;
    },
};


/* ── PIN authentication ───────────────────────────── */

const _AK = atob('MTMzNw==');

function isAuthed() {
    return sessionStorage.getItem('acad-auth') === '1';
}

function setAuthed() {
    sessionStorage.setItem('acad-auth', '1');
}

function showPinModal(onSuccess) {
    if (isAuthed()) { onSuccess(); return; }

    const overlay = document.createElement('div');
    overlay.className = 'pin-overlay';
    overlay.innerHTML = `
    <div class="pin-modal">
    <span class="micro">RESTRICTED ACCESS</span>
    <h3>Enter PIN</h3>
    <p>Sensitive data is protected. Enter the access PIN to reveal credentials and contact information.</p>
    <input type="password" class="pin-input" maxlength="10"
    placeholder="····" autocomplete="off" spellcheck="false">
    <div class="pin-error"></div>
    <a href="#" class="pin-cancel" data-hover>Cancel</a>
    </div>
    `;

    document.body.appendChild(overlay);
    const input = overlay.querySelector('.pin-input');
    const error = overlay.querySelector('.pin-error');
    const cancel = overlay.querySelector('.pin-cancel');

    requestAnimationFrame(() => input.focus());

    function tryAuth() {
        if (input.value === _AK) {
            setAuthed();
            overlay.remove();
            onSuccess();
        } else {
            error.textContent = 'Incorrect PIN';
            input.classList.add('pin-error-state');
            overlay.querySelector('.pin-modal').classList.add('pin-shake');
            setTimeout(() => {
                overlay.querySelector('.pin-modal').classList.remove('pin-shake');
                input.classList.remove('pin-error-state');
            }, 500);
            input.value = '';
            input.focus();
        }
    }

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') tryAuth();
        if (e.key === 'Escape') overlay.remove();
    });

        cancel.addEventListener('click', e => { e.preventDefault(); overlay.remove(); });
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}


/* ── Censor helpers ───────────────────────────────── */

function censorEmail(email) {
    if (!email) return null;
    const at = email.indexOf('@');
    if (at < 0) return '••••';
    const local = email.slice(0, at);
    const domain = email.slice(at);
    const show = Math.max(1, Math.min(2, local.length - 1));
    return local.slice(0, show) + '•'.repeat(Math.max(local.length - show, 3)) + domain;
}

function censorPassword(pwd) {
    if (!pwd) return null;
    return '•'.repeat(Math.max(pwd.length, 8));
}


/* ── Data loader ──────────────────────────────────── */

async function loadData() {
    if (DATA.loaded) return DATA;
    try {
        const [s, t, m] = await Promise.all([
            fetch('data/students.json').then(r => r.json()),
                                            fetch('data/teachers.json').then(r => r.json()),
                                            fetch('data/meta.json').then(r => r.json()),
        ]);
        DATA.students = s;
        DATA.teachers = t;
        DATA.meta = m;
        DATA.loaded = true;
    } catch (e) {
        console.warn('Data load failed:', e.message);
    }
    return DATA;
}


/* ── Utilities ──────────────────────────────────── */

function esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function displayName(s) {
    return esc(s.display_name || s.first_name || s.username || 'Unknown');
}

function matchQ(text, q) {
    return text && String(text).toLowerCase().includes(q);
}

function searchStudent(s, raw) {
    const q = raw.toLowerCase().trim();
    if (!q) return true;
    return matchQ(s.first_name, q) || matchQ(s.last_name, q) ||
    matchQ(s.username, q) || matchQ(s.phone_number, q) ||
    matchQ(s.email, q) || matchQ(s.section_name, q) ||
    matchQ(s.display_name, q);
}

function sortBy(arr, key, desc = false) {
    return [...arr].sort((a, b) => {
        let va = a[key] ?? (desc ? -Infinity : Infinity);
        let vb = b[key] ?? (desc ? -Infinity : Infinity);
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        return desc ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1);
    });
}

function exportCSV(data, filename) {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const rows = data.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([keys.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
    Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob), download: filename
    }).click();
}

function formatGender(g) {
    const map = { 'male': 'Male', 'female': 'Female', 'prefer_not_to_say': 'Not set', 'not_set': 'Not set' };
    return map[g] || g || 'Not set';
}

function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function activityScore(s) {
    return (s.coins || 0) + ((s.gems || 0) * 50);
}


/* ── Switcher ─────────────────────────────────────── */

function renderSwitcher(containerId, onChange) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const schools = [
        { code: 'dpshar', label: 'DPS Harni' },
        { code: 'cygnus', label: 'Cygnus' },
    ];

    el.innerHTML = `
    <div class="switcher" role="tablist">
    <div class="switcher-bg"></div>
    ${schools.map(s => `
        <button class="switcher-btn ${SCHOOL.active === s.code ? 'active' : ''}"
        data-school="${s.code}" role="tab"
        aria-selected="${SCHOOL.active === s.code}">
        ${s.label}
        </button>
        `).join('')}
        </div>
        `;

        const bg = el.querySelector('.switcher-bg');
        const btns = el.querySelectorAll('.switcher-btn');

        function updateBg() {
            const activeBtn = el.querySelector('.switcher-btn.active');
            if (activeBtn && bg) {
                bg.style.width = activeBtn.offsetWidth + 'px';
                bg.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
            }
        }

        requestAnimationFrame(updateBg);
        window.addEventListener('resize', updateBg);

        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                const code = btn.dataset.school;
                if (code === SCHOOL.active) return;
                SCHOOL.set(code);
                btns.forEach(b => {
                    b.classList.toggle('active', b.dataset.school === code);
                    b.setAttribute('aria-selected', b.dataset.school === code);
                });
                updateBg();
                if (onChange) onChange(code);
            });
        });
}


/* ── Sidebar ──────────────────────────────────────── */

function updateSidebarCounts() {
    const teachers = SCHOOL.teachers();
    const students = SCHOOL.students();
    const sections = SCHOOL.sectionCount();
    const navTotal = document.getElementById('nav-total');
    const navStudents = document.getElementById('nav-students');
    const navTeachers = document.getElementById('nav-teachers');
    const navClasses = document.getElementById('nav-classes');
    if (navTotal) navTotal.textContent = students.length.toLocaleString();
    if (navStudents) navStudents.textContent = students.length.toLocaleString();
    if (navTeachers) navTeachers.textContent = teachers.length;
    if (navClasses) navClasses.textContent = sections;
}
