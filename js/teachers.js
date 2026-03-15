/**
 * teachers.js — Teacher profiles with PIN-gated credential reveal.
 * acad_INFO v4.3
 */

document.addEventListener('DOMContentLoaded', async () => {
    initPage();
    await loadData();
    if (!DATA.teachers) return;

    renderSwitcher('school-switcher', () => renderAll());
    renderAll();
});


function renderAll() {
    const teachers = SCHOOL.teachers();
    updateSidebarCounts();

    const revealed = isAuthed();
    const cracked = teachers.filter(t => t.password_found).length;
    const locked = teachers.filter(t => !t.password_found).length;
    const totalClasses = teachers.reduce((sum, t) =>
    sum + ((t.classes && t.classes.total_class_count) || 0), 0);

    const statData = [
        { val: teachers.length, label: 'Teachers found' },
        { val: cracked, label: 'Credentials cracked' },
        { val: locked, label: 'Locked' },
        { val: totalClasses, label: 'Class assignments' },
    ];

    const statsEl = document.getElementById('teacher-stats');
    if (statsEl) {
        statsEl.innerHTML = statData.map((s, i) => `
        <div class="stat-card fade-enter" style="animation-delay:${i * 50}ms">
        <div class="stat-val counter" data-target="${s.val}">0</div>
        <div class="stat-label">${esc(s.label)}</div>
        </div>
        `).join('');
        initCounters();
    }

    const revealBarEl = document.getElementById('reveal-bar');
    if (revealBarEl) {
        if (revealed) {
            revealBarEl.innerHTML = `
            <div class="reveal-bar">
            <span class="reveal-bar-text">Sensitive data visible for this session</span>
            <button class="reveal-btn unlocked" disabled>✓ Unlocked</button>
            </div>`;
        } else {
            revealBarEl.innerHTML = `
            <div class="reveal-bar">
            <span class="reveal-bar-text">Emails and passwords are censored. Enter PIN to reveal.</span>
            <button class="reveal-btn" id="reveal-trigger" data-hover>⚿ Reveal data</button>
            </div>`;
            const btn = document.getElementById('reveal-trigger');
            if (btn) btn.addEventListener('click', () => showPinModal(() => renderAll()));
        }
    }

    const container = document.getElementById('teachers-container');
    if (!container) return;

    if (teachers.length === 0) {
        container.innerHTML = `
        <div class="empty-state">
        <div class="empty-state-icon">∅</div>
        <h3>No teachers found</h3>
        <p>No teacher accounts discovered for this school</p>
        </div>`;
        return;
    }

    const sorted = [...teachers].sort((a, b) => {
        if (a.password_found !== b.password_found) return b.password_found ? 1 : -1;
        return (a.name || '').localeCompare(b.name || '');
    });

    container.innerHTML = `
    <div class="grid-2">
    ${sorted.map((t, i) => {
        const profile = t.profile || {};
        const classes = (t.classes && t.classes.classes) || [];

        const emailDisplay = revealed ? esc(t.username) : esc(censorEmail(t.username));
        const pwdDisplay = (t.password_found && t.password)
        ? (revealed ? esc(t.password) : censorPassword(t.password))
        : null;

        return `
        <div class="teacher-card fade-enter" style="animation-delay:${i * 60}ms">
        <div class="teacher-header">
        <div>
        <div class="teacher-name" style="cursor:pointer;" data-copy="${esc(t.name)}" title="Click to copy">${esc(t.name)}</div>
        <div class="teacher-email${revealed ? '' : ' censored-val'}" ${revealed ? `style="cursor:pointer;" data-copy="${esc(t.username)}" title="Click to copy"` : ''}>${emailDisplay}</div>
        </div>
        <span class="teacher-status ${t.password_found ? 'cracked' : 'locked'}">
        ${t.password_found ? '✓ Cracked' : '✗ Locked'}
        </span>
        </div>

        ${pwdDisplay ? `
            <div class="teacher-detail-row">
            <span class="teacher-detail-label">Password</span>
            <span class="teacher-detail-val${revealed ? '' : ' censored-val'}" ${revealed ? `style="cursor:pointer;" data-copy="${esc(t.password)}" title="Click to copy"` : ''}>${pwdDisplay}</span>
            </div>` : ''}

            ${profile.teacher_id ? `
                <div class="teacher-detail-row">
                <span class="teacher-detail-label">Teacher ID</span>
                <span class="teacher-detail-val" style="cursor:pointer;" data-copy="${profile.teacher_id}" title="Click to copy">${profile.teacher_id}</span>
                </div>` : ''}

                ${profile.school_name ? `
                    <div class="teacher-detail-row">
                    <span class="teacher-detail-label">School</span>
                    <span class="teacher-detail-val" style="font-size:0.625rem">${esc(profile.school_name)}</span>
                    </div>` : ''}

                    ${classes.length > 0 ? `
                        <div class="teacher-classes">
                        <div class="teacher-classes-title">Class assignments (${classes.length})</div>
                        <div class="teacher-class-list">
                        ${classes.map(c => `
                            <span class="teacher-class-badge">
                            ${esc(c.class_name)}
                            <span class="student-ct">${c.student_count}s</span>
                            </span>
                            `).join('')}
                            </div>
                            </div>` : ''}
                            </div>`;
    }).join('')}
    </div>`;
}
