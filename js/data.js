/**
 * data.js — Shared data loader and utilities.
 * Used by all pages except landing.
 */

const DATA = {
    students: null,
    teachers: null,
    meta: null,
    loaded: false,
};

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
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function matchQ(text, q) {
    return text && String(text).toLowerCase().includes(q);
}

function searchStudent(s, raw) {
    const q = raw.toLowerCase();
    return matchQ(s.first_name, q) || matchQ(s.last_name, q) ||
    matchQ(s.username, q) || matchQ(s.phone_number, q) ||
    matchQ(s.email, q) || matchQ(s.section_name, q) ||
    matchQ(`${s.first_name} ${s.last_name}`, q);
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

function uniqueVals(arr, key) {
    return [...new Set(arr.map(i => i[key]).filter(v => v != null && v !== ''))].sort();
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
