/**
 * dashboard.js — Overview with combined score leaderboard + total coins.
 * acad_INFO v4.3
 */

document.addEventListener('DOMContentLoaded', async () => {
    initPage();
    await loadData();
    if (!DATA.meta) return;

    renderSwitcher('school-switcher', () => renderAll());
    renderAll();
});


function renderAll() {
    const students = SCHOOL.students();
    const teachers = SCHOOL.teachers();
    const stats = SCHOOL.stats();

    updateSidebarCounts();

    const updatedEl = document.getElementById('last-updated');
    if (updatedEl && DATA.meta.last_updated) {
        const d = new Date(DATA.meta.last_updated);
        const dateStr = d.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        }).toUpperCase();
        const timeStr = d.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: false
        });

        // Relative time for tooltip
        const diffMs = Date.now() - d.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffHrs / 24);
        let relative;
        if (diffMins < 1) relative = 'just now';
        else if (diffMins < 60) relative = `${diffMins}m ago`;
        else if (diffHrs < 24) relative = `${diffHrs}h ago`;
        else relative = `${diffDays}d ago`;

        updatedEl.textContent = `UPDATED · ${dateStr} · ${timeStr}`;
        updatedEl.title = relative;
    }

    /* ── Stats (computed live) ─────────────────────── */
    const active = students.filter(s => (s.gems || 0) > 0 || (s.coins || 0) > 0).length;
    const inactive = students.length - active;
    const withPhone = students.filter(s => s.phone_number).length;

    const statData = [
        { val: students.length, label: 'Students' },
        { val: teachers.length, label: 'Teachers found' },
        { val: teachers.filter(t => t.password_found).length, label: 'Cracked' },
        { val: active, label: 'Active users' },
        { val: inactive, label: 'Inactive' },
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

    /* ── Class distribution ────────────────────────── */
    const chartEl = document.getElementById('class-chart');
    if (chartEl) {
        const cc = stats.class_counts || {};
        const entries = Object.entries(cc);
        if (entries.length) {
            const maxVal = Math.max(...entries.map(e => e[1]), 1);
            chartEl.innerHTML = entries.map(([cls, count]) => {
                const pct = (count / maxVal) * 100;
                return `
                <div class="bar-row">
                <span class="bar-label">Class ${esc(cls)}</span>
                <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
                <span class="bar-value">${count.toLocaleString()}</span>
                </div>
                `;
            }).join('');
        } else {
            chartEl.innerHTML = '<span style="color:var(--text-4);font-size:0.8125rem">No data</span>';
        }
    }

    /* ── Platform metrics (now with Total Coins) ──── */
    const metricsEl = document.getElementById('metrics');
    if (metricsEl) {
        const metrics = [
            { label: 'Total gems', val: stats.gems_total || 0 },
            { label: 'Total coins', val: stats.coins_total || 0 },
            { label: 'Average gems', val: stats.gems_avg || 0 },
            { label: 'Average coins', val: stats.coins_avg || 0 },
            { label: 'Max gems', val: stats.gems_max || 0 },
            { label: 'With phone', val: withPhone },
            { label: 'With email', val: stats.students_with_email || 0 },
        ];

        metricsEl.innerHTML = metrics.map(m => `
        <div class="metric-row">
        <span class="metric-label">${esc(m.label)}</span>
        <span class="metric-val">${typeof m.val === 'number' ? m.val.toLocaleString() : m.val}</span>
        </div>
        `).join('');
    }

    /* ── Leaderboard (combined score) ─────────────── */
    const lbEl = document.getElementById('leaderboard');
    if (students.length && lbEl) {
        const scored = students.map(s => ({ ...s, _score: activityScore(s) }));
        const top = scored.sort((a, b) => b._score - a._score).slice(0, 15);

        lbEl.innerHTML = `
        <table>
        <thead><tr>
        <th>#</th><th>Name</th><th>Class</th>
        <th style="text-align:right">Score</th>
        <th style="text-align:right">Coins</th>
        <th style="text-align:right">Gems</th>
        </tr></thead>
        <tbody>
        ${top.map((s, i) => `
            <tr class="fade-enter" style="animation-delay:${i * 30}ms">
            <td><span class="rank rank-${i < 3 ? i + 1 : ''}">${i + 1}</span></td>
            <td><span class="name-primary" style="cursor:pointer;" data-copy="${esc(displayName(s))}" title="Click to copy">${displayName(s)}</span></td>
            <td><span class="mono">${esc((s.section_name || '').replace('Class ', ''))}</span></td>
            <td class="text-r"><span class="score-val">${s._score.toLocaleString()}</span></td>
            <td class="text-r"><span class="coins-val">${(s.coins || 0).toLocaleString()}</span></td>
            <td class="text-r"><span class="gems-val">${(s.gems || 0).toLocaleString()}</span></td>
            </tr>
            `).join('')}
            </tbody>
            </table>
            `;
    } else if (lbEl) {
        lbEl.innerHTML = '<span style="color:var(--text-4)">No data</span>';
    }

    /* ── Sections ─────────────────────────────────── */
    const sectionsEl = document.getElementById('sections-grid');
    if (sectionsEl) {
        const sc = stats.section_counts || {};
        const sorted = Object.entries(sc)
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
        sectionsEl.innerHTML = sorted.length
        ? sorted.map(([sec, count]) =>
        `<div class="badge" data-hover>${esc(sec)} <span class="badge-count">${count}</span></div>`
        ).join('')
        : '<span style="color:var(--text-4)">No sections</span>';
    }
}
