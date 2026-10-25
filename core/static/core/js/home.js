/**
 * FormulaX — Home Module & Championship Overview Script
 */

let progressionChart = null;
let currentOverview = null;
let activeProgressionView = 'drivers'; // 'drivers' or 'constructors'

const F1_TEAM_COLORS = {
    "Red Bull Racing": "#0600EF",
    "Red Bull": "#0600EF",
    "Mercedes": "#00D2BE",
    "Ferrari": "#DC0000",
    "McLaren": "#FF8700",
    "Aston Martin": "#006F62",
    "Alpine": "#0090FF",
    "Alpine F1 Team": "#0090FF",
    "Williams": "#005AFF",
    "AlphaTauri": "#2B4562",
    "Haas F1 Team": "#FFFFFF",
    "Haas": "#FFFFFF",
    "Alfa Romeo": "#900000",
    "RB": "#6692FF",
    "RB F1 Team": "#6692FF",
    "Racing Bulls": "#6692FF",
    "Kick Sauber": "#52E252",
    "Sauber": "#52E252",
    "Audi": "#E00613",
    "Cadillac": "#FFD700"
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Colorize existing team color dots
    colorizeTeamDots();

    // 2. Safely read injected server-side context from json_script
    let initialOverview = null;
    const initialOverviewEl = document.getElementById('initial-overview-data');
    if (initialOverviewEl && initialOverviewEl.textContent.trim()) {
        try {
            initialOverview = JSON.parse(initialOverviewEl.textContent);
        } catch (err) {
            console.warn('Could not parse initial overview JSON:', err);
        }
    }

    if (initialOverview && initialOverview.driver_standings && initialOverview.driver_standings.length > 0) {
        currentOverview = initialOverview;
        renderProgressionChart();
    } else {
        // If initial overview is missing or cold, fetch asynchronously
        const seasonSelect = document.getElementById('home-season-select');
        const targetYear = (typeof SELECTED_YEAR !== 'undefined' && SELECTED_YEAR) ? SELECTED_YEAR : (seasonSelect ? seasonSelect.value : 2024);
        fetchSeasonOverview(targetYear);
    }

    // 3. Set up Season Selector event listener
    const seasonSelect = document.getElementById('home-season-select');
    if (seasonSelect) {
        seasonSelect.addEventListener('change', (e) => {
            fetchSeasonOverview(e.target.value);
        });
    }
});

function colorizeTeamDots() {
    document.querySelectorAll('.team-color-dot').forEach(dot => {
        const teamName = dot.getAttribute('data-team');
        const color = F1_TEAM_COLORS[teamName] || '#888888';
        dot.style.backgroundColor = color;
    });
}

async function fetchSeasonOverview(year) {
    const loader = document.getElementById('home-loader');
    const mainContent = document.getElementById('home-main-content');
    const metaInfo = document.getElementById('home-season-meta');

    if (loader) loader.style.display = 'block';
    if (mainContent) mainContent.style.opacity = '0.4';
    if (metaInfo) metaInfo.textContent = `Fetching championship overview for ${year}...`;

    try {
        const response = await fetch(`/api/season_overview/${year}/`);
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        const data = await response.json();
        currentOverview = data;
        updateHomeUI(data, year);
    } catch (err) {
        console.error('Error fetching season overview:', err);
        if (metaInfo) metaInfo.innerHTML = `<span style="color: var(--primary-accent);">Failed to load standings for ${year}. Data may not be available.</span>`;
    } finally {
        if (loader) loader.style.display = 'none';
        if (mainContent) mainContent.style.opacity = '1';
    }
}

function updateHomeUI(data, year) {
    // 1. Meta context bar
    const metaInfo = document.getElementById('home-season-meta');
    if (metaInfo) {
        if (data.has_completed_races) {
            metaInfo.innerHTML = `Current standings after the <strong>${data.race_name}</strong>`;
        } else {
            metaInfo.innerHTML = `<strong>${year} Season:</strong> No completed races recorded yet.`;
        }
    }

    // 2. Hero button
    const heroBtn = document.getElementById('hero-latest-race-btn');
    if (heroBtn) {
        if (data.latest_race && data.latest_race.EventName) {
            heroBtn.href = `/dashboard/?year=${year}&gp=${encodeURIComponent(data.latest_race.EventName)}`;
            heroBtn.style.opacity = '1';
            heroBtn.style.pointerEvents = 'auto';
        } else {
            heroBtn.href = `/dashboard/?year=${year}`;
        }
    }

    // 3. Summary Cards
    // Card 1: Drivers Leader
    const dLeaderName = document.getElementById('card-driver-leader-name');
    const dLeaderSub = document.getElementById('card-driver-leader-sub');
    if (data.driver_leader) {
        if (dLeaderName) dLeaderName.textContent = data.driver_leader.BroadcastName;
        if (dLeaderSub) dLeaderSub.innerHTML = `${data.driver_leader.TeamName} &bull; <strong>${Math.round(data.driver_leader.Points)} PTS</strong>`;
    } else {
        if (dLeaderName) dLeaderName.textContent = 'N/A';
        if (dLeaderSub) dLeaderSub.textContent = 'Season standings unavailable';
    }

    // Card 2: Constructors Leader
    const cLeaderName = document.getElementById('card-constructor-leader-name');
    const cLeaderSub = document.getElementById('card-constructor-leader-sub');
    if (data.constructor_leader) {
        if (cLeaderName) cLeaderName.textContent = data.constructor_leader.TeamName;
        if (cLeaderSub) cLeaderSub.innerHTML = `Championship Leader &bull; <strong>${Math.round(data.constructor_leader.Points)} PTS</strong>`;
    } else {
        if (cLeaderName) cLeaderName.textContent = 'N/A';
        if (cLeaderSub) cLeaderSub.textContent = 'Season standings unavailable';
    }

    // Card 3: Latest Completed GP
    const latestName = document.getElementById('card-latest-gp-name');
    const latestSub = document.getElementById('card-latest-gp-sub');
    if (data.latest_race) {
        if (latestName) latestName.textContent = data.latest_race.EventName;
        if (latestSub) {
            const w = data.latest_race.Winner;
            latestSub.innerHTML = w ? `Winner: <strong>${w.BroadcastName}</strong> (${w.TeamName})` : 'Completed';
        }
    } else {
        if (latestName) latestName.textContent = 'None';
        if (latestSub) latestSub.textContent = 'No completed races';
    }

    // Card 4: Next Scheduled GP
    const nextName = document.getElementById('card-next-gp-name');
    const nextSub = document.getElementById('card-next-gp-sub');
    if (data.next_race) {
        if (nextName) nextName.textContent = data.next_race.EventName;
        if (nextSub) nextSub.innerHTML = `Round ${data.next_race.RoundNumber} &bull; <strong>${data.next_race.EventDate}</strong>`;
    } else {
        if (nextName) nextName.textContent = 'Season Completed';
        if (nextSub) nextSub.textContent = 'No further races on calendar';
    }

    // 4. Update Tables
    updateDriversTable(data.driver_standings);
    updateConstructorsTable(data.constructor_standings);

    // 5. Update Spotlights
    updateSpotlights(data, year);

    // 6. Update Progression Chart
    renderProgressionChart();
}

function updateDriversTable(standings) {
    const tbody = document.querySelector('#drivers-standings-table tbody');
    const badge = document.getElementById('drivers-count-badge');
    if (!tbody) return;

    if (!standings || standings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No driver standings available for this season yet.</td></tr>`;
        if (badge) badge.textContent = '0 Drivers';
        return;
    }

    if (badge) badge.textContent = `${standings.length} Drivers Classified`;

    tbody.innerHTML = standings.map(d => {
        let posClass = '';
        if (d.Position === 1) posClass = 'pos-1';
        else if (d.Position === 2) posClass = 'pos-2';
        else if (d.Position === 3) posClass = 'pos-3';

        const color = F1_TEAM_COLORS[d.TeamName] || '#888888';

        return `
            <tr>
                <td><span class="pos-badge ${posClass}">${d.Position}</span></td>
                <td>
                    <div class="driver-cell">
                        <span class="driver-abbr">${d.Abbreviation}</span>
                        <span class="driver-fullname">${d.BroadcastName}</span>
                    </div>
                </td>
                <td>
                    <span class="team-pill">
                        <span class="team-color-dot" style="background-color: ${color};"></span>
                        ${d.TeamName}
                    </span>
                </td>
                <td style="text-align: center; color: var(--text-muted);">${d.Wins || 0}</td>
                <td style="text-align: right;" class="points-val">${Math.round(d.Points)}</td>
            </tr>
        `;
    }).join('');
}

function updateConstructorsTable(standings) {
    const tbody = document.querySelector('#constructors-standings-table tbody');
    const badge = document.getElementById('constructors-count-badge');
    if (!tbody) return;

    if (!standings || standings.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No constructor standings available for this season yet.</td></tr>`;
        if (badge) badge.textContent = '0 Teams';
        return;
    }

    if (badge) badge.textContent = `${standings.length} Teams`;

    tbody.innerHTML = standings.map(c => {
        let posClass = '';
        if (c.Position === 1) posClass = 'pos-1';
        else if (c.Position === 2) posClass = 'pos-2';
        else if (c.Position === 3) posClass = 'pos-3';

        const color = F1_TEAM_COLORS[c.TeamName] || '#888888';

        return `
            <tr>
                <td><span class="pos-badge ${posClass}">${c.Position}</span></td>
                <td>
                    <span class="team-pill">
                        <span class="team-color-dot" style="background-color: ${color};"></span>
                        <strong style="color: #FFFFFF;">${c.TeamName}</strong>
                    </span>
                </td>
                <td style="text-align: center; color: var(--text-muted);">${c.Wins || 0}</td>
                <td style="text-align: right;" class="points-val">${Math.round(c.Points)}</td>
            </tr>
        `;
    }).join('');
}

function updateSpotlights(data, year) {
    // Latest Race Spotlight
    const latestTitle = document.getElementById('spotlight-latest-name');
    const latestMeta = document.getElementById('spotlight-latest-meta');
    const podiumContainer = document.getElementById('spotlight-podium-container');
    const viewBtn = document.getElementById('spotlight-view-race-btn');

    if (data.latest_race) {
        const lr = data.latest_race;
        if (latestTitle) latestTitle.textContent = lr.EventName;
        if (latestMeta) latestMeta.textContent = `Round ${lr.RoundNumber} • ${lr.Country} • ${lr.EventDate}`;

        if (podiumContainer && lr.Podium && lr.Podium.length > 0) {
            podiumContainer.innerHTML = `
                <div class="podium-grid">
                    ${lr.Podium.map(p => `
                        <div class="podium-box ${p.Position === 1 ? 'p1' : ''}">
                            <div class="p-pos pos-${p.Position}" style="display:inline-block; border-radius:50%; width:24px; height:24px; line-height:24px; font-size:0.75rem;">
                                ${p.Position}
                            </div>
                            <div class="p-driver">${p.BroadcastName}</div>
                            <div class="p-team">${p.TeamName}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (viewBtn) {
            viewBtn.href = `/dashboard/?year=${year}&gp=${encodeURIComponent(lr.EventName)}`;
            viewBtn.style.display = 'inline-flex';
        }
    } else {
        if (latestTitle) latestTitle.textContent = 'No Completed Races';
        if (latestMeta) latestMeta.textContent = 'This season has no completed race records yet.';
        if (podiumContainer) podiumContainer.innerHTML = '';
        if (viewBtn) viewBtn.style.display = 'none';
    }

    // Next Race Spotlight
    const nextTitle = document.getElementById('spotlight-next-name');
    const nextMeta = document.getElementById('spotlight-next-meta');
    const timetableContainer = document.getElementById('spotlight-next-timetable');

    if (data.next_race) {
        const nr = data.next_race;
        if (nextTitle) nextTitle.textContent = nr.EventName;
        if (nextMeta) nextMeta.textContent = `Round ${nr.RoundNumber} • ${nr.Country} (${nr.Location})`;

        if (timetableContainer) {
            if (nr.SessionDates && Object.keys(nr.SessionDates).length > 0) {
                timetableContainer.innerHTML = `
                    <ul class="timetable-list">
                        ${Object.entries(nr.SessionDates).map(([sName, sDate]) => `
                            <li class="timetable-row">
                                <span class="timetable-session">${sName}</span>
                                <span class="timetable-date">${sDate}</span>
                            </li>
                        `).join('')}
                    </ul>
                `;
            } else {
                timetableContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">Scheduled for <strong>${nr.EventDate}</strong>. Detailed session timetable will be released closer to the weekend.</p>`;
            }
        }
    } else {
        if (nextTitle) nextTitle.textContent = 'Season Complete';
        if (nextMeta) nextMeta.textContent = 'All championship rounds for this season have concluded.';
        if (timetableContainer) timetableContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem;">Check back for next year's provisional calendar.</p>`;
    }
}

function switchProgressionView(type) {
    activeProgressionView = type;
    const btnD = document.getElementById('prog-btn-drivers');
    const btnC = document.getElementById('prog-btn-constructors');

    if (type === 'drivers') {
        if (btnD) btnD.classList.add('active');
        if (btnC) btnC.classList.remove('active');
    } else {
        if (btnC) btnC.classList.add('active');
        if (btnD) btnD.classList.remove('active');
    }

    renderProgressionChart();
}

function renderProgressionChart() {
    const canvas = document.getElementById('progressionChart');
    if (!canvas || !currentOverview || !currentOverview.progression) return;

    const prog = currentOverview.progression;
    if (!prog.rounds || prog.rounds.length === 0) {
        if (progressionChart) progressionChart.destroy();
        return;
    }

    const labels = prog.rounds.map((r, i) => `${r} (${prog.events[i] ? prog.events[i].replace(' Grand Prix', '') : ''})`);
    let datasets = [];

    if (activeProgressionView === 'drivers') {
        // Show top 8 drivers by points to maintain readability
        const topDrivers = (currentOverview.driver_standings || []).slice(0, 8);
        datasets = topDrivers.map(d => {
            const abbr = d.Abbreviation;
            const pData = prog.drivers[abbr] ? prog.drivers[abbr].points : [];
            const color = F1_TEAM_COLORS[d.TeamName] || '#CCCCCC';
            return {
                label: `${d.BroadcastName} (${abbr})`,
                data: pData,
                borderColor: color,
                backgroundColor: color,
                borderWidth: 2.5,
                pointRadius: 3.5,
                tension: 0.15,
                fill: false
            };
        });
    } else {
        // Constructors
        const topConstructors = (currentOverview.constructor_standings || []);
        datasets = topConstructors.map(c => {
            const team = c.TeamName;
            const pData = prog.constructors[team] ? prog.constructors[team].points : [];
            const color = F1_TEAM_COLORS[team] || '#CCCCCC';
            return {
                label: team,
                data: pData,
                borderColor: color,
                backgroundColor: color,
                borderWidth: 2.5,
                pointRadius: 3.5,
                tension: 0.15,
                fill: false
            };
        });
    }

    if (progressionChart) {
        progressionChart.destroy();
    }

    const ctx = canvas.getContext('2d');
    progressionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#E0E0E0',
                        boxWidth: 12,
                        padding: 15,
                        font: { size: 11, weight: 'bold' }
                    }
                },
                tooltip: {
                    backgroundColor: '#1E1E1E',
                    borderColor: '#444444',
                    borderWidth: 1,
                    titleColor: '#FFFFFF',
                    bodyColor: '#E0E0E0',
                    padding: 10
                }
            },
            scales: {
                x: {
                    grid: { color: '#2A2A2A' },
                    ticks: { color: '#9E9E9E', font: { size: 10 } }
                },
                y: {
                    title: { display: true, text: 'Championship Points', color: '#9E9E9E' },
                    grid: { color: '#2A2A2A' },
                    ticks: { color: '#9E9E9E' },
                    beginAtZero: true
                }
            }
        }
    });
}

function navigateToLatestRace() {
    if (currentOverview && currentOverview.latest_race && currentOverview.latest_race.EventName) {
        const year = document.getElementById('home-season-select').value;
        const gp = encodeURIComponent(currentOverview.latest_race.EventName);
        window.location.href = `/dashboard/?year=${year}&gp=${gp}`;
    }
}
