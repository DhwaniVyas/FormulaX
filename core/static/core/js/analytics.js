/**
 * FormulaX — Performance & Strategy Module
 * Head-to-Head Driver Comparisons, Constructor Analytics, Tyre Degradation, Pit Timing & Session Weather.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global Tyre Colors
  const TYRE_COLORS = {
    'SOFT': '#EC0000',
    'MEDIUM': '#F0D002',
    'HARD': '#FFFFFF',
    'INTERMEDIATE': '#43B02A',
    'WET': '#0067AD',
    'UNKNOWN': '#888888'
  };

  // Chart instances
  const charts = {
    driverFinishes: null,
    driverStatsBar: null,
    constructorPoints: null,
    tyreUsage: null,
    tyreDegradation: null,
    weatherTimeseries: null
  };

  // --- Tab Switching Logic ---
  const tabBtns = document.querySelectorAll('.race-tab-btn');
  const activeTabBadge = document.getElementById('analytics-active-tab-badge');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetTabId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetTabId);
      if (targetPane) targetPane.classList.add('active');

      if (activeTabBadge) {
        activeTabBadge.textContent = btn.textContent.replace(/^\d+\.\s*/, '');
      }

      // Update URL query without full reload
      const url = new URL(window.location);
      url.searchParams.set('tab', targetTabId);
      window.history.replaceState({}, '', url);

      // Trigger redraw/resize for newly visible charts
      Object.values(charts).forEach(c => {
        if (c) c.resize();
      });

      // Lazy-trigger tabs if not loaded yet
      if (targetTabId === 'tab-team-perf' && !charts.constructorPoints) {
        loadTeamPerformance();
      } else if (targetTabId === 'tab-tyre-strat' && !charts.tyreUsage) {
        loadTyreStrategy();
      } else if (targetTabId === 'tab-pit-strat' && document.getElementById('pit-events-tbody').children.length === 0) {
        loadPitStrategy();
      } else if (targetTabId === 'tab-weather-cond' && !charts.weatherTimeseries) {
        loadWeatherConditions();
      }
    });
  });

  // --- TAB 1: DRIVER VS DRIVER ---
  const dcompYear = document.getElementById('dcomp-year-select');
  const dcompD1 = document.getElementById('dcomp-d1-select');
  const dcompD2 = document.getElementById('dcomp-d2-select');
  const dcompBtn = document.getElementById('dcomp-btn');
  const dcompLoader = document.getElementById('dcomp-loader');
  const dcompErrorBox = document.getElementById('dcomp-error-box');
  const dcompErrorMsg = document.getElementById('dcomp-error-message');
  const dcompContent = document.getElementById('dcomp-content');

  let driversListCache = [];

  async function loadDriversForComparison(year) {
    try {
      dcompD1.innerHTML = '<option value="">Loading drivers...</option>';
      dcompD2.innerHTML = '<option value="">Loading drivers...</option>';

      const res = await fetch(`/api/drivers/${year}/`);
      driversListCache = await res.json();

      dcompD1.innerHTML = '';
      dcompD2.innerHTML = '';

      if (!driversListCache || driversListCache.length === 0) {
        dcompD1.innerHTML = '<option value="">No drivers found</option>';
        dcompD2.innerHTML = '<option value="">No drivers found</option>';
        return;
      }

      driversListCache.forEach((d, idx) => {
        const name = d.BroadcastName || d.Abbreviation;
        const opt1 = new Option(`${name} (${d.TeamName || 'F1'})`, d.Abbreviation);
        const opt2 = new Option(`${name} (${d.TeamName || 'F1'})`, d.Abbreviation);
        dcompD1.add(opt1);
        dcompD2.add(opt2);
      });

      // Default selection: Driver 1 = 1st, Driver 2 = 2nd
      if (dcompD1.options.length > 0) dcompD1.selectedIndex = 0;
      if (dcompD2.options.length > 1) dcompD2.selectedIndex = 1;

      // Auto compare
      compareDrivers();
    } catch (err) {
      console.error('Failed to load drivers:', err);
    }
  }

  async function compareDrivers() {
    const year = dcompYear.value;
    const d1 = dcompD1.value;
    const d2 = dcompD2.value;

    if (!year || !d1 || !d2) {
      alert('Please select both drivers.');
      return;
    }

    if (d1 === d2) {
      alert('Please select two different drivers for comparison.');
      return;
    }

    dcompLoader.style.display = 'block';
    dcompErrorBox.style.display = 'none';

    try {
      const res = await fetch(`/api/driver_comparison/${year}/${d1}/${d2}/`);
      if (!res.ok) {
        throw new Error(`Comparison API returned status ${res.status}`);
      }
      const data = await res.json();
      renderDriverComparison(data, d1, d2);
      dcompContent.style.display = 'block';
    } catch (err) {
      console.error('Driver comparison error:', err);
      dcompErrorMsg.textContent = 'Could not generate driver comparison data for this season.';
      dcompErrorBox.style.display = 'flex';
      dcompContent.style.display = 'none';
    } finally {
      dcompLoader.style.display = 'none';
    }
  }

  function renderDriverComparison(data, d1, d2) {
    const s1 = data[d1] || { points: 0, wins: 0, podiums: 0, avg_finish: 'N/A', dnfs: 0, finishes: [] };
    const s2 = data[d2] || { points: 0, wins: 0, podiums: 0, avg_finish: 'N/A', dnfs: 0, finishes: [] };

    const meta1 = driversListCache.find(d => d.Abbreviation === d1) || {};
    const meta2 = driversListCache.find(d => d.Abbreviation === d2) || {};

    document.getElementById('d1-header-name').textContent = meta1.BroadcastName || d1;
    document.getElementById('d1-header-team').textContent = meta1.TeamName || 'F1 Team';
    document.getElementById('d1-stat-points').textContent = s1.points;
    document.getElementById('d1-stat-wins').textContent = s1.wins;
    document.getElementById('d1-stat-podiums').textContent = s1.podiums;
    document.getElementById('d1-stat-avg').textContent = s1.avg_finish;
    document.getElementById('d1-stat-dnfs').textContent = s1.dnfs;
    document.getElementById('d1-stat-races').textContent = s1.finishes ? s1.finishes.length : 0;

    document.getElementById('d2-header-name').textContent = meta2.BroadcastName || d2;
    document.getElementById('d2-header-team').textContent = meta2.TeamName || 'F1 Team';
    document.getElementById('d2-stat-points').textContent = s2.points;
    document.getElementById('d2-stat-wins').textContent = s2.wins;
    document.getElementById('d2-stat-podiums').textContent = s2.podiums;
    document.getElementById('d2-stat-avg').textContent = s2.avg_finish;
    document.getElementById('d2-stat-dnfs').textContent = s2.dnfs;
    document.getElementById('d2-stat-races').textContent = s2.finishes ? s2.finishes.length : 0;

    // 1. Finishing Positions Line Chart (inverted Y axis, P1 at top)
    const ctxFinishes = document.getElementById('driverFinishesChart').getContext('2d');
    if (charts.driverFinishes) charts.driverFinishes.destroy();

    const maxRaces = Math.max(s1.finishes.length, s2.finishes.length);
    const raceLabels = Array.from({ length: maxRaces }, (_, i) => `Race ${i + 1}`);

    charts.driverFinishes = new Chart(ctxFinishes, {
      type: 'line',
      data: {
        labels: raceLabels,
        datasets: [
          {
            label: meta1.BroadcastName || d1,
            data: s1.finishes,
            borderColor: '#00D2BE',
            backgroundColor: 'rgba(0, 210, 190, 0.1)',
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.1
          },
          {
            label: meta2.BroadcastName || d2,
            data: s2.finishes,
            borderColor: '#FF1801',
            backgroundColor: 'rgba(255, 24, 1, 0.1)',
            borderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#E0E0E0' } },
          tooltip: {
            callbacks: {
              label: (item) => `${item.dataset.label}: P${item.parsed.y}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#888' }
          },
          y: {
            reverse: true,
            min: 1,
            max: 20,
            ticks: {
              stepSize: 2,
              color: '#888',
              callback: (val) => `P${val}`
            },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            title: { display: true, text: 'Finishing Position (P1 is Win)', color: '#888' }
          }
        }
      }
    });

    // 2. Side-by-Side Statistics Bar Chart
    const ctxBar = document.getElementById('driverStatsBarChart').getContext('2d');
    if (charts.driverStatsBar) charts.driverStatsBar.destroy();

    charts.driverStatsBar = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: ['Points', 'Wins', 'Podiums', 'DNFs'],
        datasets: [
          {
            label: meta1.BroadcastName || d1,
            data: [s1.points, s1.wins, s1.podiums, s1.dnfs],
            backgroundColor: '#00D2BE',
            borderColor: '#00B3A1',
            borderWidth: 1
          },
          {
            label: meta2.BroadcastName || d2,
            data: [s2.points, s2.wins, s2.podiums, s2.dnfs],
            backgroundColor: '#FF1801',
            borderColor: '#D41400',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#E0E0E0' } } },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#E0E0E0' }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#888' }
          }
        }
      }
    });
  }

  dcompYear.addEventListener('change', () => loadDriversForComparison(dcompYear.value));
  dcompBtn.addEventListener('click', compareDrivers);

  // --- TAB 2: TEAM PERFORMANCE ---
  const teamYear = document.getElementById('team-year-select');
  const teamLoadBtn = document.getElementById('team-load-btn');
  const teamLoader = document.getElementById('team-loader');

  async function loadTeamPerformance() {
    const year = teamYear.value;
    teamLoader.style.display = 'block';

    try {
      const res = await fetch(`/api/team_performance/${year}/`);
      if (!res.ok) throw new Error('Failed to fetch team performance');
      const data = await res.json();
      renderTeamPerformance(data);
    } catch (err) {
      console.error('Team performance error:', err);
    } finally {
      teamLoader.style.display = 'none';
    }
  }

  function renderTeamPerformance(data) {
    const teams = data.teams || [];
    const labels = teams.map(t => t.team);
    const points = teams.map(t => t.points);

    // 1. Constructor Points Bar Chart
    const ctx = document.getElementById('constructorPointsChart').getContext('2d');
    if (charts.constructorPoints) charts.constructorPoints.destroy();

    charts.constructorPoints = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Total Constructor Points',
          data: points,
          backgroundColor: '#FF1801',
          borderColor: '#E00000',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#888' }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#E0E0E0', font: { weight: 600 } }
          }
        }
      }
    });

    // 2. Driver Points Contribution Splits
    const splitsContainer = document.getElementById('team-splits-container');
    splitsContainer.innerHTML = '';

    const tbody = document.getElementById('team-summary-tbody');
    tbody.innerHTML = '';

    teams.forEach(t => {
      // Split progress bar card
      const item = document.createElement('div');
      item.style.padding = '0.75rem';
      item.style.background = 'var(--bg-card-secondary)';
      item.style.borderRadius = '6px';

      const d1 = t.drivers[0] || { name: 'Driver 1', points: 0, percentage: 50 };
      const d2 = t.drivers[1] || { name: 'Driver 2', points: 0, percentage: 50 };

      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.88rem; margin-bottom: 0.35rem;">
          <span style="font-weight: 600; color: #FFF;">${t.team}</span>
          <span style="color: var(--neon-yellow);">${t.points} pts</span>
        </div>
        <div style="height: 10px; border-radius: 5px; overflow: hidden; display: flex; background: #333;">
          <div style="width: ${d1.percentage}%; background: #00D2BE;" title="${d1.name}: ${d1.points} pts (${d1.percentage}%)"></div>
          <div style="width: ${d2.percentage}%; background: #FF1801;" title="${d2.name}: ${d2.points} pts (${d2.percentage}%)"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted); margin-top: 0.3rem;">
          <span style="color: #00D2BE;">${d1.name} (${d1.points} pts &bull; ${d1.percentage}%)</span>
          <span style="color: #FF8A80;">${d2.name} (${d2.points} pts &bull; ${d2.percentage}%)</span>
        </div>
      `;
      splitsContainer.appendChild(item);

      // Table row
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>P${t.position}</strong></td>
        <td><strong>${t.team}</strong></td>
        <td>${t.wins}</td>
        <td>
          <span style="color: #00D2BE;">${d1.abbr || d1.name} (${d1.percentage}%)</span> /
          <span style="color: #FF8A80;">${d2.abbr || d2.name} (${d2.percentage}%)</span>
        </td>
        <td style="text-align: right; font-weight: 700; color: var(--neon-yellow);">${t.points}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  teamLoadBtn.addEventListener('click', loadTeamPerformance);
  teamYear.addEventListener('change', loadTeamPerformance);

  // --- TAB 3: TYRE STRATEGY ---
  const tyreYear = document.getElementById('tyre-year-select');
  const tyreGP = document.getElementById('tyre-gp-select');
  const tyreCompound = document.getElementById('tyre-compound-select');
  const tyreLoadBtn = document.getElementById('tyre-load-btn');
  const tyreLoader = document.getElementById('tyre-loader');

  async function loadScheduleForTyres(year) {
    try {
      tyreGP.innerHTML = '<option value="">Loading schedule...</option>';
      const res = await fetch(`/api/schedule/${year}/`);
      const schedule = await res.json();
      tyreGP.innerHTML = '';
      schedule.forEach((ev, idx) => {
        const opt = new Option(`R${ev.RoundNumber}: ${ev.EventName}`, ev.EventName);
        if (idx === 0) opt.selected = true;
        tyreGP.add(opt);
      });
    } catch (err) {
      console.error('Tyre schedule load error:', err);
    }
  }

  async function loadTyreStrategy() {
    const year = tyreYear.value;
    const gp = tyreGP.value;
    const comp = tyreCompound.value;

    if (!year || !gp) return;

    tyreLoader.style.display = 'block';

    try {
      // 1. Fetch Compound Usage Pie
      const resUsage = await fetch(`/api/tyre_usage/${year}/${encodeURIComponent(gp)}/`);
      const dataUsage = await resUsage.json();
      renderTyreUsagePie(dataUsage);

      // 2. Fetch Degradation Scatter
      const resDeg = await fetch(`/api/tyre_degradation/${year}/${encodeURIComponent(gp)}/?compound=${comp}`);
      const dataDeg = await resDeg.json();
      renderTyreDegradation(dataDeg);
    } catch (err) {
      console.error('Tyre strategy error:', err);
    } finally {
      tyreLoader.style.display = 'none';
    }
  }

  function renderTyreUsagePie(data) {
    const ctx = document.getElementById('tyreUsageChart').getContext('2d');
    if (charts.tyreUsage) charts.tyreUsage.destroy();

    const labels = data.labels || [];
    const values = data.data || [];
    const bgColors = labels.map(l => TYRE_COLORS[l.toUpperCase()] || '#888');

    charts.tyreUsage = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: bgColors,
          borderColor: '#1E1E1E',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#E0E0E0' } }
        }
      }
    });
  }

  function renderTyreDegradation(data) {
    const ctx = document.getElementById('tyreDegradationChart').getContext('2d');
    if (charts.tyreDegradation) charts.tyreDegradation.destroy();

    const laps = data.laps || [];
    // Group by compound
    const datasets = [];
    const compounds = [...new Set(laps.map(l => l.compound))];

    compounds.forEach(c => {
      const cLaps = laps.filter(l => l.compound === c);
      const points = cLaps.map(l => ({ x: l.tyre_life, y: l.lap_time, driver: l.driver }));
      const color = TYRE_COLORS[c.toUpperCase()] || '#888';

      datasets.push({
        label: `${c} Compound`,
        data: points,
        backgroundColor: color,
        borderColor: color,
        pointRadius: 4,
        pointHoverRadius: 6,
        showLine: false
      });
    });

    charts.tyreDegradation = new Chart(ctx, {
      type: 'scatter',
      data: { datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#E0E0E0' } },
          tooltip: {
            callbacks: {
              label: (item) => {
                const raw = item.raw;
                return `${raw.driver || ''}: ${raw.y.toFixed(3)}s at Tyre Life ${raw.x} laps`;
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Tyre Age (Laps Completed on Set)', color: '#888' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#888' }
          },
          y: {
            title: { display: true, text: 'Lap Time (seconds)', color: '#888' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#888' }
          }
        }
      }
    });
  }

  tyreYear.addEventListener('change', async () => {
    await loadScheduleForTyres(tyreYear.value);
    loadTyreStrategy();
  });
  tyreGP.addEventListener('change', loadTyreStrategy);
  tyreCompound.addEventListener('change', loadTyreStrategy);
  tyreLoadBtn.addEventListener('click', loadTyreStrategy);

  // --- TAB 4: PIT STRATEGY ---
  const pitYear = document.getElementById('pit-year-select');
  const pitGP = document.getElementById('pit-gp-select');
  const pitLoadBtn = document.getElementById('pit-load-btn');
  const pitLoader = document.getElementById('pit-loader');

  async function loadScheduleForPits(year) {
    try {
      pitGP.innerHTML = '<option value="">Loading schedule...</option>';
      const res = await fetch(`/api/schedule/${year}/`);
      const schedule = await res.json();
      pitGP.innerHTML = '';
      schedule.forEach((ev, idx) => {
        const opt = new Option(`R${ev.RoundNumber}: ${ev.EventName}`, ev.EventName);
        if (idx === 0) opt.selected = true;
        pitGP.add(opt);
      });
    } catch (err) {
      console.error('Pit schedule load error:', err);
    }
  }

  async function loadPitStrategy() {
    const year = pitYear.value;
    const gp = pitGP.value;
    if (!year || !gp) return;

    pitLoader.style.display = 'block';

    try {
      const res = await fetch(`/api/session_data/${year}/${encodeURIComponent(gp)}/?session=Race`);
      const data = await res.json();
      renderPitStrategy(data);
    } catch (err) {
      console.error('Pit strategy error:', err);
    } finally {
      pitLoader.style.display = 'none';
    }
  }

  function renderPitStrategy(data) {
    const stints = data.stints || [];
    const pitStops = data.pit_stops || [];
    const totalLaps = data.total_laps || 57;

    // 1. Stints Timeline
    const timelineContainer = document.getElementById('pit-stints-timeline-container');
    timelineContainer.innerHTML = '';

    if (stints.length === 0) {
      timelineContainer.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No stint sequence data recorded for this race.</p>';
    } else {
      stints.slice(0, 15).forEach(dStint => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '1rem';
        row.style.padding = '0.5rem';
        row.style.background = 'var(--bg-card-secondary)';
        row.style.borderRadius = '4px';

        const driverLabel = document.createElement('div');
        driverLabel.style.width = '70px';
        driverLabel.style.fontWeight = '700';
        driverLabel.style.fontSize = '0.9rem';
        driverLabel.textContent = dStint.driver;
        row.appendChild(driverLabel);

        const bar = document.createElement('div');
        bar.style.flex = '1';
        bar.style.height = '18px';
        bar.style.borderRadius = '3px';
        bar.style.overflow = 'hidden';
        bar.style.display = 'flex';
        bar.style.background = '#222';

        dStint.stints.forEach(st => {
          const lapsCount = (st.end_lap - st.start_lap + 1) || 1;
          const pct = Math.min(100, Math.max(2, (lapsCount / totalLaps) * 100));
          const compColor = TYRE_COLORS[(st.compound || '').toUpperCase()] || '#888';

          const segment = document.createElement('div');
          segment.style.width = `${pct}%`;
          segment.style.background = compColor;
          segment.title = `${st.compound}: Laps ${st.start_lap}–${st.end_lap} (${lapsCount} laps)`;
          bar.appendChild(segment);
        });

        row.appendChild(bar);
        timelineContainer.appendChild(row);
      });
    }

    // 2. Pit Events Table
    const tbody = document.getElementById('pit-events-tbody');
    tbody.innerHTML = '';

    if (pitStops.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No pit stop events recorded.</td></tr>';
      return;
    }

    pitStops.forEach((ps, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${idx + 1}</strong></td>
        <td>Lap ${ps.lap}</td>
        <td><strong>${ps.driver}</strong></td>
        <td>${ps.team || '--'}</td>
        <td>${ps.pit_in_time ? (ps.pit_in_time.toFixed ? ps.pit_in_time.toFixed(1) + 's' : ps.pit_in_time) : '--'}</td>
        <td><span style="color: ${TYRE_COLORS[(ps.compound || '').toUpperCase()] || '#E0E0E0'}; font-weight: 600;">${ps.compound || 'Fitted'}</span></td>
        <td style="text-align: right; font-weight: 700; color: var(--neon-yellow);">${ps.duration ? ps.duration.toFixed(3) + 's' : '--'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  pitYear.addEventListener('change', async () => {
    await loadScheduleForPits(pitYear.value);
    loadPitStrategy();
  });
  pitGP.addEventListener('change', loadPitStrategy);
  pitLoadBtn.addEventListener('click', loadPitStrategy);

  // --- TAB 5: WEATHER & CONDITIONS ---
  const wxYear = document.getElementById('weather-year-select');
  const wxGP = document.getElementById('weather-gp-select');
  const wxSession = document.getElementById('weather-session-select');
  const wxLoadBtn = document.getElementById('weather-load-btn');
  const wxLoader = document.getElementById('weather-loader');

  async function loadScheduleForWeather(year) {
    try {
      wxGP.innerHTML = '<option value="">Loading schedule...</option>';
      const res = await fetch(`/api/schedule/${year}/`);
      const schedule = await res.json();
      wxGP.innerHTML = '';
      schedule.forEach((ev, idx) => {
        const opt = new Option(`R${ev.RoundNumber}: ${ev.EventName}`, ev.EventName);
        if (idx === 0) opt.selected = true;
        wxGP.add(opt);
      });
    } catch (err) {
      console.error('Weather schedule load error:', err);
    }
  }

  async function loadWeatherConditions() {
    const year = wxYear.value;
    const gp = wxGP.value;
    const session = wxSession.value;

    if (!year || !gp) return;

    wxLoader.style.display = 'block';

    try {
      const res = await fetch(`/api/session_data/${year}/${encodeURIComponent(gp)}/?session=${encodeURIComponent(session)}`);
      const data = await res.json();
      renderWeatherConditions(data.weather);
    } catch (err) {
      console.error('Weather conditions error:', err);
    } finally {
      wxLoader.style.display = 'none';
    }
  }

  function renderWeatherConditions(weather) {
    if (!weather) {
      document.getElementById('wx-card-air').textContent = '-- °C';
      document.getElementById('wx-card-track').textContent = '-- °C';
      document.getElementById('wx-card-humidity').textContent = '-- %';
      document.getElementById('wx-card-rain').textContent = 'No Data';
      return;
    }

    document.getElementById('wx-card-air').textContent = weather.air_temp_avg ? `${weather.air_temp_avg.toFixed(1)} °C` : '-- °C';
    document.getElementById('wx-card-track').textContent = weather.track_temp_avg ? `${weather.track_temp_avg.toFixed(1)} °C` : '-- °C';
    document.getElementById('wx-card-track-sub').textContent = weather.track_temp_max ? `Peak: ${weather.track_temp_max.toFixed(1)} °C` : 'Session Peak';
    document.getElementById('wx-card-humidity').textContent = weather.humidity_avg ? `${weather.humidity_avg.toFixed(1)} %` : '-- %';

    if (weather.rainfall) {
      document.getElementById('wx-card-rain').textContent = 'Rain Recorded';
      document.getElementById('wx-card-rain').style.color = '#0067AD';
      document.getElementById('wx-card-rain-sub').textContent = 'Wet track conditions';
    } else {
      document.getElementById('wx-card-rain').textContent = 'Dry Track';
      document.getElementById('wx-card-rain').style.color = '#00C853';
      document.getElementById('wx-card-rain-sub').textContent = '0% Precipitation';
    }

    // Weather timeseries chart
    const ctx = document.getElementById('weatherTimeseriesChart').getContext('2d');
    if (charts.weatherTimeseries) charts.weatherTimeseries.destroy();

    charts.weatherTimeseries = new Chart(ctx, {
      type: 'line',
      data: {
        labels: weather.timeline || [],
        datasets: [
          {
            label: 'Track Temperature (°C)',
            data: weather.track_series || [],
            borderColor: '#FF1801',
            backgroundColor: 'rgba(255, 24, 1, 0.1)',
            borderWidth: 2,
            tension: 0.2
          },
          {
            label: 'Air Temperature (°C)',
            data: weather.air_series || [],
            borderColor: '#00D2BE',
            backgroundColor: 'rgba(0, 210, 190, 0.1)',
            borderWidth: 2,
            tension: 0.2
          },
          {
            label: 'Humidity (%)',
            data: weather.humidity_series || [],
            borderColor: '#FFEA00',
            borderWidth: 1.5,
            borderDash: [5, 5],
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#E0E0E0' } } },
        scales: {
          x: {
            title: { display: true, text: 'Session Elapsed Time', color: '#888' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#888', maxTicksLimit: 12 }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#888' }
          }
        }
      }
    });
  }

  wxYear.addEventListener('change', async () => {
    await loadScheduleForWeather(wxYear.value);
    loadWeatherConditions();
  });
  wxGP.addEventListener('change', loadWeatherConditions);
  wxSession.addEventListener('change', loadWeatherConditions);
  wxLoadBtn.addEventListener('click', loadWeatherConditions);

  // --- Initial Launch Setup ---
  const urlParams = new URLSearchParams(window.location.search);
  const activeTabParam = urlParams.get('tab');
  if (activeTabParam) {
    const targetBtn = document.querySelector(`.race-tab-btn[data-tab="${activeTabParam}"]`);
    if (targetBtn) targetBtn.click();
  }

  // Pre-load initial dropdowns
  loadDriversForComparison(dcompYear.value);
  loadScheduleForTyres(tyreYear.value);
  loadScheduleForPits(pitYear.value);
  loadScheduleForWeather(wxYear.value);
});
