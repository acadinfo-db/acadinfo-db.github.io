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

// Obfuscated PIN: split across charCodes
const _p1 = String.fromCharCode(49, 51);
const _p2 = String.fromCharCode(51, 55);
function _getKey() { return _p1 + _p2; }

function isAuthed() {
    return sessionStorage.getItem('acad-auth') === '1';
}

function setAuthed() {
    sessionStorage.setItem('acad-auth', '1');
    sessionStorage.removeItem('acad-pin-attempts');
    sessionStorage.removeItem('acad-pin-lockout');
}

function _getPinAttempts() {
    return parseInt(sessionStorage.getItem('acad-pin-attempts') || '0', 10);
}

function _setPinAttempts(n) {
    sessionStorage.setItem('acad-pin-attempts', String(n));
}

function _isLocked() {
    const lockUntil = parseInt(sessionStorage.getItem('acad-pin-lockout') || '0', 10);
    if (lockUntil && Date.now() < lockUntil) {
        return Math.ceil((lockUntil - Date.now()) / 1000);
    }
    if (lockUntil && Date.now() >= lockUntil) {
        sessionStorage.removeItem('acad-pin-lockout');
    }
    return 0;
}

function _lockPin(seconds) {
    sessionStorage.setItem('acad-pin-lockout', String(Date.now() + seconds * 1000));
}

function showPinModal(onSuccess) {
    if (isAuthed()) { onSuccess(); return; }

    const lockSecs = _isLocked();
    if (lockSecs > 0) {
        _showLockMessage(lockSecs);
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'pin-overlay';
    overlay.innerHTML = `
    <div class="pin-modal">
    <span class="micro">RESTRICTED ACCESS</span>
    <h3>Enter PIN</h3>
    <p>Sensitive data is protected. Enter the access PIN to reveal credentials and contact information.</p>
    <div class="pin-cells">
        <div class="pin-cell"></div>
        <div class="pin-cell"></div>
        <div class="pin-cell"></div>
        <div class="pin-cell"></div>
    </div>
    <input type="password" class="pin-input-hidden" maxlength="4"
    autocomplete="off" spellcheck="false" inputmode="numeric">
    <div class="pin-error"></div>
    <a href="#" class="pin-cancel" data-hover>Cancel</a>
    </div>
    `;

    document.body.appendChild(overlay);
    const input = overlay.querySelector('.pin-input-hidden');
    const error = overlay.querySelector('.pin-error');
    const cancel = overlay.querySelector('.pin-cancel');
    const cells = overlay.querySelectorAll('.pin-cell');

    requestAnimationFrame(() => input.focus());

    // Animate asterisks into cells
    input.addEventListener('input', () => {
        const val = input.value;
        cells.forEach((cell, i) => {
            if (i < val.length) {
                if (!cell.classList.contains('filled')) {
                    cell.classList.add('filled');
                    cell.textContent = '*';
                    cell.style.animation = 'none';
                    cell.offsetHeight; // trigger reflow
                    cell.style.animation = 'pin-char-in 0.3s var(--ease)';
                }
            } else {
                cell.classList.remove('filled');
                cell.textContent = '';
                cell.style.animation = '';
            }
        });

        if (val.length === 4) {
            setTimeout(() => tryAuth(), 100);
        }
    });

    function tryAuth() {
        if (input.value === _getKey()) {
            setAuthed();
            overlay.remove();
            onSuccess();
        } else {
            const attempts = _getPinAttempts() + 1;
            _setPinAttempts(attempts);

            if (attempts >= 6) {
                _lockPin(300); // 5 min
                overlay.remove();
                _showLockMessage(300);
                return;
            } else if (attempts >= 3) {
                _lockPin(30); // 30 sec
                overlay.remove();
                _showLockMessage(30);
                return;
            }

            error.textContent = `Incorrect PIN (${3 - attempts} attempts left)`;
            overlay.querySelector('.pin-modal').classList.add('pin-shake');
            cells.forEach(c => { c.classList.remove('filled'); c.textContent = ''; c.style.animation = ''; });
            setTimeout(() => {
                overlay.querySelector('.pin-modal').classList.remove('pin-shake');
            }, 500);
            input.value = '';
            input.focus();
        }
    }

    input.addEventListener('keydown', e => {
        if (e.key === 'Escape') overlay.remove();
    });

    cancel.addEventListener('click', e => { e.preventDefault(); overlay.remove(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function _showLockMessage(secs) {
    const overlay = document.createElement('div');
    overlay.className = 'pin-overlay';
    overlay.innerHTML = `
    <div class="pin-modal">
    <span class="micro" style="color:var(--negative)">LOCKED</span>
    <h3>Too many attempts</h3>
    <p>Access locked for <strong>${secs}s</strong>. Try again later.</p>
    <a href="#" class="pin-cancel" data-hover>Close</a>
    </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('.pin-cancel').addEventListener('click', e => { e.preventDefault(); overlay.remove(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}


/* ── Censor helpers ───────────────────────────────── */

function censorEmail(email) {
    if (!email) return null;
    const at = email.indexOf('@');
    if (at < 0) return '****';
    const local = email.slice(0, at);
    const domain = email.slice(at);
    const show = Math.max(1, Math.min(2, local.length - 1));
    return local.slice(0, show) + '*'.repeat(Math.max(local.length - show, 3)) + domain;
}

function censorPassword(pwd) {
    if (!pwd) return null;
    return '*'.repeat(Math.max(pwd.length, 8));
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

    // Split into tokens for AND-based multi-token search
    const tokens = q.split(/\s+/).filter(t => t.length > 0);

    const fields = [
        s.first_name, s.last_name, s.username,
        s.phone_number, s.email, s.section_name,
        s.display_name, s.gender ? formatGender(s.gender) : '',
        s.class_num != null ? String(s.class_num) : '',
    ];

    // Every token must match at least one field
    return tokens.every(token =>
        fields.some(f => f && String(f).toLowerCase().includes(token))
    );
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

/* ── Copy to Clipboard ────────────────────────────── */

function initClickToCopy() {
    document.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-copy]');
        if (!target) return;

        const text = target.dataset.copy;
        if (!text) return;

        try {
            await navigator.clipboard.writeText(text);

            // Show toast
            const toast = document.createElement('div');
            toast.className = 'copy-toast fade-enter';
            toast.textContent = 'Copied!';
            document.body.appendChild(toast);

            // Position toast near cursor (fallback if we can't get mouse coords easily here, just fixed bottom or near element)
            const rect = target.getBoundingClientRect();
            toast.style.left = `${rect.left + (rect.width / 2)}px`;
            toast.style.top = `${rect.top - 30}px`;
            
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translate(-50%, -10px)';
                setTimeout(() => toast.remove(), 300);
            }, 1000);
            
        } catch (err) {
            console.error('Failed to copy', err);
        }
    });
}

// Init copy functionality on load
document.addEventListener('DOMContentLoaded', initClickToCopy);

/* ── Special Censoring (Anirudh) ──────────────────── */

function isProtectedUser(student) {
    if (!student || !student.display_name) return false;
    return student.display_name.trim().toLowerCase() === 'anirudh kumar gupta';
}

function censorPhone(phone) {
    if (!phone) return null;
    return '********' + phone.slice(-2);
}

