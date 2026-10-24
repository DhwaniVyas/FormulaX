/**
 * FormulaX — Telemetry & Track Analysis Module
 * Synchronized multi-channel telemetry, lap comparison, circuit GPS map, and micro-sector pace.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Selectors
  const yearSelect = document.getElementById('tel-year-select');
  const gpSelect = document.getElementById('tel-gp-select');
  const sessionSelect = document.getElementById('tel-session-select');
  const d1Select = document.getElementById('tel-d1-select');
  const d2Select = document.getElementById('tel-d2-select');
  const lap1Select = document.getElementById('tel-lap1-select');
  const lap2Select = document.getElementById('tel-lap2-select');
  const analyzeBtn = document.getElementById('tel-analyze-btn');

  const loader = document.getElementById('tel-loader');
  const errorBox = document.getElementById('tel-error-box');
  const errorMsg = document.getElementById('tel-error-message');
  const mainContent = document.getElementById('tel-main-content');

  // Chart instances container
  const charts = {
    timeDelta: null,
    speed: null,
    throttle: null,
    gear: null,
    rpm: null,
    drs: null
  };

  // State
  let currentTelemetryData = null;
  let availableDriversMeta = [];

  // Team colors fallback dictionary
  const TEAM_COLORS = {
    'Red Bull Racing': '#3671C6',
    'Ferrari': '#E80020',
    'Mercedes': '#27F4D2',
    'McLaren': '#FF8000',
    'Aston Martin': '#229971',
    'Alpine': '#0093CC',
    'Williams': '#64C4FF',
    'AlphaTauri': '#5E8FAA',
    'RB': '#6692FF',
    'Sauber': '#52E252',
    'Kick Sauber': '#52E252',
    'Alfa Romeo': '#C92D4B',
    'Haas F1 Team': '#B6BABD'
  };

  function getDriverColor(driverAbbr, defaultColor) {
    const meta = availableDriversMeta.find(d => d.abbr === driverAbbr);
    if (meta && meta.team && TEAM_COLORS[meta.team]) {
      return TEAM_COLORS[meta.team];
    }
    return defaultColor;
  }

  // --- Initial Cascade Loaders ---
  async function loadSchedule(year) {
    try {
      gpSelect.innerHTML = '<option value="">Loading schedule...</option>';
      const res = await fetch(`/api/schedule/${year}/`);
      const schedule = await res.json();

      gpSelect.innerHTML = '';
      if (!schedule || schedule.length === 0) {
        gpSelect.innerHTML = '<option value="">No events found</option>';
        return;
      }

      schedule.forEach((ev, idx) => {
        const opt = document.createElement('option');
        opt.value = ev.EventName;
        opt.textContent = `R${ev.RoundNumber}: ${ev.EventName}`;
        if (idx === 0) opt.selected = true;
        gpSelect.appendChild(opt);
      });

      await loadSessions(year, gpSelect.value);
    } catch (err) {
      console.error('Failed to load schedule:', err);
      gpSelect.innerHTML = '<option value="">Error loading schedule</option>';
    }
  }

  async function loadSessions(year, gp) {
    if (!gp) return;
    try {
      const res = await fetch(`/api/sessions/${year}/${encodeURIComponent(gp)}/`);
      const data = await res.json();
      sessionSelect.innerHTML = '';
      const sessions = data.sessions || ['Practice 1', 'Practice 2', 'Practice 3', 'Qualifying', 'Race'];
      sessions.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        if (s.toLowerCase() === 'race') opt.selected = true;
        sessionSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  }

  function populateLapDropdown(selectEl, laps) {
    selectEl.innerHTML = '<option value="fastest">Fastest Lap</option>';
    if (laps && laps.length > 0) {
      laps.forEach(num => {
        const opt = document.createElement('option');
        opt.value = num;
        opt.textContent = `Lap ${num}`;
        selectEl.appendChild(opt);
      });
    }
  }

  function updateDriverDropdowns(drivers, selectedD1, selectedD2) {
    availableDriversMeta = drivers;
    d1Select.innerHTML = '';
    d2Select.innerHTML = '';

    drivers.forEach(d => {
      const opt1 = document.createElement('option');
      opt1.value = d.abbr;
      opt1.textContent = `${d.abbr} (${d.team || 'Driver'})`;
      d1Select.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = d.abbr;
      opt2.textContent = `${d.abbr} (${d.team || 'Driver'})`;
      d2Select.appendChild(opt2);
    });

    if (selectedD1 && drivers.some(d => d.abbr === selectedD1)) {
      d1Select.value = selectedD1;
    } else if (drivers.length > 0) {
      d1Select.selectedIndex = 0;
    }

    if (selectedD2 && drivers.some(d => d.abbr === selectedD2)) {
      d2Select.value = selectedD2;
    } else if (drivers.length > 1) {
      d2Select.selectedIndex = 1;
    }

    // Refresh lap dropdowns for chosen drivers
    refreshLapsForDrivers();
  }

  function refreshLapsForDrivers() {
    const d1Meta = availableDriversMeta.find(d => d.abbr === d1Select.value);
    const d2Meta = availableDriversMeta.find(d => d.abbr === d2Select.value);

    populateLapDropdown(lap1Select, d1Meta ? d1Meta.laps : []);
    populateLapDropdown(lap2Select, d2Meta ? d2Meta.laps : []);
  }

  // Event Listeners for cascading changes
  yearSelect.addEventListener('change', () => loadSchedule(yearSelect.value));
  gpSelect.addEventListener('change', () => loadSessions(yearSelect.value, gpSelect.value));
  d1Select.addEventListener('change', refreshLapsForDrivers);
  d2Select.addEventListener('change', refreshLapsForDrivers);

  analyzeBtn.addEventListener('click', fetchTelemetryData);

  // Tab Switching
  const tabBtns = document.querySelectorAll('.race-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(btn.getAttribute('data-tab'));
      if (targetPane) targetPane.classList.add('active');

      // Trigger resize on charts and canvas when switching tabs
      Object.values(charts).forEach(c => {
        if (c) c.resize();
      });
      if (btn.getAttribute('data-tab') === 'tab-circuit') {
        drawCircuitMap();
      }
    });
  });

  // Channel toggles
  document.getElementById('chk-speed').addEventListener('change', e => {
    document.getElementById('panel-speed').style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('chk-throttle').addEventListener('change', e => {
    document.getElementById('panel-throttle').style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('chk-gear').addEventListener('change', e => {
    document.getElementById('panel-gear').style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('chk-rpm').addEventListener('change', e => {
    document.getElementById('panel-rpm').style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('chk-drs').addEventListener('change', e => {
    document.getElementById('panel-drs').style.display = e.target.checked ? 'block' : 'none';
    if (e.target.checked && charts.drs) charts.drs.resize();
  });

  // --- Fetch Telemetry ---
  async function fetchTelemetryData() {
    const year = yearSelect.value;
    const gp = gpSelect.value;
    const session = sessionSelect.value;
    const d1 = d1Select.value;
    const d2 = d2Select.value;
    const lap1 = lap1Select.value;
    const lap2 = lap2Select.value;

    if (!gp) {
      alert('Please select a Grand Prix.');
      return;
    }

    loader.style.display = 'block';
    errorBox.style.display = 'none';

    let url = `/api/telemetry/${year}/${encodeURIComponent(gp)}/?session=${encodeURIComponent(session)}`;
    if (d1) url += `&driver1=${encodeURIComponent(d1)}`;
    if (d2) url += `&driver2=${encodeURIComponent(d2)}`;
    if (lap1 && lap1 !== 'fastest') url += `&lap1=${lap1}`;
    if (lap2 && lap2 !== 'fastest') url += `&lap2=${lap2}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to fetch telemetry (${res.status})`);
      }
      const data = await res.json();
      currentTelemetryData = data;

      // Update driver options if available from response
      if (data.available_drivers && data.available_drivers.length > 0) {
        updateDriverDropdowns(data.available_drivers, data.driver1, data.driver2);
      }

      renderTelemetryDashboard(data);
      mainContent.style.display = 'block';
    } catch (err) {
      console.error('Error fetching telemetry:', err);
      errorMsg.textContent = err.message || 'Telemetry data could not be retrieved.';
      errorBox.style.display = 'flex';
      mainContent.style.display = 'none';
    } finally {
      loader.style.display = 'none';
    }
  }

  // --- Render Dashboard ---
  function renderTelemetryDashboard(data) {
    const d1 = data.driver1;
    const d2 = data.driver2;
    const d1Lap = data.lap1;
    const d2Lap = data.lap2;

    // Header updates
    document.getElementById('tel-header-title').textContent = `${data.gp} — Telemetry Analysis`;
    document.getElementById('tel-header-subtitle').textContent =
      `${data.year} Season • ${data.session} • ${d1} (Lap ${d1Lap ? d1Lap.lap_number : '?'}) vs ${d2} (Lap ${d2Lap ? d2Lap.lap_number : '?'})`;

    document.getElementById('tel-badge-session').textContent = data.session;
    document.getElementById('tel-badge-d1').textContent = `Driver A: ${d1}`;
    document.getElementById('tel-badge-d2').textContent = `Driver B: ${d2}`;
    document.getElementById('tel-badge-mode').textContent = data.has_telemetry ? 'Full Car Telemetry' : 'Sector Timings Only';

    const colorD1 = getDriverColor(d1, '#00D2BE');
    const colorD2 = getDriverColor(d2, '#FF1801');

    document.getElementById('tel-badge-d1').style.color = colorD1;
    document.getElementById('tel-badge-d1').style.borderColor = colorD1;
    document.getElementById('tel-badge-d2').style.color = colorD2;
    document.getElementById('tel-badge-d2').style.borderColor = colorD2;

    // TAB 1: Lap Comparison
    renderLapComparison(data, colorD1, colorD2);

    // TAB 2: Telemetry Traces
    renderTelemetryTraces(data, colorD1, colorD2);

    // TAB 3: Circuit Map
    renderCircuitMapSection(data, colorD1, colorD2);

    // TAB 4: Micro-sectors
    renderMicroSectors(data, colorD1, colorD2);
  }

  // --- Format Helpers ---
  function formatDeltaSeconds(delta) {
    if (delta === null || delta === undefined || isNaN(delta)) return 'N/A';
    const sign = delta > 0 ? '+' : '';
    const color = delta < 0 ? '#00C853' : (delta > 0 ? '#FF1801' : '#E0E0E0');
    return `<span style="color: ${color}; font-weight: 600;">${sign}${delta.toFixed(3)}s</span>`;
  }

  function formatTime(sec) {
    if (sec === null || sec === undefined) return '--';
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(3);
    return m > 0 ? `${m}:${s < 10 ? '0' : ''}${s}` : `${s}s`;
  }

  // --- Tab 1: Lap Comparison ---
  function renderLapComparison(data, colorD1, colorD2) {
    const d1Lap = data.lap1 || {};
    const d2Lap = data.lap2 || {};

    const lapDelta = (d1Lap.lap_time && d2Lap.lap_time) ? (d1Lap.lap_time - d2Lap.lap_time) : null;
    const s1Delta = (d1Lap.sector1 && d2Lap.sector1) ? (d1Lap.sector1 - d2Lap.sector1) : null;
    const s2Delta = (d1Lap.sector2 && d2Lap.sector2) ? (d1Lap.sector2 - d2Lap.sector2) : null;
    const s3Delta = (d1Lap.sector3 && d2Lap.sector3) ? (d1Lap.sector3 - d2Lap.sector3) : null;

    document.getElementById('card-lap-delta').innerHTML = formatDeltaSeconds(lapDelta);
    document.getElementById('card-lap-sub').textContent = `${data.driver1} (${formatTime(d1Lap.lap_time)}) vs ${data.driver2} (${formatTime(d2Lap.lap_time)})`;

    document.getElementById('card-s1-delta').innerHTML = formatDeltaSeconds(s1Delta);
    document.getElementById('card-s1-sub').textContent = `S1: ${d1Lap.sector1 ? d1Lap.sector1.toFixed(3) : '--'}s vs ${d2Lap.sector1 ? d2Lap.sector1.toFixed(3) : '--'}s`;

    document.getElementById('card-s2-delta').innerHTML = formatDeltaSeconds(s2Delta);
    document.getElementById('card-s2-sub').textContent = `S2: ${d1Lap.sector2 ? d1Lap.sector2.toFixed(3) : '--'}s vs ${d2Lap.sector2 ? d2Lap.sector2.toFixed(3) : '--'}s`;

    document.getElementById('card-s3-delta').innerHTML = formatDeltaSeconds(s3Delta);
    document.getElementById('card-s3-sub').textContent = `S3: ${d1Lap.sector3 ? d1Lap.sector3.toFixed(3) : '--'}s vs ${d2Lap.sector3 ? d2Lap.sector3.toFixed(3) : '--'}s`;

    // Table
    document.getElementById('th-driver-a').textContent = `${data.driver1} (L${d1Lap.lap_number || '?'})`;
    document.getElementById('th-driver-b').textContent = `${data.driver2} (L${d2Lap.lap_number || '?'})`;

    const tbody = document.getElementById('lap-comparison-tbody');
    tbody.innerHTML = `
      <tr>
        <td><strong>Total Lap Time</strong></td>
        <td>${formatTime(d1Lap.lap_time)}</td>
        <td>${formatTime(d2Lap.lap_time)}</td>
        <td style="text-align: right;">${formatDeltaSeconds(lapDelta)}</td>
      </tr>
      <tr>
        <td>Sector 1</td>
        <td>${d1Lap.sector1 ? d1Lap.sector1.toFixed(3) + 's' : '--'}</td>
        <td>${d2Lap.sector1 ? d2Lap.sector1.toFixed(3) + 's' : '--'}</td>
        <td style="text-align: right;">${formatDeltaSeconds(s1Delta)}</td>
      </tr>
      <tr>
        <td>Sector 2</td>
        <td>${d1Lap.sector2 ? d1Lap.sector2.toFixed(3) + 's' : '--'}</td>
        <td>${d2Lap.sector2 ? d2Lap.sector2.toFixed(3) + 's' : '--'}</td>
        <td style="text-align: right;">${formatDeltaSeconds(s2Delta)}</td>
      </tr>
      <tr>
        <td>Sector 3</td>
        <td>${d1Lap.sector3 ? d1Lap.sector3.toFixed(3) + 's' : '--'}</td>
        <td>${d2Lap.sector3 ? d2Lap.sector3.toFixed(3) + 's' : '--'}</td>
        <td style="text-align: right;">${formatDeltaSeconds(s3Delta)}</td>
      </tr>
      <tr>
        <td>Speed Trap (ST)</td>
        <td>${d1Lap.speed_st ? d1Lap.speed_st.toFixed(1) + ' km/h' : '--'}</td>
        <td>${d2Lap.speed_st ? d2Lap.speed_st.toFixed(1) + ' km/h' : '--'}</td>
        <td style="text-align: right;">
          ${(d1Lap.speed_st && d2Lap.speed_st) ? (d1Lap.speed_st - d2Lap.speed_st > 0 ? '+' : '') + (d1Lap.speed_st - d2Lap.speed_st).toFixed(1) + ' km/h' : '--'}
        </td>
      </tr>
      <tr>
        <td>Finish Line Speed (FL)</td>
        <td>${d1Lap.speed_fl ? d1Lap.speed_fl.toFixed(1) + ' km/h' : '--'}</td>
        <td>${d2Lap.speed_fl ? d2Lap.speed_fl.toFixed(1) + ' km/h' : '--'}</td>
        <td style="text-align: right;">
          ${(d1Lap.speed_fl && d2Lap.speed_fl) ? (d1Lap.speed_fl - d2Lap.speed_fl > 0 ? '+' : '') + (d1Lap.speed_fl - d2Lap.speed_fl).toFixed(1) + ' km/h' : '--'}
        </td>
      </tr>
      <tr>
        <td>Tyre Compound &amp; Life</td>
        <td>${d1Lap.compound || 'N/A'} (${d1Lap.tyre_life || '?'} laps)</td>
        <td>${d2Lap.compound || 'N/A'} (${d2Lap.tyre_life || '?'} laps)</td>
        <td style="text-align: right;">--</td>
      </tr>
    `;

    // Time Delta Chart
    renderTimeDeltaChart(data, colorD1);
  }

  function renderTimeDeltaChart(data, colorD1) {
    const ctx = document.getElementById('timeDeltaChart').getContext('2d');
    if (charts.timeDelta) charts.timeDelta.destroy();

    const distance = data.distance || [];
    const timeDelta = data.time_delta || [];

    charts.timeDelta = new Chart(ctx, {
      type: 'line',
      data: {
        labels: distance,
        datasets: [{
          label: `Time Delta: ${data.driver1} − ${data.driver2} (s)`,
          data: timeDelta,
          borderColor: colorD1,
          backgroundColor: 'rgba(0, 200, 83, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          fill: true,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#E0E0E0' } },
          tooltip: {
            callbacks: {
              title: (items) => `Distance: ${Math.round(items[0].parsed.x)} m`,
              label: (item) => `Delta: ${item.parsed.y > 0 ? '+' : ''}${item.parsed.y.toFixed(3)}s`
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Distance (m)', color: '#888' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#888', maxTicksLimit: 10 }
          },
          y: {
            title: { display: true, text: 'Delta (s)', color: '#888' },
            grid: { color: 'rgba(255, 255, 255, 0.08)' },
            ticks: { color: '#888' }
          }
        }
      }
    });
  }

  // --- Tab 2: Telemetry Traces ---
  function renderTelemetryTraces(data, colorD1, colorD2) {
    const distance = data.distance || [];
    const tel1 = data.telemetry1 || {};
    const tel2 = data.telemetry2 || {};

    const commonScales = {
      x: {
        title: { display: false },
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#888', maxTicksLimit: 12 }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#888' }
      }
    };

    // 1. Speed Chart
    const ctxSpeed = document.getElementById('speedTraceChart').getContext('2d');
    if (charts.speed) charts.speed.destroy();
    charts.speed = new Chart(ctxSpeed, {
      type: 'line',
      data: {
        labels: distance,
        datasets: [
          {
            label: `${data.driver1} Speed (km/h)`,
            data: tel1.speed || [],
            borderColor: colorD1,
            borderWidth: 2,
            pointRadius: 0
          },
          {
            label: `${data.driver2} Speed (km/h)`,
            data: tel2.speed || [],
            borderColor: colorD2,
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: '#E0E0E0' } } },
        scales: commonScales
      }
    });

    // 2. Throttle & Brake Chart
    const ctxThrottle = document.getElementById('throttleTraceChart').getContext('2d');
    if (charts.throttle) charts.throttle.destroy();
    charts.throttle = new Chart(ctxThrottle, {
      type: 'line',
      data: {
        labels: distance,
        datasets: [
          {
            label: `${data.driver1} Throttle (%)`,
            data: tel1.throttle || [],
            borderColor: colorD1,
            borderWidth: 2,
            pointRadius: 0
          },
          {
            label: `${data.driver2} Throttle (%)`,
            data: tel2.throttle || [],
            borderColor: colorD2,
            borderWidth: 2,
            pointRadius: 0
          },
          {
            label: `${data.driver1} Brake`,
            data: (tel1.brake || []).map(b => b ? 100 : 0),
            borderColor: 'rgba(255, 24, 1, 0.5)',
            backgroundColor: 'rgba(255, 24, 1, 0.1)',
            borderWidth: 1,
            fill: true,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: '#E0E0E0' } } },
        scales: {
          x: commonScales.x,
          y: {
            min: 0,
            max: 105,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#888' }
          }
        }
      }
    });

    // 3. Gear Chart
    const ctxGear = document.getElementById('gearTraceChart').getContext('2d');
    if (charts.gear) charts.gear.destroy();
    charts.gear = new Chart(ctxGear, {
      type: 'line',
      data: {
        labels: distance,
        datasets: [
          {
            label: `${data.driver1} Gear`,
            data: tel1.gear || [],
            borderColor: colorD1,
            stepped: true,
            borderWidth: 2,
            pointRadius: 0
          },
          {
            label: `${data.driver2} Gear`,
            data: tel2.gear || [],
            borderColor: colorD2,
            stepped: true,
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: '#E0E0E0' } } },
        scales: {
          x: commonScales.x,
          y: {
            min: 1,
            max: 8,
            ticks: { stepSize: 1, color: '#888' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });

    // 4. RPM Chart
    const ctxRpm = document.getElementById('rpmTraceChart').getContext('2d');
    if (charts.rpm) charts.rpm.destroy();
    charts.rpm = new Chart(ctxRpm, {
      type: 'line',
      data: {
        labels: distance,
        datasets: [
          {
            label: `${data.driver1} RPM`,
            data: tel1.rpm || [],
            borderColor: colorD1,
            borderWidth: 1.5,
            pointRadius: 0
          },
          {
            label: `${data.driver2} RPM`,
            data: tel2.rpm || [],
            borderColor: colorD2,
            borderWidth: 1.5,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: '#E0E0E0' } } },
        scales: commonScales
      }
    });

    // 5. DRS Chart
    const ctxDrs = document.getElementById('drsTraceChart').getContext('2d');
    if (charts.drs) charts.drs.destroy();
    charts.drs = new Chart(ctxDrs, {
      type: 'line',
      data: {
        labels: distance,
        datasets: [
          {
            label: `${data.driver1} DRS`,
            data: tel1.drs || [],
            borderColor: colorD1,
            stepped: true,
            borderWidth: 2,
            pointRadius: 0
          },
          {
            label: `${data.driver2} DRS`,
            data: tel2.drs || [],
            borderColor: colorD2,
            stepped: true,
            borderWidth: 2,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#E0E0E0' } } },
        scales: {
          x: commonScales.x,
          y: {
            min: 0,
            max: 14,
            ticks: { color: '#888' },
            grid: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  }

  // --- Tab 3: Circuit Map & Point Inspector ---
  let circuitCoords = [];
  let trackSlider = document.getElementById('track-distance-slider');

  function renderCircuitMapSection(data, colorD1, colorD2) {
    document.getElementById('inspector-d1-title').textContent = data.driver1;
    document.getElementById('inspector-d1-title').style.color = colorD1;
    document.getElementById('inspector-d2-title').textContent = data.driver2;
    document.getElementById('inspector-d2-title').style.color = colorD2;

    const canvas = document.getElementById('circuitCanvas');
    const fallback = document.getElementById('circuit-fallback-msg');

    if (data.circuit_x && data.circuit_y && data.circuit_x.length > 10) {
      canvas.style.display = 'block';
      fallback.style.display = 'none';

      // Pair coordinates
      circuitCoords = data.circuit_x.map((x, i) => ({
        x: x,
        y: data.circuit_y[i],
        dist: data.distance[i] || 0
      }));

      const maxDist = data.distance[data.distance.length - 1] || 5000;
      trackSlider.max = data.distance.length - 1;
      trackSlider.value = 0;
      document.getElementById('slider-dist-max').textContent = `${Math.round(maxDist)}m`;

      drawCircuitMap(0);
    } else {
      canvas.style.display = 'none';
      fallback.style.display = 'block';
    }
  }

  function drawCircuitMap(pointIndex = 0) {
    const canvas = document.getElementById('circuitCanvas');
    if (!canvas || !circuitCoords || circuitCoords.length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Padding
    const pad = 40;
    const drawW = width - pad * 2;
    const drawH = height - pad * 2;

    // Draw main track outline
    ctx.beginPath();
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    circuitCoords.forEach((pt, i) => {
      const px = pad + pt.x * drawW;
      const py = pad + (1.0 - pt.y) * drawH; // flip Y
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();

    // Inner racing line
    ctx.beginPath();
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 4;
    circuitCoords.forEach((pt, i) => {
      const px = pad + pt.x * drawW;
      const py = pad + (1.0 - pt.y) * drawH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.stroke();

    // Start / Finish line marker
    if (circuitCoords.length > 0) {
      const startPt = circuitCoords[0];
      const sx = pad + startPt.x * drawW;
      const sy = pad + (1.0 - startPt.y) * drawH;
      ctx.fillStyle = '#FFEA00';
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Current selected distance point
    if (pointIndex >= 0 && pointIndex < circuitCoords.length) {
      const curPt = circuitCoords[pointIndex];
      const cx = pad + curPt.x * drawW;
      const cy = pad + (1.0 - curPt.y) * drawH;

      ctx.fillStyle = '#00D2BE';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Slider change handler
  trackSlider.addEventListener('input', e => {
    const idx = parseInt(e.target.value, 10);
    drawCircuitMap(idx);
    updatePointInspector(idx);
  });

  function updatePointInspector(idx) {
    if (!currentTelemetryData) return;
    const d = currentTelemetryData;
    const dist = d.distance[idx] || 0;
    document.getElementById('slider-dist-val').textContent = `Distance: ${Math.round(dist)}m`;

    const tel1 = d.telemetry1 || {};
    const tel2 = d.telemetry2 || {};

    const s1 = tel1.speed ? tel1.speed[idx] : null;
    const s2 = tel2.speed ? tel2.speed[idx] : null;
    const t1 = tel1.throttle ? tel1.throttle[idx] : null;
    const t2 = tel2.throttle ? tel2.throttle[idx] : null;
    const b1 = tel1.brake ? (tel1.brake[idx] ? 'ON' : 'OFF') : '--';
    const b2 = tel2.brake ? (tel2.brake[idx] ? 'ON' : 'OFF') : '--';
    const g1 = tel1.gear ? tel1.gear[idx] : '--';
    const g2 = tel2.gear ? tel2.gear[idx] : '--';
    const r1 = tel1.rpm ? Math.round(tel1.rpm[idx]) : '--';
    const r2 = tel2.rpm ? Math.round(tel2.rpm[idx]) : '--';

    document.getElementById('insp-d1-speed').textContent = s1 !== null ? `${s1.toFixed(1)} km/h` : '--';
    document.getElementById('insp-d2-speed').textContent = s2 !== null ? `${s2.toFixed(1)} km/h` : '--';
    document.getElementById('insp-d1-throttle').textContent = t1 !== null ? `${Math.round(t1)}%` : '--';
    document.getElementById('insp-d2-throttle').textContent = t2 !== null ? `${Math.round(t2)}%` : '--';
    document.getElementById('insp-d1-brake').textContent = b1;
    document.getElementById('insp-d2-brake').textContent = b2;
    document.getElementById('insp-d1-gear').textContent = g1;
    document.getElementById('insp-d2-gear').textContent = g2;
    document.getElementById('insp-d1-rpm').textContent = r1;
    document.getElementById('insp-d2-rpm').textContent = r2;

    const advText = document.getElementById('insp-advantage-text');
    if (s1 !== null && s2 !== null) {
      const diff = s1 - s2;
      if (Math.abs(diff) < 2) {
        advText.textContent = `Equal speed entry at ${Math.round(dist)}m (${s1.toFixed(1)} km/h vs ${s2.toFixed(1)} km/h).`;
      } else if (diff > 0) {
        advText.innerHTML = `<strong>${d.driver1}</strong> is <span style="color: #00C853;">+${diff.toFixed(1)} km/h faster</span> at this track position.`;
      } else {
        advText.innerHTML = `<strong>${d.driver2}</strong> is <span style="color: #FF1801;">+${Math.abs(diff).toFixed(1)} km/h faster</span> at this track position.`;
      }
    }
  }

  // --- Tab 4: Micro-sectors Analysis ---
  function renderMicroSectors(data, colorD1, colorD2) {
    const segments = data.micro_sectors || [];
    const strip = document.getElementById('microsector-strip');
    const tbody = document.getElementById('microsector-tbody');
    strip.innerHTML = '';
    tbody.innerHTML = '';

    document.getElementById('th-ms-d1').textContent = `${data.driver1} Avg Speed`;
    document.getElementById('th-ms-d2').textContent = `${data.driver2} Avg Speed`;

    if (segments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No micro-sector data available.</td></tr>';
      return;
    }

    segments.forEach(seg => {
      // Cell in visual strip
      const cell = document.createElement('div');
      cell.title = `Seg ${seg.segment}: ${Math.round(seg.start_m)}m–${Math.round(seg.end_m)}m (${seg.speed_delta > 0 ? '+' : ''}${seg.speed_delta.toFixed(1)} km/h)`;
      cell.style.transition = 'all 0.2s';
      cell.style.cursor = 'pointer';

      let advBadge = '';
      if (seg.speed_delta > 3) {
        cell.style.background = '#00C853';
        advBadge = `<span style="color: #00C853; font-weight: 600;">${data.driver1} (+${seg.speed_delta.toFixed(1)} km/h)</span>`;
      } else if (seg.speed_delta < -3) {
        cell.style.background = '#FF1801';
        advBadge = `<span style="color: #FF1801; font-weight: 600;">${data.driver2} (+${Math.abs(seg.speed_delta).toFixed(1)} km/h)</span>`;
      } else {
        cell.style.background = '#444444';
        advBadge = `<span style="color: #888;">Even (&plusmn;3 km/h)</span>`;
      }
      strip.appendChild(cell);

      // Table row
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${seg.segment}</strong></td>
        <td>${Math.round(seg.start_m)}m – ${Math.round(seg.end_m)}m</td>
        <td>${seg.driver1_speed.toFixed(1)} km/h</td>
        <td>${seg.driver2_speed.toFixed(1)} km/h</td>
        <td>${seg.speed_delta > 0 ? '+' : ''}${seg.speed_delta.toFixed(1)} km/h</td>
        <td style="text-align: right;">${advBadge}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // --- Initial Launch from URL Query Parameters ---
  const urlParams = new URLSearchParams(window.location.search);
  const initialYear = urlParams.get('year') || yearSelect.value;
  const initialGP = urlParams.get('gp');
  const initialSession = urlParams.get('session') || 'Race';

  yearSelect.value = initialYear;
  loadSchedule(initialYear).then(() => {
    if (initialGP) {
      gpSelect.value = initialGP;
      loadSessions(initialYear, initialGP).then(() => {
        if (initialSession) sessionSelect.value = initialSession;
        // Auto-analyze if GP specified
        fetchTelemetryData();
      });
    } else {
      // Auto analyze first available GP
      fetchTelemetryData();
    }
  });

});
