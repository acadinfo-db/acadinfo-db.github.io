/**
 * classes.js — Class and section breakdown with coins.
 * acad_INFO v4.3
 */

document.addEventListener('DOMContentLoaded', async () => {
    initPage();
    await loadData();
    if (!DATA.students) return;

    renderSwitcher('school-switcher', () => renderAll());
    renderAll();
});


function renderAll() {
    const students = SCHOOL.students();
    const stats = SCHOOL.stats();
    updateSidebarCounts();

    const classCounts = stats.class_counts || {};
    const sectionCounts = stats.section_counts || {};
    const numClasses = Object.keys(classCounts).length;
    const numSections = Object.keys(sectionCounts).length;
    const avgPerSection = numSections ? Math.round(students.length / numSections) : 0;

    const statData = [
        { val: students.length, label: 'Total students' },
        { val: numClasses, label: 'Classes' },
        { val: numSections, label: 'Sections' },
        { val: avgPerSection, label: 'Avg per section' },
    ];

    const statsEl = document.getElementById('class-stats');
    if (statsEl) {
        statsEl.innerHTML = statData.map((s, i) => `
        <div class="stat-card fade-enter" style="animation-delay:${i * 50}ms">
        <div class="stat-val counter" data-target="${s.val}">0</div>
        <div class="stat-label">${esc(s.label)}</div>
        </div>
        `).join('');
        initCounters();
    }

    const chartEl = document.getElementById('class-chart');
    if (chartEl && Object.keys(classCounts).length) {
        const entries = Object.entries(classCounts);
        const maxVal = Math.max(...entries.map(e => e[1]), 1);
        chartEl.innerHTML = entries.map(([cls, count]) => {
            const pct = (count / maxVal) * 100;
            return `
            <div class="bar-row">
            <span class="bar-label">Class ${esc(cls)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
            <span class="bar-value">${count.toLocaleString()}</span>
            </div>`;
        }).join('');
    }

    const infoEl = document.getElementById('sections-info');
    if (infoEl) {
        infoEl.innerHTML = `<span class="results-count">${numSections}</span><span>sections across ${numClasses} classes</span>`;
    }

    const container = document.getElementById('sections-container');
    if (!container) return;

    const bySection = {};
    students.forEach(s => {
        const sec = (s.section_name || '').replace('Class ', '');
        if (!sec) return;
        if (!bySection[sec]) bySection[sec] = [];
        bySection[sec].push(s);
    });

    const sortedSections = Object.entries(bySection)
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));

    container.innerHTML = `
    <div class="grid-3">
    ${sortedSections.map(([sec, list], i) => {
        const gems = list.map(s => s.gems || 0);
        const coins = list.map(s => s.coins || 0);
        const scores = list.map(s => activityScore(s));
        const avgGems = Math.round(gems.reduce((a, b) => a + b, 0) / gems.length);
        const avgCoins = Math.round(coins.reduce((a, b) => a + b, 0) / coins.length);
        const totalCoins = coins.reduce((a, b) => a + b, 0);
        const totalGems = gems.reduce((a, b) => a + b, 0);
        const maxGems = Math.max(...gems);
        const netScore = scores.reduce((a, b) => a + b, 0);
        const withPhone = list.filter(s => s.phone_number).length;
        const genderM = list.filter(s => s.gender === 'male').length;
        const genderF = list.filter(s => s.gender === 'female').length;
        const zeroActivity = list.filter(s => activityScore(s) === 0).length;
        const sortedGems = [...gems].sort((a, b) => a - b);
        const medianGems = sortedGems.length % 2 === 0
            ? Math.round((sortedGems[sortedGems.length / 2 - 1] + sortedGems[sortedGems.length / 2]) / 2)
            : sortedGems[Math.floor(sortedGems.length / 2)];

        const top = [...list].sort((a, b) => activityScore(b) - activityScore(a))[0];
        const cardId = `extra-${sec.replace(/\s+/g, '-')}`;

        return `
        <div class="class-section-card fade-enter" style="animation-delay:${Math.min(i, 20) * 30}ms">
        <div class="class-section-header">
        <span class="class-section-name">${esc(sec)}</span>
        <span class="class-section-count">${list.length} students</span>
        </div>
        <div class="class-section-stats">
        <div class="class-mini-stat">
        <span class="class-mini-stat-val">${avgGems.toLocaleString()}</span>
        <span class="class-mini-stat-label">Avg gems</span>
        </div>
        <div class="class-mini-stat">
        <span class="class-mini-stat-val">${totalCoins.toLocaleString()}</span>
        <span class="class-mini-stat-label">Total coins</span>
        </div>
        <div class="class-mini-stat">
        <span class="class-mini-stat-val" style="color:var(--accent)">${netScore.toLocaleString()}</span>
        <span class="class-mini-stat-label">Net score</span>
        </div>
        </div>
        <div class="metric-list" style="margin-top:12px">
        <div class="metric-row">
        <span class="metric-label">M / F</span>
        <span class="metric-val">${genderM}/${genderF}</span>
        </div>
        <div class="metric-row">
        <span class="metric-label">With phone</span>
        <span class="metric-val">${withPhone}</span>
        </div>
        ${top ? `
            <div class="metric-row">
            <span class="metric-label">Top scorer</span>
            <span class="metric-val" style="color:var(--accent)">${displayName(top)}</span>
            </div>` : ''}
            </div>
            <button class="filter-btn" style="margin-top:12px;width:100%;text-align:center;" onclick="document.getElementById('${cardId}').classList.toggle('extra-visible')">
            Extra Info ▾
            </button>
            <div class="extra-info" id="${cardId}" style="max-height:0;overflow:hidden;transition:max-height 0.4s var(--ease);margin-top:0;">
            <div class="metric-list" style="margin-top:12px">
            <div class="metric-row"><span class="metric-label">Total gems</span><span class="metric-val">${totalGems.toLocaleString()}</span></div>
            <div class="metric-row"><span class="metric-label">Avg coins</span><span class="metric-val">${avgCoins.toLocaleString()}</span></div>
            <div class="metric-row"><span class="metric-label">Median gems</span><span class="metric-val">${medianGems.toLocaleString()}</span></div>
            <div class="metric-row"><span class="metric-label">Max gems</span><span class="metric-val">${maxGems.toLocaleString()}</span></div>
            <div class="metric-row"><span class="metric-label">Zero activity</span><span class="metric-val">${zeroActivity}</span></div>
            </div>
            </div>
            </div>`;
    }).join('')}
    </div>`;

    // Toggle extra info
    container.querySelectorAll('.extra-info').forEach(el => {
        const btn = el.previousElementSibling;
        if (btn) {
            btn.addEventListener('click', () => {
                if (el.classList.contains('extra-visible')) {
                    el.style.maxHeight = '0';
                } else {
                    el.style.maxHeight = el.scrollHeight + 'px';
                }
            });
        }
    });
}
