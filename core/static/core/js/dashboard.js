/**
 * FormulaX — Race Center Script
 * Coordinated selectors, 5-tab switching, full classification,
 * lap pace analysis, pit stop transit, and weather conditions.
 */

const F1_TEAM_COLORS = {
    "Red Bull Racing": "#0600EF",
    "Mercedes": "#00D2BE",
    "Ferrari": "#DC0000",
    "McLaren": "#FF8700",
    "Aston Martin": "#006F62",
    "Alpine": "#0090FF",
    "Williams": "#005AFF",
    "AlphaTauri": "#2B4562",
    "Haas F1 Team": "#FFFFFF",
    "Alfa Romeo": "#900000",
    "RB": "#6692FF",
    "Racing Bulls": "#6692FF",
    "Kick Sauber": "#52E252",
    "Sauber": "#52E252",
    "Audi": "#E00613",
    "Cadillac": "#FFD700"
};

const TYRE_COLORS = {
    "SOFT": "#EC0000",
    "MEDIUM": "#F0D002",
    "HARD": "#FFFFFF",
    "INTERMEDIATE": "#43B02A",
    "WET": "#0067AD",
    "UNKNOWN": "#888888"
};

// State
let currentSchedule = [];
let currentSessionData = null;
let currentLapsMap = {}; // driver -> [laps]
let overviewTyreChart = null;
let lapProgressionChart = null;
let weatherTimelineChart = null;
let activeTabId = 'tab-overview';

document.addEventListener('DOMContentLoaded', () => {
    initRaceCenter();
});

async function initRaceCenter() {
    const yearSelect = document.getElementById('rc-year-select');
    const gpSelect = document.getElementById('rc-gp-select');
    const sessionSelect = document.getElementById('rc-session-select');
    const loadBtn = document.getElementById('rc-load-btn');

    // 1. Setup Tab Switching
    document.querySelectorAll('.race-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = e.target.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    // 2. Selectors Change Handlers
    yearSelect.addEventListener('change', async () => {
        await populateGpSelector(yearSelect.value);
    });

    gpSelect.addEventListener('change', () => {
        populateSessionSelector();
    });

    loadBtn.addEventListener('click', () => {
        const year = yearSelect.value;
        const gp = gpSelect.value;
        const session = sessionSelect.value;
        if (year && gp && session) {
            loadSessionData(year, gp, session);
        }
    });

    // 3. Driver comparison change in Lap Analysis tab
    const driver1Select = document.getElementById('lap-driver-1');
    const driver2Select = document.getElementById('lap-driver-2');
    if (driver1Select) {
        driver1Select.addEventListener('change', () => onDriverSelectionChanged());
    }
    if (driver2Select) {
        driver2Select.addEventListener('change', () => onDriverSelectionChanged());
    }

    // 4. Initial Schedule Load
    const initialYear = INITIAL_YEAR || yearSelect.value;
    yearSelect.value = initialYear;
    await populateGpSelector(initialYear, INITIAL_GP, INITIAL_SESSION);
}

function switchTab(tabId) {
    activeTabId = tabId;

    // Update buttons
    document.querySelectorAll('.race-tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        if (pane.id === tabId) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });

    // Resize active charts if tab changes
    if (tabId === 'tab-laps' && lapProgressionChart) {
        lapProgressionChart.resize();
    }
    if (tabId === 'tab-conditions' && weatherTimelineChart) {
        weatherTimelineChart.resize();
    }
    if (tabId === 'tab-overview' && overviewTyreChart) {
        overviewTyreChart.resize();
    }
}

async function populateGpSelector(year, preferredGp, preferredSession) {
    const gpSelect = document.getElementById('rc-gp-select');
    gpSelect.innerHTML = '<option value="">Loading schedule...</option>';

    try {
        const res = await fetch(`/api/schedule/${year}/`);
        if (!res.ok) throw new Error('Schedule fetch failed');
        currentSchedule = await res.json();

        gpSelect.innerHTML = '';
        if (currentSchedule.length === 0) {
            gpSelect.innerHTML = '<option value="">No events found</option>';
            return;
        }

        let selectedIndex = 0;
        currentSchedule.forEach((ev, idx) => {
            const opt = document.createElement('option');
            opt.value = ev.EventName;
            opt.textContent = `Round ${ev.RoundNumber}: ${ev.EventName}`;
            if (preferredGp && (ev.EventName.toLowerCase() === preferredGp.toLowerCase())) {
                opt.selected = true;
                selectedIndex = idx;
            }
            gpSelect.appendChild(opt);
        });

        populateSessionSelector(preferredSession);

        // Load the session automatically on initial render
        const initialGp = gpSelect.value;
        const sessionSelect = document.getElementById('rc-session-select');
        const initialSession = sessionSelect.value || 'Race';
        if (initialGp) {
            loadSessionData(year, initialGp, initialSession);
        }
    } catch (err) {
        console.error('Error populating GP selector:', err);
        gpSelect.innerHTML = '<option value="">Error loading schedule</option>';
    }
}

function populateSessionSelector(preferredSession) {
    const gpSelect = document.getElementById('rc-gp-select');
    const sessionSelect = document.getElementById('rc-session-select');
    const selectedGpName = gpSelect.value;

    const eventObj = currentSchedule.find(ev => ev.EventName === selectedGpName);
    sessionSelect.innerHTML = '';

    const availableSessions = (eventObj && eventObj.Sessions && eventObj.Sessions.length > 0)
        ? eventObj.Sessions
        : ['Practice 1', 'Practice 2', 'Practice 3', 'Qualifying', 'Race'];

    availableSessions.forEach(sName => {
        const opt = document.createElement('option');
        opt.value = sName;
        opt.textContent = sName;
        if (preferredSession && (sName.toLowerCase() === preferredSession.toLowerCase())) {
            opt.selected = true;
        } else if (!preferredSession && sName.toLowerCase() === 'race') {
            opt.selected = true;
        }
        sessionSelect.appendChild(opt);
    });

    if (!sessionSelect.value && sessionSelect.options.length > 0) {
        sessionSelect.selectedIndex = sessionSelect.options.length - 1; // Default to last session (usually Race)
    }
}

async function loadSessionData(year, gp, session) {
    const loader = document.getElementById('rc-loader');
    const errorBox = document.getElementById('rc-error-box');
    const errorMsg = document.getElementById('rc-error-message');
    const mainContent = document.getElementById('rc-main-content');

    loader.style.display = 'block';
    errorBox.style.display = 'none';
    mainContent.style.display = 'none';

    // Update URL parameters without reloading
    const newUrl = `${window.location.pathname}?year=${year}&gp=${encodeURIComponent(gp)}&session=${encodeURIComponent(session)}`;
    window.history.replaceState({ year, gp, session }, '', newUrl);

    try {
        const response = await fetch(`/api/session_data/${year}/${encodeURIComponent(gp)}/?session=${encodeURIComponent(session)}`);
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        const data = await response.json();
        currentSessionData = data;

        renderSession(data);
        mainContent.style.display = 'block';
    } catch (err) {
        console.error('Error loading session data:', err);
        errorMsg.textContent = `Could not load data for ${year} ${gp} (${session}). Telemetry or results may not be available for this session.`;
        errorBox.style.display = 'flex';
    } finally {
        loader.style.display = 'none';
    }
}

function renderSession(data) {
    // 1. Race Header
    document.getElementById('rc-header-title').textContent = `${data.year} ${data.gp}`;
    const dateStr = data.date ? new Date(data.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'Official Timing';
    document.getElementById('rc-header-subtitle').textContent = `${data.gp} • ${dateStr}`;
    document.getElementById('rc-badge-session').textContent = data.session_name || data.session_type;
    document.getElementById('rc-badge-date').textContent = dateStr;
    document.getElementById('rc-badge-status').textContent = data.results && data.results.length > 0 ? 'Official Result' : 'No Classification';

    // 2. Summary Metric Cards
    const isQuali = (data.session_name || '').toLowerCase().includes('qualifying');
    const isPractice = (data.session_name || '').toLowerCase().includes('practice');

    const leaderTitle = document.getElementById('summary-leader-title');
    if (isQuali) leaderTitle.textContent = 'Pole Position';
    else if (isPractice) leaderTitle.textContent = 'Session P1 Leader';
    else leaderTitle.textContent = 'Race Winner';

    document.getElementById('summary-leader-val').textContent = data.session_leader || 'N/A';
    document.getElementById('summary-leader-sub').textContent = data.session_leader_team || 'Classification Leader';

    const flDriver = data.fastest_lap_driver || 'N/A';
    const flTime = formatLapTime(data.fastest_lap_time);
    document.getElementById('summary-fastest-lap-time').textContent = flTime;
    document.getElementById('summary-fastest-lap-sub').textContent = `${flDriver} (Fastest Lap)`;

    document.getElementById('summary-classified-val').textContent = `${data.classified_count || 0} / ${data.total_drivers || 0}`;
    document.getElementById('summary-laps-val').textContent = `${data.total_laps || 0} Laps`;

    // 3. Render Individual Tabs
    renderTabOverview(data);
    renderTabClassification(data);
    setupLapAnalysisTab(data);
    renderTabPitStops(data);
    renderTabConditions(data);
}

/* ==========================================================================
   TAB 1: Overview
   ========================================================================== */

function renderTabOverview(data) {
    // Podium / Leaders Cards
    const podiumContainer = document.getElementById('overview-podium-container');
    const results = data.results || [];
    const top3 = results.slice(0, 3);

    if (top3.length > 0) {
        podiumContainer.innerHTML = top3.map((r, i) => {
            const pos = i + 1;
            const teamColor = F1_TEAM_COLORS[r.TeamName] || '#888888';
            return `
                <div class="podium-box ${pos === 1 ? 'p1' : ''}">
                    <div class="p-pos pos-${pos}" style="display:inline-block; border-radius:50%; width:26px; height:26px; line-height:26px; font-size:0.8rem; margin-bottom: 0.35rem;">
                        ${pos}
                    </div>
                    <div class="p-driver">${r.BroadcastName || r.Abbreviation}</div>
                    <div class="p-team">
                        <span class="team-color-dot" style="background-color: ${teamColor};"></span>
                        ${r.TeamName}
                    </div>
                </div>
            `;
        }).join('');
    } else {
        podiumContainer.innerHTML = '<p style="color: var(--text-muted); padding: 1rem;">No classified leaders for this session.</p>';
    }

    // Top 5 Classification Preview Table
    const previewTbody = document.querySelector('#overview-preview-table tbody');
    const top5 = results.slice(0, 5);
    if (top5.length > 0) {
        previewTbody.innerHTML = top5.map(r => {
            const teamColor = F1_TEAM_COLORS[r.TeamName] || '#888888';
            return `
                <tr>
                    <td><span class="pos-badge ${r.Position === 1 ? 'pos-1' : (r.Position === 2 ? 'pos-2' : (r.Position === 3 ? 'pos-3' : ''))}">${r.Position || '-'}</span></td>
                    <td><strong style="color: #FFFFFF;">${r.BroadcastName}</strong> (${r.Abbreviation})</td>
                    <td>
                        <span class="team-pill">
                            <span class="team-color-dot" style="background-color: ${teamColor};"></span>
                            ${r.TeamName}
                        </span>
                    </td>
                    <td style="text-align: right;">${formatStatusOrTime(r, results[0])}</td>
                </tr>
            `;
        }).join('');
    } else {
        previewTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No classification data available.</td></tr>`;
    }

    // Compound Tyre Chart
    renderOverviewTyreChart(data.laps || []);
}

function renderOverviewTyreChart(laps) {
    const canvas = document.getElementById('overviewTyreChart');
    if (!canvas) return;

    if (overviewTyreChart) overviewTyreChart.destroy();

    const compoundCounts = {};
    laps.forEach(l => {
        const comp = (l.Compound || 'UNKNOWN').toUpperCase();
        compoundCounts[comp] = (compoundCounts[comp] || 0) + 1;
    });

    const labels = Object.keys(compoundCounts);
    const counts = Object.values(compoundCounts);
    const bgColors = labels.map(c => TYRE_COLORS[c] || TYRE_COLORS['UNKNOWN']);

    if (labels.length === 0) {
        return;
    }

    const ctx = canvas.getContext('2d');
    overviewTyreChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: bgColors,
                borderColor: '#1E1E1E',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#E0E0E0', boxWidth: 12, padding: 10 }
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return ` ${ctx.label}: ${ctx.raw} laps`;
                        }
                    }
                }
            }
        }
    });
}

/* ==========================================================================
   TAB 2: Classification Table
   ========================================================================== */

function renderTabClassification(data) {
    const thead = document.getElementById('full-classification-thead');
    const tbody = document.getElementById('full-classification-tbody');
    const title = document.getElementById('classification-table-title');
    const badge = document.getElementById('classification-total-badge');

    const results = data.results || [];
    badge.textContent = `${results.length} Classified Drivers`;

    const isQuali = (data.session_name || '').toLowerCase().includes('qualifying');
    const isPractice = (data.session_name || '').toLowerCase().includes('practice');

    if (isQuali) {
        title.textContent = 'Qualifying Session Classification';
        thead.innerHTML = `
            <tr>
                <th style="width: 50px;">Pos</th>
                <th style="width: 50px;">No</th>
                <th>Driver</th>
                <th>Constructor</th>
                <th style="text-align: right;">Q1</th>
                <th style="text-align: right;">Q2</th>
                <th style="text-align: right;">Q3</th>
                <th style="text-align: center;">Laps</th>
            </tr>
        `;

        tbody.innerHTML = results.map(r => {
            const teamColor = F1_TEAM_COLORS[r.TeamName] || '#888888';
            return `
                <tr>
                    <td><span class="pos-badge ${r.Position === 1 ? 'pos-1' : (r.Position === 2 ? 'pos-2' : (r.Position === 3 ? 'pos-3' : ''))}">${r.Position || '-'}</span></td>
                    <td style="color: var(--text-muted); font-weight: 700;">#${r.DriverNumber || '-'}</td>
                    <td>
                        <div class="driver-cell">
                            <span class="driver-abbr">${r.Abbreviation}</span>
                            <span class="driver-fullname">${r.BroadcastName}</span>
                        </div>
                    </td>
                    <td>
                        <span class="team-pill">
                            <span class="team-color-dot" style="background-color: ${teamColor};"></span>
                            ${r.TeamName}
                        </span>
                    </td>
                    <td style="text-align: right; font-family: monospace;">${formatLapTime(r.Q1)}</td>
                    <td style="text-align: right; font-family: monospace;">${formatLapTime(r.Q2)}</td>
                    <td style="text-align: right; font-family: monospace; font-weight: 700; color: #FFFFFF;">${formatLapTime(r.Q3)}</td>
                    <td style="text-align: center; color: var(--text-muted);">${r.Laps || '-'}</td>
                </tr>
            `;
        }).join('');
    } else {
        // Race or Practice
        title.textContent = isPractice ? 'Practice Session Classification' : 'Official Grand Prix Race Classification';
        thead.innerHTML = `
            <tr>
                <th style="width: 50px;">Pos</th>
                <th style="width: 50px;">No</th>
                <th>Driver</th>
                <th>Constructor</th>
                ${!isPractice ? '<th style="width: 60px; text-align: center;">Grid</th>' : ''}
                <th style="text-align: right;">Time / Gap</th>
                <th style="text-align: center;">Status</th>
                ${!isPractice ? '<th style="width: 70px; text-align: right;">Points</th>' : ''}
                <th style="width: 60px; text-align: center;">Laps</th>
            </tr>
        `;

        tbody.innerHTML = results.map(r => {
            const teamColor = F1_TEAM_COLORS[r.TeamName] || '#888888';
            let statusBadge = '<span class="badge-status status-finished">Finished</span>';
            const status = (r.Status || 'Finished');
            if (status.includes('+') || status.toLowerCase().includes('lap')) {
                statusBadge = `<span class="badge-status status-lapped">${status}</span>`;
            } else if (status !== 'Finished') {
                statusBadge = `<span class="badge-status status-dnf">${status}</span>`;
            }

            return `
                <tr>
                    <td><span class="pos-badge ${r.Position === 1 ? 'pos-1' : (r.Position === 2 ? 'pos-2' : (r.Position === 3 ? 'pos-3' : ''))}">${r.Position || '-'}</span></td>
                    <td style="color: var(--text-muted); font-weight: 700;">#${r.DriverNumber || '-'}</td>
                    <td>
                        <div class="driver-cell">
                            <span class="driver-abbr">${r.Abbreviation}</span>
                            <span class="driver-fullname">${r.BroadcastName}</span>
                        </div>
                    </td>
                    <td>
                        <span class="team-pill">
                            <span class="team-color-dot" style="background-color: ${teamColor};"></span>
                            ${r.TeamName}
                        </span>
                    </td>
                    ${!isPractice ? `<td style="text-align: center; color: var(--text-muted);">${r.GridPosition || '-'}</td>` : ''}
                    <td style="text-align: right; font-family: monospace;">${formatStatusOrTime(r, results[0])}</td>
                    <td style="text-align: center;">${statusBadge}</td>
                    ${!isPractice ? `<td style="text-align: right;" class="points-val">${r.Points != null ? Math.round(r.Points) : 0}</td>` : ''}
                    <td style="text-align: center; color: var(--text-muted);">${r.Laps || '-'}</td>
                </tr>
            `;
        }).join('');
    }
}

/* ==========================================================================
   TAB 3: Lap Analysis & Progression
   ========================================================================== */

function setupLapAnalysisTab(data) {
    const d1Select = document.getElementById('lap-driver-1');
    const d2Select = document.getElementById('lap-driver-2');
    const results = data.results || [];

    // Index laps by driver
    currentLapsMap = {};
    (data.laps || []).forEach(lap => {
        const d = lap.Driver;
        if (!currentLapsMap[d]) currentLapsMap[d] = [];
        currentLapsMap[d].push(lap);
    });

    d1Select.innerHTML = '';
    d2Select.innerHTML = '<option value="none">None (Single Driver)</option>';

    results.forEach((r, idx) => {
        const opt1 = document.createElement('option');
        opt1.value = r.Abbreviation;
        opt1.textContent = `${r.BroadcastName} (${r.Abbreviation})`;
        if (idx === 0) opt1.selected = true;
        d1Select.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = r.Abbreviation;
        opt2.textContent = `${r.BroadcastName} (${r.Abbreviation})`;
        d2Select.appendChild(opt2);
    });

    onDriverSelectionChanged();
}

function onDriverSelectionChanged() {
    const d1 = document.getElementById('lap-driver-1').value;
    const d2 = document.getElementById('lap-driver-2').value;

    if (!d1) return;

    renderLapProgressionChart(d1, d2);
    renderDriverLapsTable(d1);
}

function renderLapProgressionChart(driver1Abbr, driver2Abbr) {
    const canvas = document.getElementById('lapProgressionChart');
    if (!canvas) return;

    if (lapProgressionChart) lapProgressionChart.destroy();

    const laps1 = (currentLapsMap[driver1Abbr] || []).filter(l => l.LapTime && l.LapTime > 0);
    const datasets = [];

    // Dataset 1
    const driver1Res = (currentSessionData.results || []).find(r => r.Abbreviation === driver1Abbr);
    const team1 = driver1Res ? driver1Res.TeamName : '';
    const color1 = F1_TEAM_COLORS[team1] || '#FF1801';

    datasets.push({
        label: `${driver1Abbr} Pace`,
        data: laps1.map(l => ({ x: l.LapNumber, y: l.LapTime })),
        borderColor: color1,
        backgroundColor: color1,
        borderWidth: 2,
        pointRadius: laps1.map(l => l.IsPersonalBest ? 5 : 2.5),
        pointBackgroundColor: laps1.map(l => l.IsPersonalBest ? '#FFEA00' : color1),
        pointBorderColor: laps1.map(l => l.IsPersonalBest ? '#000000' : color1),
        tension: 0.1
    });

    // Dataset 2 (Optional comparison)
    if (driver2Abbr && driver2Abbr !== 'none' && driver2Abbr !== driver1Abbr) {
        const laps2 = (currentLapsMap[driver2Abbr] || []).filter(l => l.LapTime && l.LapTime > 0);
        const driver2Res = (currentSessionData.results || []).find(r => r.Abbreviation === driver2Abbr);
        const team2 = driver2Res ? driver2Res.TeamName : '';
        let color2 = F1_TEAM_COLORS[team2] || '#2979FF';
        if (color2 === color1) color2 = '#00E676'; // Prevent exact color collision

        datasets.push({
            label: `${driver2Abbr} Pace`,
            data: laps2.map(l => ({ x: l.LapNumber, y: l.LapTime })),
            borderColor: color2,
            backgroundColor: color2,
            borderWidth: 2,
            pointRadius: laps2.map(l => l.IsPersonalBest ? 5 : 2.5),
            pointBackgroundColor: laps2.map(l => l.IsPersonalBest ? '#FFEA00' : color2),
            tension: 0.1
        });
    }

    const ctx = canvas.getContext('2d');
    lapProgressionChart = new Chart(ctx, {
        type: 'line',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Lap Number', color: '#9E9E9E' },
                    grid: { color: '#2A2A2A' },
                    ticks: { color: '#9E9E9E', stepSize: 5 }
                },
                y: {
                    title: { display: true, text: 'Lap Time', color: '#9E9E9E' },
                    grid: { color: '#2A2A2A' },
                    ticks: {
                        color: '#9E9E9E',
                        callback: function(val) {
                            return formatLapTime(val);
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#E0E0E0', boxWidth: 14 }
                },
                tooltip: {
                    callbacks: {
                        label: function(ctx) {
                            return ` Lap ${ctx.raw.x}: ${formatLapTime(ctx.raw.y)}`;
                        }
                    }
                }
            }
        }
    });
}

function renderDriverLapsTable(driverAbbr) {
    const tbody = document.querySelector('#driver-laps-detail-table tbody');
    const badge = document.getElementById('lap-table-count-badge');
    const title = document.getElementById('lap-table-title');

    const laps = currentLapsMap[driverAbbr] || [];
    title.textContent = `${driverAbbr} Lap Timing & Sector Breakdown`;
    badge.textContent = `${laps.length} Laps Recorded`;

    if (laps.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No laps recorded for ${driverAbbr}.</td></tr>`;
        return;
    }

    tbody.innerHTML = laps.map(l => {
        const isPB = l.IsPersonalBest;
        const comp = (l.Compound || 'UNKNOWN').toUpperCase();
        const dotColor = TYRE_COLORS[comp] || '#888888';

        let pitStatus = '-';
        if (l.PitInTime) pitStatus = '<span class="badge-status status-lapped">PIT IN</span>';
        else if (l.PitOutTime) pitStatus = '<span class="badge-status status-finished">OUT LAP</span>';

        return `
            <tr ${isPB ? 'style="background-color: rgba(255, 234, 0, 0.05);"' : ''}>
                <td style="font-weight: 700;">${l.LapNumber}</td>
                <td class="${isPB ? 'personal-best-time' : ''}" style="font-family: monospace;">
                    ${formatLapTime(l.LapTime)} ${isPB ? '⚡' : ''}
                </td>
                <td style="font-family: monospace; color: var(--text-muted);">${formatLapTime(l.Sector1Time)}</td>
                <td style="font-family: monospace; color: var(--text-muted);">${formatLapTime(l.Sector2Time)}</td>
                <td style="font-family: monospace; color: var(--text-muted);">${formatLapTime(l.Sector3Time)}</td>
                <td style="font-family: monospace;">${l.SpeedST ? `${l.SpeedST} km/h` : (l.SpeedFL ? `${l.SpeedFL} km/h` : '-')}</td>
                <td>
                    <span class="compound-badge">
                        <span class="compound-dot" style="background-color: ${dotColor};"></span>
                        ${comp}
                    </span>
                </td>
                <td style="text-align: center; color: var(--text-muted);">${l.TyreLife != null ? `${l.TyreLife} laps` : '-'}</td>
                <td style="text-align: center;">${pitStatus}</td>
            </tr>
        `;
    }).join('');
}

/* ==========================================================================
   TAB 4: Pit Stops & Stints
   ========================================================================== */

function renderTabPitStops(data) {
    const stopsTable = document.querySelector('#pit-stops-table tbody');
    const stopsBadge = document.getElementById('pit-stops-count-badge');
    const stintsTable = document.querySelector('#stints-table tbody');

    const pitStops = data.pit_stops || [];
    stopsBadge.textContent = `${pitStops.length} Pit Events`;

    if (pitStops.length === 0) {
        stopsTable.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No pit stop events recorded for this session.</td></tr>`;
    } else {
        stopsTable.innerHTML = pitStops.map((ps, i) => {
            const teamColor = F1_TEAM_COLORS[ps.Team] || '#888888';
            const comp = (ps.Compound || 'UNKNOWN').toUpperCase();
            const dotColor = TYRE_COLORS[comp] || '#888888';

            return `
                <tr>
                    <td style="font-weight: 700;">#${i + 1}</td>
                    <td><strong>${ps.Driver}</strong></td>
                    <td>
                        <span class="team-pill">
                            <span class="team-color-dot" style="background-color: ${teamColor};"></span>
                            ${ps.Team}
                        </span>
                    </td>
                    <td>Lap ${ps.LapNumber}</td>
                    <td>
                        <span class="compound-badge">
                            <span class="compound-dot" style="background-color: ${dotColor};"></span>
                            ${comp}
                        </span>
                    </td>
                    <td>${ps.TyreLife ? `${ps.TyreLife} laps` : '-'}</td>
                    <td style="font-family: monospace;">${ps.PitInTime ? `${formatRaceTime(ps.PitInTime)}` : '-'}</td>
                    <td style="font-family: monospace;">${ps.PitOutTime ? `${formatRaceTime(ps.PitOutTime)}` : '-'}</td>
                </tr>
            `;
        }).join('');
    }

    // Stints Table
    const stints = data.stints || [];
    if (stints.length === 0) {
        stintsTable.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No stint records available.</td></tr>`;
    } else {
        stintsTable.innerHTML = stints.map(st => {
            const comp = (st.Compound || 'UNKNOWN').toUpperCase();
            const dotColor = TYRE_COLORS[comp] || '#888888';

            return `
                <tr>
                    <td><strong>${st.Driver}</strong></td>
                    <td style="text-align: center;">Stint ${st.Stint}</td>
                    <td>
                        <span class="compound-badge">
                            <span class="compound-dot" style="background-color: ${dotColor};"></span>
                            ${comp}
                        </span>
                    </td>
                    <td>Lap ${st.StartLap}</td>
                    <td>Lap ${st.EndLap}</td>
                    <td style="font-weight: 700;">${st.LapsCount} laps</td>
                </tr>
            `;
        }).join('');
    }
}

/* ==========================================================================
   TAB 5: Conditions (Weather)
   ========================================================================== */

function renderTabConditions(data) {
    const content = document.getElementById('conditions-content');
    const emptyBox = document.getElementById('conditions-empty');

    if (!data.weather || !data.weather.timeline || data.weather.timeline.length === 0) {
        content.style.display = 'none';
        emptyBox.style.display = 'block';
        return;
    }

    content.style.display = 'block';
    emptyBox.style.display = 'none';

    const w = data.weather;
    document.getElementById('weather-air-temp').textContent = w.air_temp_avg != null ? `${w.air_temp_avg} °C` : '-- °C';
    document.getElementById('weather-track-temp').textContent = w.track_temp_avg != null ? `${w.track_temp_avg} °C` : '-- °C';
    document.getElementById('weather-track-max').textContent = w.track_temp_max != null ? `Peak: ${w.track_temp_max} °C` : '';
    document.getElementById('weather-humidity').textContent = w.humidity_avg != null ? `${w.humidity_avg} %` : '-- %';
    document.getElementById('weather-rain').textContent = w.rainfall ? 'Wet Conditions' : 'Dry';
    document.getElementById('weather-wind').textContent = w.wind_speed_avg != null ? `Wind: ${w.wind_speed_avg} m/s` : '';

    // Weather Timeline Chart
    const canvas = document.getElementById('weatherTimelineChart');
    if (!canvas) return;

    if (weatherTimelineChart) weatherTimelineChart.destroy();

    const ctx = canvas.getContext('2d');
    weatherTimelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: w.timeline,
            datasets: [
                {
                    label: 'Track Temp (°C)',
                    data: w.track_series,
                    borderColor: '#FF1801',
                    backgroundColor: 'rgba(255, 24, 1, 0.1)',
                    borderWidth: 2,
                    tension: 0.2
                },
                {
                    label: 'Air Temp (°C)',
                    data: w.air_series,
                    borderColor: '#2979FF',
                    backgroundColor: 'rgba(41, 121, 255, 0.1)',
                    borderWidth: 2,
                    tension: 0.2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: { display: true, text: 'Session Elapsed Time', color: '#9E9E9E' },
                    grid: { color: '#2A2A2A' },
                    ticks: { color: '#9E9E9E' }
                },
                y: {
                    title: { display: true, text: 'Temperature (°C)', color: '#9E9E9E' },
                    grid: { color: '#2A2A2A' },
                    ticks: { color: '#9E9E9E' }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#E0E0E0', boxWidth: 12 }
                }
            }
        }
    });
}

/* ==========================================================================
   Formatting Utilities
   ========================================================================== */

function formatLapTime(seconds) {
    if (!seconds && seconds !== 0) return "--:--.---";
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(3);
    return `${mins}:${String(secs).padStart(6, '0')}`;
}

function formatRaceTime(seconds) {
    if (!seconds && seconds !== 0) return "--:--.---";
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = (seconds % 60).toFixed(3);
    if (hours > 0) {
        return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(6, '0')}`;
    }
    return `${mins}:${String(secs).padStart(6, '0')}`;
}

function formatStatusOrTime(row, winnerRow) {
    if (!row) return '-';
    const status = row.Status || 'Finished';

    // If P1 winner
    if (row.Position === 1 && row.Time) {
        return formatRaceTime(row.Time);
    }

    // If lapped or retired
    if (status !== 'Finished') {
        return status;
    }

    // If gap to winner in seconds
    if (row.Time && winnerRow && winnerRow.Time) {
        const gap = (row.Time - winnerRow.Time).toFixed(3);
        if (gap > 0) return `+${gap}s`;
    }

    return status;
}