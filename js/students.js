/**
 * students.js — Student directory with score/coins/gems.
 * acad_INFO v4.3
 */

(function () {

    const PAGE_SIZE = 50;

    let state = {
        query: '',
        classFilter: '',
        sectionFilter: '',
        genderFilter: '',
        sortKey: 'display_name',
        sortDesc: false,
        page: 1,
        filtered: [],
    };

    document.addEventListener('DOMContentLoaded', async () => {
        initPage();
        await loadData();
        if (!DATA.students) return;

        renderSwitcher('school-switcher', () => {
            resetFilters();
            buildFilterOptions();
            applyAndRender();
        });

        bindEvents();
        buildFilterOptions();
        applyAndRender();
    });


    function buildFilterOptions() {
        const students = SCHOOL.students();
        updateSidebarCounts();

        // Classes: just class numbers (6, 7, 8, ...)
        const classSelect = document.getElementById('filter-class');
        const classes = [...new Set(students.map(s => s.class_num).filter(v => v != null))].sort((a, b) => a - b);
        classSelect.innerHTML = '<option value="">All classes</option>' +
        classes.map(c => `<option value="${c}">Class ${c}</option>`).join('');

        // Sections: just section letters (A, B, C, ...)
        const sectionSelect = document.getElementById('filter-section');
        const sectionLetters = [...new Set(students.map(s => {
            const sec = (s.section_name || '').replace('Class ', '');
            const match = sec.match(/[A-Z]$/i);
            return match ? match[0].toUpperCase() : null;
        }).filter(v => v))].sort();
        sectionSelect.innerHTML = '<option value="">All sections</option>' +
        sectionLetters.map(s => `<option value="${s}">${s}</option>`).join('');

        const genderSelect = document.getElementById('filter-gender');
        const genders = [...new Set(students.map(s => s.gender).filter(v => v))].sort();
        genderSelect.innerHTML = '<option value="">All genders</option>' +
        genders.map(g => `<option value="${g}">${formatGender(g)}</option>`).join('');
    }


    function bindEvents() {
        document.getElementById('search').addEventListener('input', debounce(e => {
            state.query = e.target.value;
            state.page = 1;
            applyAndRender();
        }, 200));

        document.getElementById('filter-class').addEventListener('change', e => {
            state.classFilter = e.target.value; state.page = 1; applyAndRender();
        });
        document.getElementById('filter-section').addEventListener('change', e => {
            state.sectionFilter = e.target.value; state.page = 1; applyAndRender();
        });
        document.getElementById('filter-gender').addEventListener('change', e => {
            state.genderFilter = e.target.value; state.page = 1; applyAndRender();
        });
        document.getElementById('export-btn').addEventListener('click', () => {
            showPinModal(() => {
                const data = state.filtered.length ? state.filtered : SCHOOL.students();
                exportCSV(data, `acad_INFO-students-${SCHOOL.active}.csv`);
            });
        });
    }


    function resetFilters() {
        state = { ...state, query: '', classFilter: '', sectionFilter: '', genderFilter: '', page: 1 };
        const s = document.getElementById('search'); if (s) s.value = '';
        document.getElementById('filter-class').value = '';
        document.getElementById('filter-section').value = '';
        document.getElementById('filter-gender').value = '';
    }


    function applyAndRender() {
        let list = SCHOOL.students();

        if (state.query) list = list.filter(s => searchStudent(s, state.query));
        if (state.classFilter) list = list.filter(s => String(s.class_num) === state.classFilter);
        if (state.sectionFilter) list = list.filter(s => {
            const sec = (s.section_name || '').replace('Class ', '');
            const letter = sec.match(/[A-Z]$/i);
            return letter && letter[0].toUpperCase() === state.sectionFilter;
        });
        if (state.genderFilter) list = list.filter(s => s.gender === state.genderFilter);

        // For score sorting, we need to compute it
        if (state.sortKey === '_score') {
            list = list.map(s => ({ ...s, _score: activityScore(s) }));
        }

        list = sortBy(list, state.sortKey, state.sortDesc);
        state.filtered = list;

        renderTable();
        renderPagination();
        renderResultsInfo();
    }


    function renderGenderCell(gender) {
        const g = gender || 'not_set';
        if (g === 'not_set' || g === 'prefer_not_to_say') {
            return '<span class="detail-tag no-data">—</span>';
        }
        return `<span style="font-size:0.75rem;color:var(--text-3)">${formatGender(g)}</span>`;
    }


    function renderTable() {
        const el = document.getElementById('students-table');
        const total = state.filtered.length;

        if (total === 0) {
            el.innerHTML = `
            <div class="empty-state">
            <div class="empty-state-icon">∅</div>
            <h3>No students found</h3>
            <p>Try adjusting your filters or search query</p>
            </div>`;
            return;
        }

        const start = (state.page - 1) * PAGE_SIZE;
        const page = state.filtered.slice(start, start + PAGE_SIZE);

        const sortClass = (key) => {
            if (state.sortKey !== key) return '';
            return state.sortDesc ? 'sort-desc' : 'sort-asc';
        };

        el.innerHTML = `
        <table>
        <thead><tr>
        <th style="width:36px">#</th>
        <th class="sortable ${sortClass('display_name')}" data-sort="display_name">Name</th>
        <th class="sortable ${sortClass('username')}" data-sort="username">Username</th>
        <th class="sortable ${sortClass('section_name')}" data-sort="section_name">Section</th>
        <th>Gender</th>
        <th>Phone</th>
        <th>Email</th>
        <th class="sortable ${sortClass('_score')}" data-sort="_score" style="text-align:right">Score</th>
        <th class="sortable ${sortClass('coins')}" data-sort="coins" style="text-align:right">Coins</th>
        <th class="sortable ${sortClass('gems')}" data-sort="gems" style="text-align:right">Gems</th>
        </tr></thead>
        <tbody>
        ${page.map((s, i) => {
            const idx = start + i + 1;
            const score = s._score != null ? s._score : activityScore(s);
            const section = (s.section_name || '').replace('Class ', '');
            
            // Special Censoring logic
            const isProtected = isProtectedUser(s);
            const revealed = isAuthed();
            
            let phoneHtml, emailHtml;
            const phoneVal = s.phone_number;
            const emailVal = s.email;

            if (isProtected && !revealed) {
                // Censored state for Anirudh
                const triggerClass = 'reveal-trigger-cell';
                phoneHtml = phoneVal 
                    ? `<span class="mono censored-val ${triggerClass}" style="cursor:pointer;" title="Click to reveal">${censorPhone(phoneVal)}</span>`
                    : '<span class="detail-tag no-data">—</span>';
                emailHtml = emailVal
                    ? `<span class="mono censored-val ${triggerClass}" style="font-size:0.6875rem;cursor:pointer;" title="Click to reveal">${censorEmail(emailVal)}</span>`
                    : '<span class="detail-tag no-data">—</span>';
            } else {
                // Normal or Revealed state
                phoneHtml = phoneVal
                    ? `<span class="mono" style="cursor:pointer;" data-copy="${esc(phoneVal)}" title="Click to copy">${esc(phoneVal)}</span>`
                    : '<span class="detail-tag no-data">—</span>';
                emailHtml = emailVal
                    ? `<span class="mono" style="font-size:0.6875rem;cursor:pointer;" data-copy="${esc(emailVal)}" title="Click to copy">${esc(emailVal)}</span>`
                    : '<span class="detail-tag no-data">—</span>';
            }

            return `
            <tr class="fade-enter" style="animation-delay:${Math.min(i, 15) * 20}ms">
            <td><span class="mono" style="color:var(--text-4)">${idx}</span></td>
            <td><span class="name-primary" style="cursor:pointer;" data-copy="${esc(displayName(s))}" title="Click to copy">${displayName(s)}</span></td>
            <td><span class="student-username" style="cursor:pointer;" data-copy="${esc(s.username)}" title="Click to copy">${esc(s.username)}</span></td>
            <td><span class="student-section">${esc(section)}</span></td>
            <td>${renderGenderCell(s.gender)}</td>
            <td>${phoneHtml}</td>
            <td>${emailHtml}</td>
            <td class="text-r"><span class="score-val">${score.toLocaleString()}</span></td>
            <td class="text-r"><span class="coins-val">${(s.coins || 0).toLocaleString()}</span></td>
            <td class="text-r"><span class="gems-val">${(s.gems || 0).toLocaleString()}</span></td>
            </tr>`;
        }).join('')}
        </tbody>
        </table>`;

        el.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.sort;
                if (state.sortKey === key) {
                    state.sortDesc = !state.sortDesc;
                } else {
                    state.sortKey = key;
                    state.sortDesc = ['gems', 'coins', '_score'].includes(key);
                }
                applyAndRender();
            });
        });

        // Attach reveal modal to censored cells
        el.querySelectorAll('.reveal-trigger-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                showPinModal(() => applyAndRender());
            });
        });

        // Easter egg: crown emoji for protected user when searched by name
        if (state.query && state.query.toLowerCase().includes('anirudh')) {
            page.forEach((s, i) => {
                if (isProtectedUser && isProtectedUser(s)) {
                    const row = el.querySelectorAll('tbody tr')[i];
                    if (row) {
                        row.style.borderLeft = '3px solid';
                        row.style.borderImage = 'linear-gradient(180deg, #7C3AED, #34D399, #F59E0B, #EF4444) 1';
                        const nameCell = row.querySelector('.name-primary');
                        if (nameCell) {
                            const original = nameCell.textContent;
                            nameCell.textContent = '👑 ' + original;
                            setTimeout(() => { nameCell.textContent = original; }, 3000);
                        }
                        setTimeout(() => {
                            row.style.borderLeft = '';
                            row.style.borderImage = '';
                        }, 3000);
                    }
                }
            });
        }
    }


    function renderResultsInfo() {
        const el = document.getElementById('results-info');
        const total = state.filtered.length;
        const schoolTotal = SCHOOL.students().length;
        el.innerHTML = total === schoolTotal
        ? `<span>Showing all</span><span class="results-count">${total.toLocaleString()}</span><span>students</span>`
        : `<span class="results-count">${total.toLocaleString()}</span><span>of ${schoolTotal.toLocaleString()} students</span>`;
    }


    function renderPagination() {
        const el = document.getElementById('pagination');
        const total = state.filtered.length;
        const totalPages = Math.ceil(total / PAGE_SIZE);

        if (totalPages <= 1) {
            el.innerHTML = `<span class="pagination-info">${total.toLocaleString()} records</span><div></div>`;
            return;
        }

        const start = (state.page - 1) * PAGE_SIZE + 1;
        const end = Math.min(state.page * PAGE_SIZE, total);
        let pages = [];

        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (state.page > 3) pages.push('…');
            for (let i = Math.max(2, state.page - 1); i <= Math.min(totalPages - 1, state.page + 1); i++) pages.push(i);
            if (state.page < totalPages - 2) pages.push('…');
            pages.push(totalPages);
        }

        el.innerHTML = `
        <span class="pagination-info">${start}–${end} of ${total.toLocaleString()}</span>
        <div class="pagination-controls">
        <button class="pagination-btn" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>←</button>
        ${pages.map(p => p === '…'
            ? '<span class="pagination-ellipsis">…</span>'
            : `<button class="pagination-btn ${p === state.page ? 'active' : ''}" data-page="${p}">${p}</button>`
        ).join('')}
        <button class="pagination-btn" data-page="${state.page + 1}" ${state.page === totalPages ? 'disabled' : ''}>→</button>
        </div>`;

        el.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = parseInt(btn.dataset.page, 10);
                if (p >= 1 && p <= totalPages && p !== state.page) {
                    state.page = p;
                    renderTable();
                    renderPagination();
                    document.getElementById('students-table').scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

})();
