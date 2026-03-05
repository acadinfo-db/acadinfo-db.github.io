/**
 * students.js — Student directory with filtering, sorting, pagination.
 * Respects active school via SCHOOL state.
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


    /* ── Filter options (rebuild on school switch) ── */

    function buildFilterOptions() {
        const students = SCHOOL.students();
        updateSidebarCounts();

        // Classes
        const classSelect = document.getElementById('filter-class');
        const classes = [...new Set(students.map(s => s.class_num).filter(v => v != null))].sort((a, b) => a - b);
        classSelect.innerHTML = '<option value="">All classes</option>' +
        classes.map(c => `<option value="${c}">Class ${c}</option>`).join('');

        // Sections
        const sectionSelect = document.getElementById('filter-section');
        const sections = [...new Set(students.map(s => (s.section_name || '').replace('Class ', '')).filter(v => v))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        sectionSelect.innerHTML = '<option value="">All sections</option>' +
        sections.map(s => `<option value="${s}">${s}</option>`).join('');

        // Genders
        const genderSelect = document.getElementById('filter-gender');
        const genders = [...new Set(students.map(s => s.gender).filter(v => v))].sort();
        genderSelect.innerHTML = '<option value="">All genders</option>' +
        genders.map(g => `<option value="${g}">${formatGender(g)}</option>`).join('');
    }


    /* ── Bind all events ──────────────────────────── */

    function bindEvents() {
        const searchEl = document.getElementById('search');
        searchEl.addEventListener('input', debounce(e => {
            state.query = e.target.value;
            state.page = 1;
            applyAndRender();
        }, 200));

        document.getElementById('filter-class').addEventListener('change', e => {
            state.classFilter = e.target.value;
            state.page = 1;
            applyAndRender();
        });

        document.getElementById('filter-section').addEventListener('change', e => {
            state.sectionFilter = e.target.value;
            state.page = 1;
            applyAndRender();
        });

        document.getElementById('filter-gender').addEventListener('change', e => {
            state.genderFilter = e.target.value;
            state.page = 1;
            applyAndRender();
        });

        document.getElementById('export-btn').addEventListener('click', () => {
            const data = state.filtered.length ? state.filtered : SCHOOL.students();
            exportCSV(data, `acadally-students-${SCHOOL.active}.csv`);
        });
    }


    /* ── Reset filters ────────────────────────────── */

    function resetFilters() {
        state.query = '';
        state.classFilter = '';
        state.sectionFilter = '';
        state.genderFilter = '';
        state.page = 1;

        const searchEl = document.getElementById('search');
        if (searchEl) searchEl.value = '';

        document.getElementById('filter-class').value = '';
        document.getElementById('filter-section').value = '';
        document.getElementById('filter-gender').value = '';
    }


    /* ── Apply filters + sort + render ────────────── */

    function applyAndRender() {
        let list = SCHOOL.students();

        // Filter
        if (state.query) {
            list = list.filter(s => searchStudent(s, state.query));
        }
        if (state.classFilter) {
            list = list.filter(s => String(s.class_num) === state.classFilter);
        }
        if (state.sectionFilter) {
            const sec = 'Class ' + state.sectionFilter;
            list = list.filter(s => s.section_name === sec);
        }
        if (state.genderFilter) {
            list = list.filter(s => s.gender === state.genderFilter);
        }

        // Sort
        list = sortBy(list, state.sortKey, state.sortDesc);

        state.filtered = list;

        renderTable();
        renderPagination();
        renderResultsInfo();
    }


    /* ── Render table ─────────────────────────────── */

    function renderTable() {
        const el = document.getElementById('students-table');
        const total = state.filtered.length;

        if (total === 0) {
            el.innerHTML = `
            <div class="empty-state">
            <div class="empty-state-icon">∅</div>
            <h3>No students found</h3>
            <p>Try adjusting your filters or search query</p>
            </div>
            `;
            return;
        }

        const start = (state.page - 1) * PAGE_SIZE;
        const page = state.filtered.slice(start, start + PAGE_SIZE);

        const columns = [
            { key: 'display_name', label: 'Name', sortable: true },
 { key: 'username', label: 'Username', sortable: true },
 { key: 'section_name', label: 'Section', sortable: true },
 { key: 'gender', label: 'Gender', sortable: true },
 { key: 'phone_number', label: 'Phone', sortable: false },
 { key: 'email', label: 'Email', sortable: false },
 { key: 'gems', label: 'Gems', sortable: true, align: 'right' },
        ];

        const sortClass = (key) => {
            if (state.sortKey !== key) return '';
            return state.sortDesc ? 'sort-desc' : 'sort-asc';
        };

        el.innerHTML = `
        <table>
        <thead>
        <tr>
        <th style="width:36px">#</th>
        ${columns.map(c => `
            <th class="${c.sortable ? 'sortable ' + sortClass(c.key) : ''}"
            ${c.sortable ? `data-sort="${c.key}"` : ''}
            ${c.align ? `style="text-align:${c.align}"` : ''}>
            ${c.label}
            </th>
            `).join('')}
            </tr>
            </thead>
            <tbody>
            ${page.map((s, i) => {
                const idx = start + i + 1;
                const phone = s.phone_number
                ? `<span class="mono">${esc(s.phone_number)}</span>`
                : `<span class="detail-tag no-data">—</span>`;
                const email = s.email
                ? `<span class="mono" style="font-size:0.6875rem">${esc(s.email)}</span>`
                : `<span class="detail-tag no-data">—</span>`;
                const section = (s.section_name || '').replace('Class ', '');

                return `
                <tr class="fade-enter" style="animation-delay:${Math.min(i, 15) * 20}ms">
                <td><span class="mono" style="color:var(--text-4)">${idx}</span></td>
                <td><span class="name-primary">${displayName(s)}</span></td>
                <td><span class="student-username">${esc(s.username)}</span></td>
                <td><span class="student-section">${esc(section)}</span></td>
                <td><span style="font-size:0.75rem;color:var(--text-3)">${formatGender(s.gender)}</span></td>
                <td>${phone}</td>
                <td>${email}</td>
                <td class="text-r"><span class="gems-val">${(s.gems || 0).toLocaleString()}</span></td>
                </tr>
                `;
            }).join('')}
            </tbody>
            </table>
            `;

            // Bind sort clicks
            el.querySelectorAll('th.sortable').forEach(th => {
                th.addEventListener('click', () => {
                    const key = th.dataset.sort;
                    if (state.sortKey === key) {
                        state.sortDesc = !state.sortDesc;
                    } else {
                        state.sortKey = key;
                        state.sortDesc = key === 'gems'; // default desc for numeric
                    }
                    applyAndRender();
                });
            });
    }


    /* ── Results info ─────────────────────────────── */

    function renderResultsInfo() {
        const el = document.getElementById('results-info');
        const total = state.filtered.length;
        const schoolTotal = SCHOOL.students().length;

        if (total === schoolTotal) {
            el.innerHTML = `
            <span>Showing all</span>
            <span class="results-count">${total.toLocaleString()}</span>
            <span>students</span>
            `;
        } else {
            el.innerHTML = `
            <span class="results-count">${total.toLocaleString()}</span>
            <span>of ${schoolTotal.toLocaleString()} students</span>
            `;
        }
    }


    /* ── Pagination ───────────────────────────────── */

    function renderPagination() {
        const el = document.getElementById('pagination');
        const total = state.filtered.length;
        const totalPages = Math.ceil(total / PAGE_SIZE);

        if (totalPages <= 1) {
            el.innerHTML = `
            <span class="pagination-info">${total.toLocaleString()} records</span>
            <div></div>
            `;
            return;
        }

        const start = (state.page - 1) * PAGE_SIZE + 1;
        const end = Math.min(state.page * PAGE_SIZE, total);

        // Generate page buttons with ellipsis
        let pages = [];
        const maxVisible = 7;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (state.page > 3) pages.push('…');

            const rangeStart = Math.max(2, state.page - 1);
            const rangeEnd = Math.min(totalPages - 1, state.page + 1);
            for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);

            if (state.page < totalPages - 2) pages.push('…');
            pages.push(totalPages);
        }

        el.innerHTML = `
        <span class="pagination-info">${start}–${end} of ${total.toLocaleString()}</span>
        <div class="pagination-controls">
        <button class="pagination-btn" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''}>←</button>
        ${pages.map(p => {
            if (p === '…') return `<span class="pagination-ellipsis">…</span>`;
            return `<button class="pagination-btn ${p === state.page ? 'active' : ''}" data-page="${p}">${p}</button>`;
        }).join('')}
        <button class="pagination-btn" data-page="${state.page + 1}" ${state.page === totalPages ? 'disabled' : ''}>→</button>
        </div>
        `;

        el.querySelectorAll('.pagination-btn[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const p = parseInt(btn.dataset.page, 10);
                if (p >= 1 && p <= totalPages && p !== state.page) {
                    state.page = p;
                    renderTable();
                    renderPagination();
                    // Scroll to top of table
                    document.getElementById('students-table').scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

})();
