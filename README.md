# 🏎️ FormulaX - Formula 1 Analytics & Telemetry Dashboard

[![Python](https://img.shields.io/badge/Python-3.8%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-5.2%2B-092E20?style=for-the-badge&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![FastF1](https://img.shields.io/badge/Data-FastF1-FF1801?style=for-the-badge&logo=formula1&logoColor=white)](https://github.com/theoehrly/Fast-F1)
[![Chart.js](https://img.shields.io/badge/Visualizations-Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)](https://www.chartjs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

> **Where Speed Meets Data** — FormulaX is a high-performance, full-stack web application designed for motorsport enthusiasts, data scientists, and Formula 1 analysts. It aggregates, parses, and visualizes complex telemetry, lap times, standings, and race strategies directly from official timing data powered by the Python **FastF1** engine and **Chart.js**.

---

## 📑 Table of Contents

- [🏎️ FormulaX - Formula 1 Analytics \& Telemetry Dashboard](#️-formulax---formula-1-analytics--telemetry-dashboard)
  - [📑 Table of Contents](#-table-of-contents)
  - [🌟 Overview](#-overview)
  - [✨ Key Features](#-key-features)
    - [1. 🏆 Live Standings \& Dynamic Hero (Home Page)](#1--live-standings--dynamic-hero-home-page)
    - [2. 🏁 Interactive Race Dashboard](#2--interactive-race-dashboard)
    - [3. 📊 Advanced Analytics Suite](#3--advanced-analytics-suite)
    - [4. 🗺️ Season Race Explorer](#4-️-season-race-explorer)
    - [5. 🔐 Database-Backed Cache Admin](#5--database-backed-cache-admin)
  - [🏗️ System Architecture \& Performance](#️-system-architecture--performance)
    - [The Three-Tier Caching Architecture](#the-three-tier-caching-architecture)
    - [Multi-Threaded Concurrent Data Processing](#multi-threaded-concurrent-data-processing)
  - [🛠️ Technology Stack](#️-technology-stack)
  - [📂 Project Structure](#-project-structure)
  - [⚙️ Setup and Installation](#️-setup-and-installation)
    - [1. Prerequisites](#1-prerequisites)
    - [2. Clone or Navigate to the Repository](#2-clone-or-navigate-to-the-repository)
    - [3. Create and Activate Virtual Environment](#3-create-and-activate-virtual-environment)
    - [4. Install Python Dependencies](#4-install-python-dependencies)
    - [5. Apply Database Migrations](#5-apply-database-migrations)
    - [6. Create Superuser (Admin Access)](#6-create-superuser-admin-access)
    - [7. (Recommended) Pre-warm the Cache](#7-recommended-pre-warm-the-cache)
    - [8. Launch the Development Server](#8-launch-the-development-server)
  - [💻 CLI Management Commands](#-cli-management-commands)
    - [Pre-warming the Cache (`prewarm_cache`)](#pre-warming-the-cache-prewarm_cache)
  - [🌐 Internal REST API Reference](#-internal-rest-api-reference)
    - [1. Season Schedule](#1-season-schedule)
    - [2. Season Drivers](#2-season-drivers)
    - [3. Session Overview \& Results](#3-session-overview--results)
    - [4. Driver Lap Time Progression](#4-driver-lap-time-progression)
    - [5. Driver Head-to-Head Comparison](#5-driver-head-to-head-comparison)
    - [6. Race Tyre Compound Strategy](#6-race-tyre-compound-strategy)
  - [🎨 Design System \& Custom Styling](#-design-system--custom-styling)
    - [Official F1 Team Palette Mapping](#official-f1-team-palette-mapping)
    - [Tyre Compound Colors](#tyre-compound-colors)
  - [🚀 Production Deployment \& Redis Configuration](#-production-deployment--redis-configuration)
  - [❓ Troubleshooting \& FAQ](#-troubleshooting--faq)
  - [🗺️ Future Roadmap](#️-future-roadmap)
  - [👤 Credits \& Acknowledgments](#-credits--acknowledgments)

---

## 🌟 Overview

Modern Formula 1 generates gigabytes of telemetry data across every practice, qualifying session, sprint, and Grand Prix. While raw timing loops and CSV logs are cumbersome to inspect, **FormulaX** transforms raw telemetry into visual intelligence.

FormulaX provides:
- Live aggregated Driver and Constructor season standings calculated dynamically from all completed Grand Prix races.
- Interactive lap-by-lap pace progression charts comparing lap times across stints.
- Granular driver breakdowns highlighting personal best laps.
- Side-by-side head-to-head driver metrics (points, wins, podiums, average finish position, and DNFs).
- Race tyre compound distributions (Soft, Medium, Hard, Intermediate, Wet).
- Historical event browsing from the 2018 season up through present day.

---

## ✨ Key Features

### 1. 🏆 Live Standings & Dynamic Hero (Home Page)
- **Cinematic Experience:** High-impact hero section with a looping background video (`f1bg.mp4`), glassmorphism styling, and responsive typography.
- **Dynamic Leaderboards:** Real-time driver and constructor championship standings computed directly by aggregating all finished Grand Prix results for the season.
- **Race Context:** Displays the exact latest Grand Prix event from which the current standings are derived.

### 2. 🏁 Interactive Race Dashboard
- **Session Selector:** Choose any season (2018–Present) and automatically populate the Grand Prix event schedule.
- **Fastest Lap Badge:** Instantly reveals the driver who clinched the fastest lap of the Grand Prix and their exact lap time formatted as `MM:SS.sss`.
- **Classification Results Table:** Clean, sortable classification table outlining finishing position, driver broadcast name, constructor/team, race completion status (`Finished`, `+1 Lap`, `DNF`, etc.), and awarded points.
- **Driver Lap Time Progression Chart:** An interactive `Chart.js` line chart displaying lap times (in seconds) per lap number for any driver selected in that race, themed in the official team colors.
- **Collapsible Driver Laps:** Detailed accordion-style lists of every single lap completed by each driver, highlighting **Personal Best** laps in vibrant neon yellow.

### 3. 📊 Advanced Analytics Suite
- **Driver Head-to-Head Comparison:**
  - Select two competing drivers from any season.
  - Side-by-side statistical cards measuring:
    - **Total Points**
    - **Race Victories (Wins)**
    - **Podium Finishes**
    - **Average Finish Position** (rounded to 2 decimal places)
    - **DNFs (Did Not Finish)**
- **Tyre Compound Strategy:**
  - Visualize tyre stint distributions per Grand Prix.
  - Interactive donut/pie chart categorizing the total laps completed on **Soft**, **Medium**, **Hard**, **Intermediate**, and **Wet** compounds using authentic Pirelli color codes.

### 4. 🗺️ Season Race Explorer
- Visual, interactive card grid presenting every round on the Formula 1 calendar for any chosen year.
- Shows Round number, Grand Prix title, host country, and local event date.
- One-click navigation: clicking any race card deep-links straight into that event's interactive race dashboard (`/dashboard?year=<year>&gp=<gp_name>`).

### 5. 🔐 Database-Backed Cache Admin
- Accessible through `/admin/` (and `/admin_info/` overview).
- Django Admin panel integration for the custom `DataCache` model.
- Monitor active cache keys, check serialization timestamps, search keys, and invoke one-click cache deletion actions to clear out stale telemetry without dropping the database.

---

## 🏗️ System Architecture & Performance

```text
┌────────────────────────────────────────────────────────────────────────┐
│                              CLIENT BROWSER                            │
│           Vanilla JS / Fetch API / Chart.js / Semantic HTML5           │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ HTTP Requests / JSON
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         DJANGO BACKEND (fxpro)                         │
│   core/views.py  ◄───►  _get_cached_response() Helper Pipeline         │
└───────┬───────────────────────────┬────────────────────────────┬───────┘
        │                           │                            │
 1. Check Memory             2. Check DB                  3. Fetch Upstream
        ▼                           ▼                            ▼
┌─────────────────┐       ┌──────────────────┐       ┌───────────────────┐
│ Tier 1 Cache    │       │ Tier 2 Cache     │       │ Tier 3 Cache      │
│ LocMem / Redis  │       │ SQLite DataCache │       │ FastF1 Disk Cache │
│ (Sub-millisecond)│      │ (JSONField)      │       │ (fastf1_cache/)   │
└─────────────────┘       └──────────────────┘       └─────────┬─────────┘
                                                               │
                                                               ▼
                                                     ┌───────────────────┐
                                                     │ Official F1 API   │
                                                     │ (Timing & Laps)   │
                                                     └───────────────────┘
```

### The Three-Tier Caching Architecture
Formula 1 telemetry datasets are large (often hundreds of megabytes per weekend). To deliver lightning-fast page transitions and eliminate redundant downloads, FormulaX employs a **Three-Tier Caching System**:

1. **Tier 1: Django In-Memory Cache (`django.core.cache`)**
   - Configured in `fxpro/settings.py` using `LocMemCache` (or `RedisCache` in production).
   - In-memory key-value storage resolving repeat requests within milliseconds.
2. **Tier 2: Persistent Relational Cache (`DataCache` Model)**
   - Custom Django model storing serialized JSON responses alongside `created_at` timestamps.
   - Intelligent TTL (Time-To-Live) eviction:
     - **24-Hour TTL** for schedules, season drivers, full session results, tyre distributions, and driver comparisons.
     - **7-Day TTL** for finalized driver lap progression datasets.
3. **Tier 3: Native FastF1 Disk Cache (`fastf1_cache/`)**
   - Direct integration with FastF1's built-in disk caching mechanism (`ff1.Cache.enable_cache('fastf1_cache')`).
   - Caches raw SQLite timing database dumps directly onto local disk, preventing repeat API network requests to Formula 1 timing servers.

### Multi-Threaded Concurrent Data Processing
Aggregating season-long driver and constructor leaderboards requires querying every completed race session of the year. FormulaX accelerates this process using Python's `concurrent.futures.ThreadPoolExecutor`:
- Spawns up to `min(6, len(race_names))` parallel worker threads.
- Downloads and parses multiple Grand Prix race sessions simultaneously.
- Cuts full season aggregation latency from minutes down to a matter of seconds.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Backend Framework** | [Python 3.8+](https://www.python.org/) &bull; [Django 5.2+](https://www.djangoproject.com/) |
| **Data Engine & Analytics** | [FastF1](https://github.com/theoehrly/Fast-F1) &bull; [pandas](https://pandas.pydata.org/) &bull; [NumPy](https://numpy.org/) |
| **Frontend Framework** | HTML5 Semantic Elements &bull; Custom Modern Vanilla CSS &bull; Vanilla JavaScript (ES6+ async/await) |
| **Data Visualizations** | [Chart.js (v4)](https://www.chartjs.org/) &bull; [`chartjs-adapter-date-fns`](https://github.com/chartjs/chartjs-adapter-date-fns) |
| **Database** | [SQLite](https://www.sqlite.org/) (with Django `JSONField` persistence) |
| **Caching Systems** | Django `LocMemCache` / `RedisCache` &bull; FastF1 Disk Cache &bull; `DataCache` Table |
| **Concurrency** | Python `concurrent.futures` (`ThreadPoolExecutor`) |

---

## 📂 Project Structure

```text
FormulaX/
│
├── core/                                   # Core Django Application
│   ├── management/
│   │   └── commands/
│   │       ├── __init__.py
│   │       └── prewarm_cache.py            # CLI management command to pre-populate caches
│   │
│   ├── migrations/                         # Database schema migrations
│   │   ├── 0001_initial.py                 # Initial CachedQuery schema
│   │   ├── 0002_datacache_delete_cachedquery.py # Transition to DataCache with JSONField
│   │   └── __init__.py
│   │
│   ├── static/
│   │   └── core/
│   │       ├── css/
│   │       │   └── style.css               # Dark theme styling, CSS custom properties, grid layouts
│   │       ├── js/
│   │       │   └── dashboard.js            # Dashboard logic, Chart.js rendering, team color maps
│   │       └── videos/
│   │           └── f1bg.mp4                # Hero background video loop
│   │
│   ├── templates/
│   │   └── core/
│   │       ├── base.html                   # Master template with navigation and CDN scripts
│   │       ├── home.html                   # Landing page with video hero and season standings
│   │       ├── dashboard.html              # Race dashboard with session results & lap charts
│   │       ├── analytics.html              # Head-to-head comparison & tyre strategy charts
│   │       ├── explorer.html               # Season calendar race card browser
│   │       └── admin_info.html             # Admin overview and login redirect page
│   │
│   ├── __init__.py
│   ├── admin.py                            # Custom DataCache admin with bulk deletion action
│   ├── apps.py                             # Core application configuration
│   ├── fastf1_utils.py                     # FastF1 data extraction, pandas wrangling & threading
│   ├── models.py                           # DataCache model definition
│   ├── tests.py                            # Test suite
│   ├── urls.py                             # Core URL routing and REST API endpoints
│   └── views.py                            # View handlers & cached API response pipelines
│
├── fxpro/                                  # Django Project Configuration Package
│   ├── __init__.py
│   ├── asgi.py                             # ASGI server entry point
│   ├── settings.py                         # Django configuration (apps, middleware, caches, DB)
│   ├── urls.py                             # Root URL dispatcher
│   └── wsgi.py                             # WSGI server entry point
│
├── fastf1_cache/                           # Local persistent disk cache for FastF1 timing dumps
├── db.sqlite3                              # Local development SQLite database
├── manage.py                               # Django CLI entrypoint
├── requirements.txt                        # Python package dependencies
└── README.md                               # Project documentation
```

---

## ⚙️ Setup and Installation

Follow the steps below to set up and run FormulaX locally:

### 1. Prerequisites
- **Python 3.8+** (recommended: Python 3.10, 3.11, or 3.12)
- **pip** (Python package manager)
- An active internet connection for initial FastF1 telemetry downloads

### 2. Clone or Navigate to the Repository
```bash
git clone <your-repository-url>
cd FormulaX
```

### 3. Create and Activate Virtual Environment
- **Windows (PowerShell):**
  ```powershell
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  ```
- **Windows (Command Prompt):**
  ```cmd
  python -m venv venv
  .\venv\Scripts\activate.bat
  ```
- **macOS / Linux:**
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

### 4. Install Python Dependencies
```bash
pip install -r requirements.txt
```

> **Note:** Key dependencies installed include `django`, `fastf1`, `pandas`, `numpy`, `plotly`, `redis`, and `django-redis`.

### 5. Apply Database Migrations
Create the SQLite database schema and the `DataCache` table:
```bash
python manage.py makemigrations
python manage.py migrate
```

### 6. Create Superuser (Admin Access)
Create an administrative account to access the Django Admin Cache Manager:
```bash
python manage.py createsuperuser
```
*(Follow the interactive prompts to define username, email, and password)*

### 7. (Recommended) Pre-warm the Cache
To ensure instant response times on your first visit, run the custom cache pre-warming command:
```bash
python manage.py prewarm_cache
```

### 8. Launch the Development Server
```bash
python manage.py runserver
```

Open your browser and navigate to:
- **Application:** `http://127.0.0.1:8000/`
- **Django Admin:** `http://127.0.0.1:8000/admin/`

---

## 💻 CLI Management Commands

### Pre-warming the Cache (`prewarm_cache`)
FormulaX comes bundled with a custom Django management command (`core/management/commands/prewarm_cache.py`) that pre-populates both Tier 1 (memory) and Tier 2 (database) caches.

```bash
python manage.py prewarm_cache [options]
```

#### Available Arguments:
| Argument | Type | Default | Description |
|---|---|---|---|
| `--year` | `int` | Current Year | The championship season to fetch schedule, drivers, and leaderboards for. |
| `--gp` | `str` | Latest Completed Race | Grand Prix name to pre-cache session results and tyre usage for. |
| `--driver1` | `str` | *None* | 3-letter driver code for comparison caching (e.g. `VER`). |
| `--driver2` | `str` | *None* | 3-letter driver code for comparison caching (e.g. `HAM`). |

#### Examples:
```bash
# Pre-warm schedule, driver roster, and leaderboards for the current year
python manage.py prewarm_cache

# Pre-warm specific season and Grand Prix
python manage.py prewarm_cache --year 2024 --gp "Monaco Grand Prix"

# Pre-warm a full driver comparison alongside the race data
python manage.py prewarm_cache --year 2024 --driver1 VER --driver2 NOR
```

---

## 🌐 Internal REST API Reference

The backend provides several JSON endpoints used by the frontend to asynchronously load data:

| Endpoint | Method | Cache TTL | Description |
|---|---|---|---|
| `/api/schedule/<int:year>/` | `GET` | 24 Hours | Retrieves the full Grand Prix calendar for a given year. |
| `/api/drivers/<int:year>/` | `GET` | 24 Hours | Returns the driver roster for a given season. |
| `/api/session_data/<int:year>/<str:gp>/` | `GET` | 24 Hours | Fetches race results, fastest lap, and lap times for a Grand Prix. |
| `/api/lap_time_data/<int:year>/<str:gp>/<str:driver>/` | `GET` | 7 Days | Provides lap-by-lap timings for a specific driver. |
| `/api/driver_comparison/<int:year>/<str:driver1>/<str:driver2>/` | `GET` | 24 Hours | Computes head-to-head season stats between two drivers. |
| `/api/tyre_usage/<int:year>/<str:gp>/` | `GET` | 24 Hours | Delivers compound stint counts for tyre strategy charts. |

---

### 1. Season Schedule
- **URL:** `/api/schedule/<int:year>/`
- **Example Request:** `GET /api/schedule/2024/`
- **Sample Response:**
  ```json
  [
    {
      "RoundNumber": 1,
      "Country": "Bahrain",
      "EventName": "Bahrain Grand Prix",
      "EventDate": "2024-03-02"
    },
    {
      "RoundNumber": 2,
      "Country": "Saudi Arabia",
      "EventName": "Saudi Arabian Grand Prix",
      "EventDate": "2024-03-09"
    }
  ]
  ```

### 2. Season Drivers
- **URL:** `/api/drivers/<int:year>/`
- **Example Request:** `GET /api/drivers/2024/`
- **Sample Response:**
  ```json
  [
    { "Abbreviation": "ALB", "BroadcastName": "A ALBON" },
    { "Abbreviation": "HAM", "BroadcastName": "L HAMILTON" },
    { "Abbreviation": "NOR", "BroadcastName": "L NORRIS" },
    { "Abbreviation": "VER", "BroadcastName": "M VERSTAPPEN" }
  ]
  ```

### 3. Session Overview & Results
- **URL:** `/api/session_data/<int:year>/<str:gp>/`
- **Example Request:** `GET /api/session_data/2024/Bahrain%20Grand%20Prix/`
- **Sample Response:**
  ```json
  {
    "fastest_lap_driver": "VER",
    "fastest_lap_time": 92.608,
    "results": [
      {
        "Position": 1,
        "BroadcastName": "M VERSTAPPEN",
        "TeamName": "Red Bull Racing",
        "Status": "Finished",
        "Points": 26.0
      }
    ],
    "laps": [
      {
        "Driver": "VER",
        "LapNumber": 1,
        "LapTime": 96.425,
        "Team": "Red Bull Racing",
        "IsPersonalBest": false
      }
    ]
  }
  ```

### 4. Driver Lap Time Progression
- **URL:** `/api/lap_time_data/<int:year>/<str:gp>/<str:driver>/`
- **Example Request:** `GET /api/lap_time_data/2024/Bahrain%20Grand%20Prix/VER/`
- **Sample Response:**
  ```json
  [
    { "lap_number": 1, "lap_time": 96.425 },
    { "lap_number": 2, "lap_time": 94.812 },
    { "lap_number": 3, "lap_time": 94.501 }
  ]
  ```

### 5. Driver Head-to-Head Comparison
- **URL:** `/api/driver_comparison/<int:year>/<str:driver1>/<str:driver2>/`
- **Example Request:** `GET /api/driver_comparison/2024/VER/NOR/`
- **Sample Response:**
  ```json
  {
    "VER": {
      "wins": 9,
      "podiums": 14,
      "points": 437.0,
      "dnfs": 2,
      "finishes": [1, 1, 19, 1, 2, 1],
      "avg_finish": 2.45
    },
    "NOR": {
      "wins": 3,
      "podiums": 12,
      "points": 374.0,
      "dnfs": 1,
      "finishes": [6, 8, 3, 5, 2, 1],
      "avg_finish": 3.82
    }
  }
  ```

### 6. Race Tyre Compound Strategy
- **URL:** `/api/tyre_usage/<int:year>/<str:gp>/`
- **Example Request:** `GET /api/tyre_usage/2024/Bahrain%20Grand%20Prix/`
- **Sample Response:**
  ```json
  {
    "labels": ["SOFT", "HARD"],
    "data": [342, 684]
  }
  ```

---

## 🎨 Design System & Custom Styling

FormulaX features a bespoke dark-mode interface built on CSS variables and modern layout patterns:

```css
:root {
    --bg-color: #121212;
    --primary-card-bg: #1E1E1E;
    --secondary-card-bg: #2a2a2a;
    --text-color: #E0E0E0;
    --primary-accent: #FF1801; /* Official F1 Racing Red */
    --neon-yellow: #FFEA00;    /* Personal Best Indicator */
    --green-accent: #00C853;
    --orange-accent: #FF6D00;
    --border-color: #444;
}
```

### Official F1 Team Palette Mapping
Driver lap telemetry lines automatically inherit official livery colors defined in `dashboard.js`:

| Team | Color Hex | Sample |
|---|---|---|
| **Red Bull Racing** | `#0600EF` | ![#0600EF](https://via.placeholder.com/15/0600EF/000000?text=+) `#0600EF` |
| **Mercedes** | `#00D2BE` | ![#00D2BE](https://via.placeholder.com/15/00D2BE/000000?text=+) `#00D2BE` |
| **Ferrari** | `#DC0000` | ![#DC0000](https://via.placeholder.com/15/DC0000/000000?text=+) `#DC0000` |
| **McLaren** | `#FF8700` | ![#FF8700](https://via.placeholder.com/15/FF8700/000000?text=+) `#FF8700` |
| **Aston Martin** | `#006F62` | ![#006F62](https://via.placeholder.com/15/006F62/000000?text=+) `#006F62` |
| **Alpine** | `#0090FF` | ![#0090FF](https://via.placeholder.com/15/0090FF/000000?text=+) `#0090FF` |
| **Williams** | `#005AFF` | ![#005AFF](https://via.placeholder.com/15/005AFF/000000?text=+) `#005AFF` |
| **Kick Sauber** | `#52E252` | ![#52E252](https://via.placeholder.com/15/52E252/000000?text=+) `#52E252` |
| **Racing Bulls (RB)** | `#6692FF` | ![#6692FF](https://via.placeholder.com/15/6692FF/000000?text=+) `#6692FF` |
| **Haas F1 Team** | `#FFFFFF` | ![#FFFFFF](https://via.placeholder.com/15/FFFFFF/000000?text=+) `#FFFFFF` |

### Tyre Compound Colors
Accurate compound palette defined in `analytics.html`:
- **SOFT:** `#EC0000` (Red)
- **MEDIUM:** `#F0D002` (Yellow)
- **HARD:** `#FFFFFF` (White)
- **INTERMEDIATE:** `#43B02A` (Green)
- **WET:** `#0067AD` (Blue)

---

## 🚀 Production Deployment & Redis Configuration

For production environments handling high concurrent user traffic:

1. **Activate Redis Caching:**
   In `fxpro/settings.py`, swap `LocMemCache` with `django_redis`:
   ```python
   CACHES = {
       'default': {
           'BACKEND': 'django_redis.cache.RedisCache',
           'LOCATION': 'redis://127.0.0.1:6379/1',
           'OPTIONS': {
               'CLIENT_CLASS': 'django_redis.client.DefaultClient',
           },
       }
   }
   ```
2. **Environment Variables:**
   - Set `DEBUG = False`
   - Configure a cryptographically secure `SECRET_KEY`
   - Define domain names in `ALLOWED_HOSTS`
3. **Static File Collection:**
   ```bash
   python manage.py collectstatic --noinput
   ```
4. **WSGI/ASGI Production Server:**
   Deploy using **Gunicorn** or **Uvicorn** behind an **Nginx** reverse proxy:
   ```bash
   gunicorn fxpro.wsgi:application --bind 0.0.0.0:8000 --workers 4
   ```

---

## ❓ Troubleshooting & FAQ

**Q: Why does the first request to a Grand Prix take 5–10 seconds?**  
*A:* On the very first request (cold cache), FastF1 downloads official timing files from Formula 1's servers and parses raw telemetry frames. Once loaded, the data is automatically saved to the `fastf1_cache/` directory, the SQLite `DataCache` table, and memory cache. Subsequent requests will load instantaneously.

**Q: How do I clear cached data if a race result gets updated (e.g. post-race penalties)?**  
*A:* Log into the Django Admin at `http://127.0.0.1:8000/admin/`, navigate to **Data Caches**, select the relevant cache entry (e.g., `session_2024_Monaco Grand Prix`), and run the admin action **"Delete selected cache entries"**. The next request will re-fetch the latest official results.

**Q: Can I run this offline?**  
*A:* Any season or race session that has already been pre-warmed or loaded once is persisted locally in `fastf1_cache/` and `db.sqlite3`. Those sessions will work completely offline without an active internet connection.

---

## 🗺️ Future Roadmap

- [ ] **Interactive Track Maps & Mini-Sectors:** Speed and gear telemetry plotted on interactive 2D circuit outlines.
- [ ] **Throttle & Brake Traces:** High-resolution comparison overlays of speed, RPM, throttle application, and braking points across qualifying laps.
- [ ] **Live Timing Tower WebSockets:** Real-time timing tower feeds during live Grand Prix weekends.
- [ ] **User Authentication & Bookmarking:** Save favorite drivers, compare historical rivalries, and store custom Grand Prix notes.
- [ ] **Docker & Docker-Compose:** Containerized deployment with automated Redis and PostgreSQL services.

---

## 👤 Credits & Acknowledgments

- **Creator & Lead Developer:** **DHWANI VYAS**
- **Data Engine:** Powered by the open-source [FastF1 Python Library](https://github.com/theoehrly/Fast-F1) created by Theo Ehrly.
- **Visuals:** Powered by [Chart.js](https://www.chartjs.org/).
- **Data Source:** Timing, telemetry, and schedule data provided courtesy of official Formula 1 live timing feeds.