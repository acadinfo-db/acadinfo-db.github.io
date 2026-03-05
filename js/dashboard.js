/**
 * dashboard.js — Render dashboard with school switching.
 */

document.addEventListener('DOMContentLoaded', async () => {
    initPage();

    await loadData();
    if (!DATA.meta) return;

    /* ── Switcher ─────────────────────────────────── */
    renderSwitcher('school-switcher', () => renderAll());

    /* ── Render everything ────────────────────────── */
    renderAll();
});


function renderAll() {
    const stats = SCHOOL.stats();
    const students = SCHOOL.students();
    const info = SCHOOL.info();

    updateSidebarCounts();

    /* ── Last updated ─────────────────────────────── */
    const updatedEl = document.getElementById('last-updated');
    if (updatedEl && DATA.meta.last_updated) {
        const d = new Date(DATA.meta.last_updated);
        updatedEl.textContent = 'UPDATED · ' + d.toLocaleDateString('en-US', {
            month: 'short', year: 'numeric'
        }).toUpperCase();
    }

    /* ── Stat cards ───────────────────────────────── */
    const withPhone = stats.students_with_phone || 0;
    const active = (stats.total_students || 0) - (stats.zero_gems_count || 0);

    const statData = [
        { val: stats.total_students || 0, label: 'Students' },
        { val: stats.total_teachers_found || 0, label: 'Teachers found' },
        { val: stats.total_teachers_cracked || 0, label: 'Cracked' },
        { val: active, label: 'Active users' },
        { val: stats.zero_gems_count || 0, label: 'Inactive' },
        { val: withPhone, label: 'With phone' },
    ];

    const statRow = document.getElementById('stat-row');
    if (statRow) {
        statRow.innerHTML = statData.map((s, i) => `
        <div class="stat-card fade-enter" style="animation-delay:${i * 50}ms">
        <div class="stat-val counter" data-target="${s.val}">0</div>
        <div class="stat-label">${esc(s.label)}</div>
        </div>
        `).join('');
        initCounters();
    }

    /* ── Class distribution chart ─────────────────── */
    const chartEl = document.getElementById('class-chart');
    if (stats.class_counts && chartEl) {
        const entries = Object.entries(stats.class_counts);
        const maxVal = Math.max(...entries.map(e => e[1]), 1);

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
            { label: 'Average gems', val: stats.gems_avg || 0 },
            { label: 'Average coins', val: stats.coins_avg || 0 },
            { label: 'Max gems', val: stats.gems_max || 0 },
            { label: 'Total gems', val: stats.gems_total || 0 },
            { label: 'With phone number', val: stats.students_with_phone || 0 },
            { label: 'With email', val: stats.students_with_email || 0 },
        ];

        metricsEl.innerHTML = metrics.map(m => `
        <div class="metric-row">
        <span class="metric-label">${esc(m.label)}</span>
        <span class="metric-val">${
            typeof m.val === 'number' ? m.val.toLocaleString() : m.val
        }</span>
        </div>
        `).join('');
    }

    /* ── Sections grid ────────────────────────────── */
    const sectionsEl = document.getElementById('sections-grid');
    if (stats.section_counts && sectionsEl) {
        const sorted = Object.entries(stats.section_counts)
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
            <tr class="fade-enter" style="animation-delay:${i * 30}ms">
            <td><span class="rank rank-${i < 3 ? i + 1 : ''}">${i + 1}</span></td>
            <td><span class="name-primary">${displayName(s)}</span></td>
            <td><span class="mono">${esc((s.section_name || '').replace('Class ', ''))}</span></td>
            <td class="text-r"><span class="gems-val">${(s.gems || 0).toLocaleString()}</span></td>
            </tr>
            `).join('')}
            </tbody>
            </table>
            `;
    }
}
