/**
 * FormulaX — Season Explorer Module
 * Interactive Grand Prix Calendar, Status Filters, Event Details Modal & Cross-Module Deep-Linking.
 */

document.addEventListener('DOMContentLoaded', () => {
  const yearSelect = document.getElementById('explorer-year-select');
  const searchInput = document.getElementById('explorer-search');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const viewGridBtn = document.getElementById('btn-view-grid');
  const viewListBtn = document.getElementById('btn-view-list');
  const container = document.getElementById('explorer-events-container');
  const loader = document.getElementById('explorer-loader');
  const emptyMsg = document.getElementById('explorer-empty-msg');

  // Modal elements
  const modalBackdrop = document.getElementById('event-modal-backdrop');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalRoundBadge = document.getElementById('modal-round-badge');
  const modalStatusBadge = document.getElementById('modal-status-badge');
  const modalEventName = document.getElementById('modal-event-name');
  const modalLocationText = document.getElementById('modal-location-text');
  const modalResultCard = document.getElementById('modal-result-card');
  const modalPodiumContent = document.getElementById('modal-podium-content');
  const modalSessionsList = document.getElementById('modal-sessions-list');
  const btnOpenRaceCenter = document.getElementById('btn-open-racecenter');
  const btnOpenTelemetry = document.getElementById('btn-open-telemetry');
  const btnOpenStrategy = document.getElementById('btn-open-strategy');

  // State
  let calendarEvents = [];
  let currentFilter = 'all';
  let currentSearchQuery = '';
  let currentViewMode = 'grid'; // 'grid' or 'list'

  // --- Load Season Calendar ---
  async function loadSeasonCalendar(year) {
    loader.style.display = 'block';
    container.innerHTML = '';
    emptyMsg.style.display = 'none';

    document.getElementById('explorer-year-badge').textContent = `${year} Season`;

    try {
      const res = await fetch(`/api/season_calendar/${year}/`);
      if (!res.ok) throw new Error('Failed to load season calendar');
      calendarEvents = await res.json();

      updateSummaryMetrics(calendarEvents, year);
      renderCalendar();
    } catch (err) {
      console.error('Error loading season calendar:', err);
      container.innerHTML = '<p style="color: var(--text-muted); text-align: center; grid-column: 1 / -1;">Error loading calendar data.</p>';
    } finally {
      loader.style.display = 'none';
    }
  }

  // --- Summary Metrics ---
  function updateSummaryMetrics(events, year) {
    const totalRounds = events.length;
    const completedEvents = events.filter(e => e.IsCompleted);
    const completedCount = completedEvents.length;

    document.getElementById('stat-total-rounds').textContent = totalRounds;
    document.getElementById('stat-completed-rounds').textContent = completedCount;

    const pct = totalRounds > 0 ? Math.round((completedCount / totalRounds) * 100) : 0;
    document.getElementById('stat-completed-pct').textContent = `${pct}% of Season Completed`;

    // Season status
    const statusBadge = document.getElementById('explorer-status-badge');
    if (completedCount === totalRounds && totalRounds > 0) {
      statusBadge.textContent = 'Season Completed';
      statusBadge.style.background = 'rgba(0, 200, 83, 0.2)';
      statusBadge.style.color = '#00C853';
    } else if (completedCount > 0) {
      statusBadge.textContent = 'Season In Progress';
      statusBadge.style.background = 'rgba(255, 234, 0, 0.2)';
      statusBadge.style.color = 'var(--neon-yellow)';
    } else {
      statusBadge.textContent = 'Upcoming Season';
      statusBadge.style.background = 'rgba(255, 255, 255, 0.1)';
      statusBadge.style.color = '#E0E0E0';
    }

    function formatWinnerName(w) {
      if (!w) return null;
      if (typeof w === 'string') return w;
      return w.name || w.BroadcastName || w.driver || null;
    }

    // Latest GP
    if (completedCount > 0) {
      const latest = completedEvents[completedCount - 1];
      document.getElementById('stat-latest-gp').textContent = latest.EventName;
      const winnerName = latest.ResultSummary ? formatWinnerName(latest.ResultSummary.winner) : null;
      document.getElementById('stat-latest-winner').textContent = winnerName ? `Winner: ${winnerName}` : 'Race Finished';
    } else {
      document.getElementById('stat-latest-gp').textContent = 'None';
      document.getElementById('stat-latest-winner').textContent = 'Season not started';
    }

    // Next GP
    const upcomingEvents = events.filter(e => !e.IsCompleted);
    if (upcomingEvents.length > 0) {
      const nextGP = upcomingEvents[0];
      document.getElementById('stat-next-gp').textContent = nextGP.EventName;
      const dateStr = nextGP.EventDate ? new Date(nextGP.EventDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD';
      document.getElementById('stat-next-date').textContent = `Scheduled: ${dateStr}`;
    } else {
      document.getElementById('stat-next-gp').textContent = 'Season Concluded';
      document.getElementById('stat-next-date').textContent = 'All rounds complete';
    }
  }

  // --- Filtering & Rendering ---
  function filterAndSearchEvents() {
    return calendarEvents.filter(ev => {
      // 1. Status Filter
      if (currentFilter === 'completed' && !ev.IsCompleted) return false;
      if (currentFilter === 'upcoming' && ev.IsCompleted) return false;

      // 2. Search Query
      if (currentSearchQuery.trim() !== '') {
        const q = currentSearchQuery.toLowerCase();
        const nameMatch = (ev.EventName || '').toLowerCase().includes(q);
        const countryMatch = (ev.Country || '').toLowerCase().includes(q);
        const locMatch = (ev.Location || '').toLowerCase().includes(q);
        if (!nameMatch && !countryMatch && !locMatch) return false;
      }

      return true;
    });
  }

  function renderCalendar() {
    const filtered = filterAndSearchEvents();
    container.innerHTML = '';

    if (filtered.length === 0) {
      emptyMsg.style.display = 'flex';
      return;
    }
    emptyMsg.style.display = 'none';

    if (currentViewMode === 'grid') {
      container.className = 'explorer-grid';
      renderGridView(filtered);
    } else {
      container.className = 'explorer-list';
      renderListView(filtered);
    }
  }

  function renderGridView(events) {
    events.forEach(ev => {
      const card = document.createElement('div');
      card.className = `race-card ${ev.IsCompleted ? 'completed-card' : 'upcoming-card'}`;
      card.style.cursor = 'pointer';

      const dateStr = ev.EventDate ? new Date(ev.EventDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBD';
      const isSprint = (ev.EventFormat || '').toLowerCase().includes('sprint');

      let statusBadgeHtml = ev.IsCompleted
        ? `<span class="race-meta-badge" style="background: rgba(0, 200, 83, 0.2); color: #00C853; border-color: #00C853;">Completed</span>`
        : `<span class="race-meta-badge" style="background: rgba(255, 234, 0, 0.15); color: var(--neon-yellow); border-color: rgba(255, 234, 0, 0.4);">Scheduled</span>`;

      let sprintBadgeHtml = isSprint
        ? `<span class="race-meta-badge highlight" style="font-size: 0.72rem; padding: 0.15rem 0.5rem;">⚡ Sprint</span>`
        : '';

      let winnerHtml = '';
      const wName = (ev.IsCompleted && ev.ResultSummary) ? formatWinnerName(ev.ResultSummary.winner) : null;
      if (wName) {
        winnerHtml = `
          <div style="margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid rgba(255, 255, 255, 0.08); font-size: 0.82rem; color: #E0E0E0;">
            🥇 Winner: <strong>${wName}</strong>
          </div>
        `;
      }

      // Sessions list chips
      let sessionsHtml = '';
      if (ev.Sessions && ev.Sessions.length > 0) {
        sessionsHtml = `
          <div style="display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.75rem;">
            ${ev.Sessions.map(s => `<span style="font-size: 0.72rem; background: #2A2A2A; padding: 0.15rem 0.4rem; border-radius: 3px; color: var(--text-muted);">${s}</span>`).join('')}
          </div>
        `;
      }

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px;">ROUND ${ev.RoundNumber}</span>
          <div style="display: flex; gap: 0.4rem; align-items: center;">
            ${sprintBadgeHtml}
            ${statusBadgeHtml}
          </div>
        </div>
        <h3 style="margin: 0 0 0.35rem 0; font-size: 1.15rem; color: #FFF;">${ev.EventName}</h3>
        <p style="margin: 0; color: var(--text-muted); font-size: 0.88rem;">📍 ${ev.Location || ev.Country}, ${ev.Country}</p>
        <p style="margin: 0.25rem 0 0 0; color: var(--neon-yellow); font-size: 0.82rem; font-weight: 600;">🗓️ ${dateStr}</p>
        ${sessionsHtml}
        ${winnerHtml}
      `;

      card.addEventListener('click', () => openEventModal(ev));
      container.appendChild(card);
    });
  }

  function renderListView(events) {
    const tableCard = document.createElement('div');
    tableCard.className = 'card';
    tableCard.style.padding = '0';
    tableCard.style.overflow = 'hidden';

    let tableHtml = `
      <div class="table-responsive">
        <table class="leaderboard-table" style="margin: 0;">
          <thead>
            <tr>
              <th style="width: 70px;">Round</th>
              <th>Grand Prix</th>
              <th>Country &amp; Location</th>
              <th>Date</th>
              <th>Status</th>
              <th>Winner</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
    `;

    events.forEach(ev => {
      const dateStr = ev.EventDate ? new Date(ev.EventDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD';
      const statusBadge = ev.IsCompleted
        ? `<span style="color: #00C853; font-weight: 600;">Completed</span>`
        : `<span style="color: var(--neon-yellow); font-weight: 600;">Scheduled</span>`;
      const winner = ev.ResultSummary ? ev.ResultSummary.winner : (ev.IsCompleted ? 'Finished' : '--');

      tableHtml += `
        <tr style="cursor: pointer;" class="explorer-list-row" data-round="${ev.RoundNumber}">
          <td><strong>R${ev.RoundNumber}</strong></td>
          <td><strong>${ev.EventName}</strong></td>
          <td>${ev.Location || ev.Country}, ${ev.Country}</td>
          <td>${dateStr}</td>
          <td>${statusBadge}</td>
          <td>${winner}</td>
          <td style="text-align: right;">
            <button class="btn-secondary" style="font-size: 0.78rem; padding: 0.25rem 0.6rem;">Details &rarr;</button>
          </td>
        </tr>
      `;
    });

    tableHtml += `
          </tbody>
        </table>
      </div>
    `;

    tableCard.innerHTML = tableHtml;
    container.appendChild(tableCard);

    // Click handler for list rows
    document.querySelectorAll('.explorer-list-row').forEach(row => {
      row.addEventListener('click', () => {
        const rnd = parseInt(row.getAttribute('data-round'), 10);
        const ev = calendarEvents.find(e => e.RoundNumber === rnd);
        if (ev) openEventModal(ev);
      });
    });
  }

  // --- Modal Logic & Cross-Module Deep-Linking ---
  function openEventModal(ev) {
    const year = yearSelect.value;
    const dateStr = ev.EventDate ? new Date(ev.EventDate).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Scheduled Date TBD';

    modalRoundBadge.textContent = `Round ${ev.RoundNumber}`;
    modalStatusBadge.textContent = ev.IsCompleted ? 'Completed Grand Prix' : 'Upcoming Event';
    modalStatusBadge.style.color = ev.IsCompleted ? '#00C853' : 'var(--neon-yellow)';

    modalEventName.textContent = ev.EventName;
    modalLocationText.textContent = `${ev.Location || ev.Country}, ${ev.Country} • ${dateStr}`;

    // Winner / Podium section
    const modalWinnerName = (ev.IsCompleted && ev.ResultSummary) ? formatWinnerName(ev.ResultSummary.winner) : null;
    if (modalWinnerName) {
      modalResultCard.style.display = 'block';
      modalPodiumContent.innerHTML = `
        <div style="font-size: 1.1rem; color: #FFF;">
          🥇 <strong>${modalWinnerName}</strong>
        </div>
      `;
    } else {
      modalResultCard.style.display = 'none';
    }

    // Sessions List
    modalSessionsList.innerHTML = '';
    const sessions = ev.Sessions && ev.Sessions.length > 0
      ? ev.Sessions
      : ['Practice 1', 'Practice 2', 'Practice 3', 'Qualifying', 'Race'];

    sessions.forEach(s => {
      const chip = document.createElement('span');
      chip.className = 'race-meta-badge';
      chip.textContent = s;
      modalSessionsList.appendChild(chip);
    });

    // Deep Link Navigation URLs
    const encodedGP = encodeURIComponent(ev.EventName);
    btnOpenRaceCenter.href = `/dashboard/?year=${year}&gp=${encodedGP}&session=Race`;
    btnOpenTelemetry.href = `/telemetry/?year=${year}&gp=${encodedGP}&session=Race`;
    btnOpenStrategy.href = `/analytics/?year=${year}&gp=${encodedGP}&tab=tab-tyre-strat`;

    modalBackdrop.style.display = 'flex';
  }

  function closeModal() {
    modalBackdrop.style.display = 'none';
  }

  modalCloseBtn.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalBackdrop.style.display === 'flex') closeModal();
  });

  // --- Filter and Search Listeners ---
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      renderCalendar();
    });
  });

  searchInput.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value;
    renderCalendar();
  });

  viewGridBtn.addEventListener('click', () => {
    viewGridBtn.classList.add('active');
    viewListBtn.classList.remove('active');
    currentViewMode = 'grid';
    renderCalendar();
  });

  viewListBtn.addEventListener('click', () => {
    viewListBtn.classList.add('active');
    viewGridBtn.classList.remove('active');
    currentViewMode = 'list';
    renderCalendar();
  });

  yearSelect.addEventListener('change', () => {
    loadSeasonCalendar(yearSelect.value);
  });

  // Initial Load
  loadSeasonCalendar(yearSelect.value);
});
