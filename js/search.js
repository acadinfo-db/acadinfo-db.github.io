/**
 * search.js — Full-text search across student records.
 * Card-based results with highlighted matches.
 */

(function () {

    const PAGE_SIZE = 30;

    let state = {
        query: '',
        page: 1,
        results: [],
    };

    document.addEventListener('DOMContentLoaded', async () => {
        initPage();
        await loadData();
        if (!DATA.students) return;

        renderSwitcher('school-switcher', () => {
            updateTotals();
            buildSuggestions();
            if (state.query) executeSearch();
        });

            updateTotals();
            buildSuggestions();
            bindEvents();

            // Check URL params for pre-filled query
            const params = new URLSearchParams(window.location.search);
            const q = params.get('q');
            if (q) {
                document.getElementById('search-input').value = q;
                state.query = q;
                executeSearch();
            }
    });


    function updateTotals() {
        updateSidebarCounts();
        const totalEl = document.getElementById('search-total');
        if (totalEl) totalEl.textContent = SCHOOL.students().length.toLocaleString();
    }


    /* ── Suggestions ──────────────────────────────── */

    function buildSuggestions() {
        const el = document.getElementById('suggestions');
        if (!el) return;

        const students = SCHOOL.students();

        // Pick interesting suggestions
        const suggestions = [];

        // Top sections
        const sectionCounts = {};
        students.forEach(s => {
            const sec = (s.section_name || '').replace('Class ', '');
            if (sec) sectionCounts[sec] = (sectionCounts[sec] || 0) + 1;
        });
            const topSections = Object.entries(sectionCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([s]) => s);
            suggestions.push(...topSections);

            // A few random usernames
            const shuffled = [...students].sort(() => Math.random() - 0.5);
            suggestions.push(shuffled[0]?.username || '');
            suggestions.push(shuffled[1]?.display_name || '');

            // Specific interesting queries
            suggestions.push('male', 'female');

            el.innerHTML = suggestions
            .filter(s => s)
            .slice(0, 6)
            .map(s => `<button class="search-suggestion" data-query="${esc(s)}" data-hover>${esc(s)}</button>`)
            .join('');

            el.querySelectorAll('.search-suggestion').forEach(btn => {
                btn.addEventListener('click', () => {
                    const q = btn.dataset.query;
                    document.getElementById('search-input').value = q;
                    state.query = q;
                    state.page = 1;
                    executeSearch();
                });
            });
    }


    /* ── Events ───────────────────────────────────── */

    function bindEvents() {
        const input = document.getElementById('search-input');

        input.addEventListener('input', debounce(e => {
            state.query = e.target.value.trim();
            state.page = 1;

            if (!state.query) {
                clearResults();
                return;
            }

            executeSearch();
        }, 180));

        input.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                input.value = '';
                state.query = '';
                clearResults();
            }
        });
    }


    /* ── Execute search ───────────────────────────── */

    function executeSearch() {
        const students = SCHOOL.students();
        const q = state.query.toLowerCase();

        // Score results for relevance
        state.results = students
        .map(s => {
            let score = 0;
            const dn = (s.display_name || '').toLowerCase();
            const un = (s.username || '').toLowerCase();
            const fn = (s.first_name || '').toLowerCase();
            const ln = (s.last_name || '').toLowerCase();
            const ph = (s.phone_number || '').toLowerCase();
            const em = (s.email || '').toLowerCase();
            const sec = (s.section_name || '').toLowerCase();
            const gen = (s.gender || '').toLowerCase();

            // Exact matches score highest
            if (un === q) score += 100;
            if (fn === q || ln === q) score += 80;
            if (dn === q) score += 90;

            // Starts-with
            if (un.startsWith(q)) score += 50;
            if (fn.startsWith(q) || ln.startsWith(q)) score += 40;
            if (dn.startsWith(q)) score += 45;

            // Contains
            if (un.includes(q)) score += 20;
            if (dn.includes(q)) score += 20;
            if (fn.includes(q) || ln.includes(q)) score += 15;
            if (ph.includes(q)) score += 25;
            if (em.includes(q)) score += 15;
            if (sec.includes(q)) score += 10;
            if (gen.includes(q)) score += 5;

            return { student: s, score };
        })
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(r => r.student);

        renderResults();
        renderPagination();
        renderResultsInfo();

        // Update URL without reload
        const url = new URL(window.location);
        url.searchParams.set('q', state.query);
        window.history.replaceState({}, '', url);
    }


    /* ── Clear ────────────────────────────────────── */

    function clearResults() {
        document.getElementById('results').innerHTML = '';
        document.getElementById('results-info').style.display = 'none';
        document.getElementById('pagination').style.display = 'none';
        document.getElementById('suggestions').style.display = '';

        const url = new URL(window.location);
        url.searchParams.delete('q');
        window.history.replaceState({}, '', url);
    }


    /* ── Highlight helper ─────────────────────────── */

    function highlight(text, query) {
        if (!text || !query) return esc(text);
        const escaped = esc(text);
        const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(${q})`, 'gi');
        return escaped.replace(re, '<mark>$1</mark>');
    }


    /* ── Render results ───────────────────────────── */

    function renderResults() {
        const el = document.getElementById('results');
        const total = state.results.length;

        document.getElementById('suggestions').style.display = 'none';
        document.getElementById('results-info').style.display = '';

        if (total === 0) {
            el.innerHTML = `
            <div class="empty-state">
            <div class="empty-state-icon">∅</div>
            <h3>No results for "${esc(state.query)}"</h3>
            <p>Try a different name, username, or phone number</p>
            </div>
            `;
            return;
        }

        const start = (state.page - 1) * PAGE_SIZE;
        const page = state.results.slice(start, start + PAGE_SIZE);
        const q = state.query;

        el.innerHTML = `
        <div class="result-cards">
        ${page.map((s, i) => {
            const section = (s.section_name || '').replace('Class ', '');
            const phone = s.phone_number
            ? highlight(s.phone_number, q)
            : '<span class="detail-tag no-data">No phone</span>';
            const email = s.email
            ? `<span style="font-size:0.6875rem">${highlight(s.email, q)}</span>`
            : '';

            return `
            <div class="result-card fade-enter" style="animation-delay:${Math.min(i, 12) * 25}ms">
            <div class="result-main">
            <div class="result-name">${highlight(s.display_name, q)}</div>
            <div class="result-meta">
            <span>${highlight(s.username, q)}</span>
            <span>${esc(section)}</span>
            <span>${formatGender(s.gender)}</span>
            </div>
            <div class="result-meta">
            <span>${phone}</span>
            ${email}
            </div>
            </div>
            <div class="result-right">
            <span class="result-gems">${(s.gems || 0).toLocaleString()} gems</span>
            <span class="result-section">${esc(section)}</span>
            </div>
            </div>
            `;
        }).join('')}
        </div>
        `;
    }


    /* ── Results info ─────────────────────────────── */

    function renderResultsInfo() {
        const el = document.getElementById('results-info');
        const total = state.results.length;
        el.innerHTML = `
        <span class="results-count">${total.toLocaleString()}</span>
        <span>result${total !== 1 ? 's' : ''} for "${esc(state.query)}"</span>
        `;
    }


    /* ── Pagination ───────────────────────────────── */

    function renderPagination() {
        const el = document.getElementById('pagination');
        const total = state.results.length;
        const totalPages = Math.ceil(total / PAGE_SIZE);

        if (totalPages <= 1) {
            el.style.display = 'none';
            return;
        }

        el.style.display = '';

        const start = (state.page - 1) * PAGE_SIZE + 1;
        const end = Math.min(state.page * PAGE_SIZE, total);

        let pages = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (state.page > 3) pages.push('…');
            const rs = Math.max(2, state.page - 1);
            const re = Math.min(totalPages - 1, state.page + 1);
            for (let i = rs; i <= re; i++) pages.push(i);
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
                    renderResults();
                    renderPagination();
                    document.getElementById('results').scrollIntoView({
                        behavior: 'smooth', block: 'start'
                    });
                }
            });
        });
    }

})();
