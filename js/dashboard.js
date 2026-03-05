/**
 * dashboard.js — Render dashboard with real data from JSON.
 */

document.addEventListener('DOMContentLoaded', async () => {
    initPage();

    const { students, teachers, meta } = await loadData();
    if (!meta) return;

    /* ── Sidebar counts ───────────────────────────── */

    const navTotal = document.getElementById('nav-total');
    const navStudents = document.getElementById('nav-students');
    const navTeachers = document.getElementById('nav-teachers');
    if (navTotal)    navTotal.textContent = meta.total_students.toLocaleString();
    if (navStudents) navStudents.textContent = meta.total_students.toLocaleString();
    if (navTeachers) navTeachers.textContent = meta.total_teachers_found;

    /* ── Last updated ─────────────────────────────── */

    const updatedEl = document.getElementById('last-updated');
    if (updatedEl && meta.last_updated) {
        const d = new Date(meta.last_updated);
        updatedEl.textContent = 'UPDATED · ' + d.toLocaleDateString('en-US', {
            month: 'short', year: 'numeric'
        }).toUpperCase();
    }

    /* ── Stat cards ───────────────────────────────── */

    const withPhone = meta.students_with_phone || 0;
    const phonePct = meta.total_students
    ? ((withPhone / meta.total_students) * 100).toFixed(1)
    : '0';
    const active = meta.total_students - (meta.zero_gems_count || 0);

    const stats = [
        { val: meta.total_students, label: 'Students' },
        { val: meta.schools ? meta.schools.length : 0, label: 'Schools' },
        { val: meta.total_teachers_found || 0, label: 'Teachers found' },
        { val: meta.total_teachers_cracked || 0, label: 'Cracked' },
        { val: active, label: 'Active users' },
        { val: meta.zero_gems_count || 0, label: 'Inactive' },
    ];

    const statRow = document.getElementById('stat-row');
    statRow.innerHTML = stats.map((s, i) => `
    <div class="stat-card reveal" style="--d:${i}">
    <div class="stat-val counter" data-target="${s.val}">0</div>
    <div class="stat-label">${esc(s.label)}</div>
    </div>
    `).join('');

    /* Re-init reveals and counters for dynamically added elements */
    initReveal();
    initCounters();

    /* ── Class distribution chart ─────────────────── */

    const chartEl = document.getElementById('class-chart');
    if (meta.class_counts && chartEl) {
        const entries = Object.entries(meta.class_counts);
        const maxVal = Math.max(...entries.map(e => e[1]));

        chartEl.innerHTML = entries.map(([cls, count]) => {
            const pct = (count / maxVal) * 100;
            return `
            <div class="bar-row">
            <span class="bar-label">Class ${esc(cls)}</span>
            <div class="bar-track">
            <div class="bar-fill" style="width: ${pct}%"></div>
            </div>
            <span class="bar-value">${count.toLocaleString()}</span>
            </div>
            `;
        }).join('');
    }

    /* ── Platform metrics ─────────────────────────── */

    const metricsEl = document.getElementById('metrics');
    if (metricsEl) {
        const metrics = [
            { label: 'Average gems', val: meta.gems_avg || 0 },
            { label: 'Average coins', val: meta.coins_avg || 0 },
            { label: 'Max gems', val: meta.gems_max || 0 },
            { label: 'Total gems', val: meta.gems_total || 0 },
            { label: 'With phone number', val: withPhone },
            { label: 'With email', val: meta.students_with_email || 0 },
            { label: 'With DOB set', val: meta.students_with_dob || 0 },
            { label: 'Default password %', val: phonePct + '%', cls: '' },
        ];

        metricsEl.innerHTML = metrics.map(m => `
        <div class="metric-row">
        <span class="metric-label">${esc(m.label)}</span>
        <span class="metric-val ${m.cls || ''}">${
            typeof m.val === 'number' ? m.val.toLocaleString() : m.val
        }</span>
        </div>
        `).join('');
    }

    /* ── Sections grid ────────────────────────────── */

    const sectionsEl = document.getElementById('sections-grid');
    if (meta.section_counts && sectionsEl) {
        const sorted = Object.entries(meta.section_counts)
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));

        sectionsEl.innerHTML = sorted.map(([sec, count]) => `
        <div class="badge" data-hover>
        ${esc(sec)}
        <span class="badge-count">${count}</span>
        </div>
        `).join('');
    }

    /* ── Leaderboard ──────────────────────────────── */

    const lbEl = document.getElementById('leaderboard');
    if (students && lbEl) {
        const top = sortBy(students, 'gems', true).slice(0, 15);

        lbEl.innerHTML = `
        <table>
        <thead>
        <tr>
        <th>#</th>
        <th>Name</th>
        <th>Class</th>
        <th style="text-align:right">Gems</th>
        </tr>
        </thead>
        <tbody>
        ${top.map((s, i) => `
            <tr>
            <td><span class="rank rank-${i < 3 ? i + 1 : ''}">${i + 1}</span></td>
            <td><span class="name-primary">${esc(s.first_name)} ${esc(s.last_name)}</span></td>
            <td><span class="mono">${esc((s.section_name || '').replace('Class ', ''))}</span></td>
            <td class="text-r"><span class="gems-val">${(s.gems || 0).toLocaleString()}</span></td>
            </tr>
            `).join('')}
            </tbody>
            </table>
            `;
    }

    /* ── Schools table ────────────────────────────── */

    const schoolsEl = document.getElementById('schools-table');
    if (meta.schools && schoolsEl) {
        schoolsEl.innerHTML = `
        <table>
        <thead>
        <tr>
        <th>School</th>
        <th>Prefix</th>
        <th style="text-align:right">Students</th>
        </tr>
        </thead>
        <tbody>
        ${meta.schools.map(s => `
            <tr>
            <td><span class="name-primary">${esc(s.name)}</span></td>
            <td><span class="mono">${esc(s.code)}</span></td>
            <td class="text-r">${s.count.toLocaleString()}</td>
            </tr>
            `).join('')}
            </tbody>
            </table>
            `;
    }
});
