import fastf1 as ff1
import pandas as pd
from datetime import datetime, timedelta
import numpy as np
from concurrent.futures import ThreadPoolExecutor, as_completed
import re

# Enable the cache
try:
    ff1.Cache.enable_cache('fastf1_cache')
    print("FastF1 cache enabled.")
except Exception as e:
    print(f"Error enabling FastF1 cache: {e}")


def _clean_json_value(val):
    """
    Safely converts pandas, numpy, Timedelta, Timestamp and NaN values into
    JSON-serializable Python native types.
    """
    if val is None or pd.isna(val):
        return None
    if isinstance(val, (pd.Timedelta, timedelta)):
        return round(val.total_seconds(), 3)
    if isinstance(val, (pd.Timestamp, datetime)):
        return val.isoformat()
    if isinstance(val, (np.integer, int)):
        return int(val)
    if isinstance(val, (np.floating, float)):
        return float(val) if not np.isnan(val) and not np.isinf(val) else None
    if isinstance(val, (np.bool_, bool)):
        return bool(val)
    if isinstance(val, (list, tuple)):
        return [_clean_json_value(x) for x in val]
    if isinstance(val, dict):
        return {k: _clean_json_value(v) for k, v in val.items()}
    return val


def _clean_dataframe(df):
    """
    Cleans an entire DataFrame and converts it to a list of dicts with
    only JSON-serializable types (None instead of NaN).
    """
    if df is None or df.empty:
        return []
    raw_records = df.to_dict(orient='records')
    records = []
    for row in raw_records:
        clean_row = {k: _clean_json_value(v) for k, v in row.items()}
        records.append(clean_row)
    return records


def _fastf1_load(session, laps=False, weather=False):
    load_kwargs = {
        'telemetry': False,
        'messages': False,
        'weather': weather,
    }
    if laps:
        load_kwargs['laps'] = True
    session.load(**load_kwargs)


def _fetch_race_results(year, race_name, session_type='R'):
    try:
        session = ff1.get_session(int(year), race_name, session_type)
        _fastf1_load(session)
        return session.results
    except Exception as e:
        print(f"Could not load results for {year} {race_name} ({session_type}): {e}")
        return None


def get_race_schedule(year):
    """
    Fetches the full championship calendar for the requested year.
    Includes round number, country, location, official event name, dates,
    available sessions, and completion status.
    """
    try:
        schedule = ff1.get_event_schedule(int(year))
        # Filter for championship rounds (RoundNumber >= 1)
        official_rounds = schedule[schedule['RoundNumber'] >= 1].copy()
        today = pd.to_datetime('today')

        calendar = []
        for _, race in official_rounds.iterrows():
            event_date = pd.to_datetime(race['EventDate'])
            is_completed = bool(event_date < today)

            sessions = []
            session_dates = {}
            for i in range(1, 6):
                s_name = race.get(f'Session{i}')
                if pd.notna(s_name) and s_name:
                    sessions.append(str(s_name))
                    s_date_utc = race.get(f'Session{i}DateUtc')
                    if pd.notna(s_date_utc):
                        session_dates[str(s_name)] = str(s_date_utc).split('+')[0]

            calendar.append({
                'RoundNumber': int(race['RoundNumber']),
                'Country': str(race.get('Country', '')),
                'Location': str(race.get('Location', '')),
                'OfficialEventName': str(race.get('OfficialEventName', race['EventName'])),
                'EventName': str(race['EventName']),
                'EventDate': str(race['EventDate']).split(' ')[0],
                'EventFormat': str(race.get('EventFormat', 'conventional')),
                'Sessions': sessions,
                'SessionDates': session_dates,
                'IsCompleted': is_completed
            })
        return calendar
    except Exception as e:
        print(f"Error fetching schedule for year {year}: {e}")
        return []


def get_all_drivers_for_year(year):
    """
    Fetches the competing drivers for the specified year.
    """
    try:
        schedule = ff1.get_event_schedule(int(year))
        official_rounds = schedule[schedule['RoundNumber'] >= 1]
        if official_rounds.empty:
            return []

        first_race = official_rounds.iloc[0]['EventName']
        session = ff1.get_session(int(year), first_race, 'R')
        _fastf1_load(session)
        if session.results is None or session.results.empty:
            return []

        drivers = session.results[['Abbreviation', 'BroadcastName']].dropna().to_dict(orient='records')
        return sorted(drivers, key=lambda x: x['BroadcastName'])
    except Exception as e:
        print(f"Could not fetch drivers for year {year}: {e}")
        return []


def get_season_overview(year=None):
    """
    Computes a comprehensive championship overview for the specified season.
    Returns:
    - Driver Standings (Position, Abbreviation, BroadcastName, TeamName, Points, Wins)
    - Constructor Standings (Position, TeamName, Points, Wins)
    - Leader Driver & Constructor
    - Latest completed race summary (winner, podium, fastest lap)
    - Next scheduled race information
    - Round-by-round cumulative championship progression for Drivers and Constructors
    """
    try:
        target_year = int(year) if year else datetime.now().year
        schedule = ff1.get_event_schedule(target_year)
        official_rounds = schedule[schedule['RoundNumber'] >= 1].copy()
        today = pd.to_datetime('today')

        completed_races = official_rounds[pd.to_datetime(official_rounds['EventDate']) < today].sort_values('RoundNumber')
        upcoming_races = official_rounds[pd.to_datetime(official_rounds['EventDate']) >= today].sort_values('RoundNumber')

        # Next scheduled race info
        next_race = None
        if not upcoming_races.empty:
            next_ev = upcoming_races.iloc[0]
            sessions = []
            session_dates = {}
            for i in range(1, 6):
                s_name = next_ev.get(f'Session{i}')
                if pd.notna(s_name) and s_name:
                    sessions.append(str(s_name))
                    s_date_utc = next_ev.get(f'Session{i}DateUtc')
                    if pd.notna(s_date_utc):
                        session_dates[str(s_name)] = str(s_date_utc).split('+')[0]

            next_race = {
                'RoundNumber': int(next_ev['RoundNumber']),
                'EventName': str(next_ev['EventName']),
                'Country': str(next_ev.get('Country', '')),
                'Location': str(next_ev.get('Location', '')),
                'EventDate': str(next_ev['EventDate']).split(' ')[0],
                'Sessions': sessions,
                'SessionDates': session_dates
            }

        if completed_races.empty:
            return {
                'has_completed_races': False,
                'year': target_year,
                'driver_standings': [],
                'constructor_standings': [],
                'driver_leader': None,
                'constructor_leader': None,
                'latest_race': None,
                'next_race': next_race,
                'progression': {'rounds': [], 'drivers': {}, 'constructors': {}},
                'race_name': f"No completed races in {target_year}"
            }

        # Multi-threaded retrieval of completed race sessions
        race_list = []
        for _, r in completed_races.iterrows():
            race_list.append({
                'name': r['EventName'],
                'round': int(r['RoundNumber']),
                'country': r.get('Country', ''),
                'date': str(r['EventDate']).split(' ')[0]
            })

        all_race_results = {}
        with ThreadPoolExecutor(max_workers=min(6, len(race_list))) as executor:
            future_to_race = {
                executor.submit(_fetch_race_results, target_year, r['name'], 'R'): r
                for r in race_list
            }
            for future in as_completed(future_to_race):
                r_info = future_to_race[future]
                try:
                    res = future.result()
                    if res is not None and not res.empty:
                        all_race_results[r_info['round']] = {
                            'info': r_info,
                            'results': res
                        }
                except Exception as e:
                    print(f"Could not load race results for {r_info['name']}: {e}")

        if not all_race_results:
            return None

        # Sort chronologically by round number
        sorted_rounds = sorted(all_race_results.keys())

        # Track cumulative points round by round
        driver_round_points = {}  # abbr -> {round: points}
        driver_metadata = {}      # abbr -> {BroadcastName, TeamName}
        constructor_round_points = {} # team -> {round: points}
        driver_wins = {}          # abbr -> count
        constructor_wins = {}     # team -> count

        latest_round_data = all_race_results[sorted_rounds[-1]]

        for rnd in sorted_rounds:
            res_df = all_race_results[rnd]['results']

            # Check winner
            p1_driver = res_df[res_df['Position'] == 1]
            if not p1_driver.empty:
                winner_abbr = p1_driver.iloc[0]['Abbreviation']
                winner_team = p1_driver.iloc[0]['TeamName']
                driver_wins[winner_abbr] = driver_wins.get(winner_abbr, 0) + 1
                constructor_wins[winner_team] = constructor_wins.get(winner_team, 0) + 1

            for _, row in res_df.iterrows():
                abbr = row['Abbreviation']
                team = row['TeamName']
                pts = float(row.get('Points', 0.0) or 0.0)

                driver_metadata[abbr] = {
                    'BroadcastName': row.get('BroadcastName', abbr),
                    'TeamName': team
                }

                if abbr not in driver_round_points:
                    driver_round_points[abbr] = {}
                driver_round_points[abbr][rnd] = pts

                if team not in constructor_round_points:
                    constructor_round_points[team] = {}
                constructor_round_points[team][rnd] = constructor_round_points[team].get(rnd, 0.0) + pts

        # Compute Driver Standings
        driver_rows = []
        for abbr, meta in driver_metadata.items():
            total_pts = sum(driver_round_points.get(abbr, {}).values())
            wins = driver_wins.get(abbr, 0)
            driver_rows.append({
                'Abbreviation': abbr,
                'BroadcastName': meta['BroadcastName'],
                'TeamName': meta['TeamName'],
                'Points': total_pts,
                'Wins': wins
            })

        driver_standings_df = pd.DataFrame(driver_rows).sort_values(by=['Points', 'Wins'], ascending=[False, False])
        driver_standings_df['Position'] = range(1, len(driver_standings_df) + 1)
        driver_standings = driver_standings_df.to_dict(orient='records')

        # Compute Constructor Standings
        constructor_rows = []
        for team in constructor_round_points.keys():
            total_pts = sum(constructor_round_points[team].values())
            wins = constructor_wins.get(team, 0)
            constructor_rows.append({
                'TeamName': team,
                'Points': total_pts,
                'Wins': wins
            })

        constructor_standings_df = pd.DataFrame(constructor_rows).sort_values(by=['Points', 'Wins'], ascending=[False, False])
        constructor_standings_df['Position'] = range(1, len(constructor_standings_df) + 1)
        constructor_standings = constructor_standings_df.to_dict(orient='records')

        # Build round-by-round cumulative progression
        prog_round_labels = [f"R{rnd}" for rnd in sorted_rounds]
        prog_round_events = [all_race_results[rnd]['info']['name'] for rnd in sorted_rounds]

        prog_drivers = {}
        for row in driver_standings:
            abbr = row['Abbreviation']
            cum = 0.0
            cum_list = []
            for rnd in sorted_rounds:
                cum += driver_round_points.get(abbr, {}).get(rnd, 0.0)
                cum_list.append(round(cum, 1))
            prog_drivers[abbr] = {
                'name': row['BroadcastName'],
                'team': row['TeamName'],
                'points': cum_list
            }

        prog_constructors = {}
        for row in constructor_standings:
            team = row['TeamName']
            cum = 0.0
            cum_list = []
            for rnd in sorted_rounds:
                cum += constructor_round_points.get(team, {}).get(rnd, 0.0)
                cum_list.append(round(cum, 1))
            prog_constructors[team] = {
                'name': team,
                'points': cum_list
            }

        # Latest completed race details
        lr_info = latest_round_data['info']
        lr_results = latest_round_data['results']
        lr_winner = lr_results[lr_results['Position'] == 1]
        winner_dict = {}
        if not lr_winner.empty:
            w_row = lr_winner.iloc[0]
            winner_dict = {
                'BroadcastName': w_row.get('BroadcastName', ''),
                'Abbreviation': w_row.get('Abbreviation', ''),
                'TeamName': w_row.get('TeamName', '')
            }

        podium = []
        for _, p_row in lr_results[lr_results['Position'] <= 3].sort_values('Position').iterrows():
            podium.append({
                'Position': int(p_row['Position']),
                'BroadcastName': p_row.get('BroadcastName', ''),
                'Abbreviation': p_row.get('Abbreviation', ''),
                'TeamName': p_row.get('TeamName', ''),
                'Status': p_row.get('Status', 'Finished')
            })

        latest_race_summary = {
            'EventName': lr_info['name'],
            'RoundNumber': lr_info['round'],
            'Country': lr_info['country'],
            'EventDate': lr_info['date'],
            'Winner': winner_dict,
            'Podium': podium
        }

        return {
            'has_completed_races': True,
            'year': target_year,
            'driver_standings': driver_standings,
            'constructor_standings': constructor_standings,
            'driver_leader': driver_standings[0] if driver_standings else None,
            'constructor_leader': constructor_standings[0] if constructor_standings else None,
            'latest_race': latest_race_summary,
            'next_race': next_race,
            'progression': {
                'rounds': prog_round_labels,
                'events': prog_round_events,
                'drivers': prog_drivers,
                'constructors': prog_constructors
            },
            'race_name': f"{lr_info['name']} {target_year}"
        }
    except Exception as e:
        print(f"Error computing season overview for year {year}: {e}")
        return None


def get_leaderboards(year=None):
    """
    Alias / wrapper around get_season_overview preserving backward compatibility
    with existing callers while providing all enriched metrics.
    """
    return get_season_overview(year)


def get_session_data(year, gp, session_type='Race'):
    """
    Loads complete session data for the specified Grand Prix and session.
    Extracts:
    - Classification with clean types and formatted timings
    - Laps with personal best, sector times, compounds, and speed traps
    - Pit stops and tyre stints
    - Weather conditions and time-series (where available)
    - Fastest lap and session leader summaries
    """
    try:
        session = ff1.get_session(int(year), gp, session_type)
        _fastf1_load(session, laps=True, weather=True)

        results_list = []
        if session.results is not None and not session.results.empty:
            results_list = _clean_dataframe(session.results)

        laps_list = []
        if session.laps is not None and not session.laps.empty:
            laps_copy = session.laps.copy()
            # Convert timedelta to seconds
            for t_col in ['LapTime', 'Sector1Time', 'Sector2Time', 'Sector3Time']:
                if t_col in laps_copy.columns:
                    laps_copy[t_col] = laps_copy[t_col].apply(
                        lambda x: round(x.total_seconds(), 3) if pd.notna(x) and hasattr(x, 'total_seconds') else None
                    )
            laps_list = _clean_dataframe(laps_copy)

        # Fastest lap calculation
        fastest_lap_dict = None
        fastest_lap_driver = 'N/A'
        fastest_lap_time = 0
        if session.laps is not None and not session.laps.empty:
            try:
                fl = session.laps.pick_fastest()
                if fl is not None and pd.notna(fl['LapTime']):
                    fastest_lap_driver = str(fl.get('Driver', 'N/A'))
                    fastest_lap_time = round(fl['LapTime'].total_seconds(), 3)
                    fastest_lap_dict = {
                        'Driver': fastest_lap_driver,
                        'LapTime': fastest_lap_time,
                        'LapNumber': int(fl.get('LapNumber', 0)) if pd.notna(fl.get('LapNumber')) else None,
                        'Team': str(fl.get('Team', ''))
                    }
            except Exception as e:
                print(f"Could not pick fastest lap: {e}")

        # Pit stops and stints extraction
        pit_stops = []
        stints = []
        if session.laps is not None and not session.laps.empty:
            laps_df = session.laps
            if 'PitInTime' in laps_df.columns:
                pit_laps = laps_df[laps_df['PitInTime'].notna()]
                for _, pl in pit_laps.iterrows():
                    pit_in_sec = round(pl['PitInTime'].total_seconds(), 3) if hasattr(pl['PitInTime'], 'total_seconds') else None
                    pit_out_sec = round(pl['PitOutTime'].total_seconds(), 3) if pd.notna(pl.get('PitOutTime')) and hasattr(pl['PitOutTime'], 'total_seconds') else None
                    pit_stops.append({
                        'Driver': str(pl.get('Driver', '')),
                        'Team': str(pl.get('Team', '')),
                        'LapNumber': int(pl['LapNumber']) if pd.notna(pl.get('LapNumber')) else None,
                        'Stint': int(pl['Stint']) if pd.notna(pl.get('Stint')) else 1,
                        'Compound': str(pl.get('Compound', 'UNKNOWN')),
                        'TyreLife': int(pl['TyreLife']) if pd.notna(pl.get('TyreLife')) else None,
                        'PitInTime': pit_in_sec,
                        'PitOutTime': pit_out_sec
                    })

            if 'Stint' in laps_df.columns and 'Driver' in laps_df.columns:
                for (driver_abbr, stint_no), grp in laps_df.groupby(['Driver', 'Stint']):
                    comp = grp['Compound'].dropna().iloc[0] if not grp['Compound'].dropna().empty else 'UNKNOWN'
                    stints.append({
                        'Driver': str(driver_abbr),
                        'Stint': int(stint_no) if pd.notna(stint_no) else 1,
                        'Compound': str(comp),
                        'StartLap': int(grp['LapNumber'].min()) if pd.notna(grp['LapNumber'].min()) else 1,
                        'EndLap': int(grp['LapNumber'].max()) if pd.notna(grp['LapNumber'].max()) else 1,
                        'LapsCount': len(grp)
                    })

        # Weather observations
        weather_data = None
        try:
            w_df = session.weather_data
            if w_df is not None and not w_df.empty:
                air_avg = round(float(w_df['AirTemp'].mean()), 1) if 'AirTemp' in w_df.columns and pd.notna(w_df['AirTemp'].mean()) else None
                track_avg = round(float(w_df['TrackTemp'].mean()), 1) if 'TrackTemp' in w_df.columns and pd.notna(w_df['TrackTemp'].mean()) else None
                track_max = round(float(w_df['TrackTemp'].max()), 1) if 'TrackTemp' in w_df.columns and pd.notna(w_df['TrackTemp'].max()) else None
                hum_avg = round(float(w_df['Humidity'].mean()), 1) if 'Humidity' in w_df.columns and pd.notna(w_df['Humidity'].mean()) else None
                wind_avg = round(float(w_df['WindSpeed'].mean()), 1) if 'WindSpeed' in w_df.columns and pd.notna(w_df['WindSpeed'].mean()) else None
                has_rain = bool(w_df['Rainfall'].any()) if 'Rainfall' in w_df.columns else False

                # Time series samples (every 3rd observation to stay compact and responsive)
                step = max(1, len(w_df) // 25)
                sampled_w = w_df.iloc[::step].copy()

                timeline = []
                air_series = []
                track_series = []
                humidity_series = []
                for _, row in sampled_w.iterrows():
                    t_val = row.get('Time')
                    t_min = round(t_val.total_seconds() / 60.0, 1) if hasattr(t_val, 'total_seconds') else 0
                    timeline.append(f"{t_min}m")
                    air_series.append(_clean_json_value(row.get('AirTemp')))
                    track_series.append(_clean_json_value(row.get('TrackTemp')))
                    humidity_series.append(_clean_json_value(row.get('Humidity')))

                weather_data = {
                    'air_temp_avg': air_avg,
                    'track_temp_avg': track_avg,
                    'track_temp_max': track_max,
                    'humidity_avg': hum_avg,
                    'wind_speed_avg': wind_avg,
                    'rainfall': has_rain,
                    'timeline': timeline,
                    'air_series': air_series,
                    'track_series': track_series,
                    'humidity_series': humidity_series
                }
        except Exception:
            weather_data = None

        # Determine session leader/winner
        session_leader = 'N/A'
        session_leader_team = ''
        if results_list:
            sorted_res = sorted(results_list, key=lambda x: (x.get('Position') is None, x.get('Position', 999)))
            first_driver = sorted_res[0]
            session_leader = first_driver.get('BroadcastName', first_driver.get('Abbreviation', 'N/A'))
            session_leader_team = first_driver.get('TeamName', '')

        classified_count = sum(1 for r in results_list if r.get('Status') == 'Finished' or (r.get('Position') and r.get('Position') <= 20))
        total_laps_count = max([int(r.get('Laps', 0) or 0) for r in results_list]) if results_list else (len(laps_list) // max(1, len(results_list)))

        return {
            'year': int(year),
            'gp': gp,
            'session_name': session.name if hasattr(session, 'name') else session_type,
            'session_type': session_type,
            'date': str(session.date).split('+')[0] if hasattr(session, 'date') and pd.notna(session.date) else None,
            'results': results_list,
            'laps': laps_list,
            'fastest_lap': fastest_lap_dict,
            'fastest_lap_driver': fastest_lap_driver,
            'fastest_lap_time': fastest_lap_time,
            'session_leader': session_leader,
            'session_leader_team': session_leader_team,
            'classified_count': classified_count,
            'total_drivers': len(results_list),
            'total_laps': total_laps_count,
            'pit_stops': pit_stops,
            'stints': stints,
            'weather': weather_data
        }
    except Exception as e:
        print(f"Could not load session data for {year} {gp} {session_type}: {e}")
        return None


def get_lap_time_data(year, gp, driver_abbr, session_type='Race'):
    """
    Fetches comprehensive lap time progression and sector timings for a specific driver.
    """
    try:
        session = ff1.get_session(int(year), gp, session_type)
        session.load(laps=True, telemetry=False, weather=False, messages=False)

        driver_laps = session.laps.pick_driver(driver_abbr).dropna(subset=['LapTime'])
        if driver_laps.empty:
            return None

        lap_time_data = []
        for lap in driver_laps.iterlaps():
            row = lap[1]
            lap_sec = round(row['LapTime'].total_seconds(), 3) if pd.notna(row['LapTime']) else None
            s1_sec = round(row['Sector1Time'].total_seconds(), 3) if pd.notna(row.get('Sector1Time')) and hasattr(row['Sector1Time'], 'total_seconds') else None
            s2_sec = round(row['Sector2Time'].total_seconds(), 3) if pd.notna(row.get('Sector2Time')) and hasattr(row['Sector2Time'], 'total_seconds') else None
            s3_sec = round(row['Sector3Time'].total_seconds(), 3) if pd.notna(row.get('Sector3Time')) and hasattr(row['Sector3Time'], 'total_seconds') else None
            speed_st = float(row.get('SpeedST')) if pd.notna(row.get('SpeedST')) else None

            lap_time_data.append({
                'lap_number': int(row['LapNumber']),
                'lap_time': lap_sec,
                'sector1': s1_sec,
                'sector2': s2_sec,
                'sector3': s3_sec,
                'speed_st': speed_st,
                'compound': str(row.get('Compound', 'UNKNOWN')),
                'tyre_life': int(row['TyreLife']) if pd.notna(row.get('TyreLife')) else None,
                'is_personal_best': bool(row.get('IsPersonalBest', False)),
                'is_accurate': bool(row.get('IsAccurate', True)),
                'pit_in': bool(pd.notna(row.get('PitInTime'))),
                'pit_out': bool(pd.notna(row.get('PitOutTime')))
            })

        return lap_time_data
    except Exception as e:
        print(f"Could not load lap time data for {driver_abbr} in {year} {gp} ({session_type}): {e}")
        return None


def get_driver_comparison(year, driver1_abbr, driver2_abbr):
    """
    Compares the head-to-head performance of two drivers across completed races.
    """
    try:
        schedule = ff1.get_event_schedule(int(year))
        official_rounds = schedule[schedule['RoundNumber'] >= 1].copy()
        today = pd.to_datetime('today')
        completed_races = official_rounds[pd.to_datetime(official_rounds['EventDate']) < today]

        race_names = [race['EventName'] for _, race in completed_races.iterrows() if race.get('Session5') == 'Race']
        if not race_names:
            return None

        stats = {
            driver1_abbr: {'wins': 0, 'podiums': 0, 'points': 0, 'dnfs': 0, 'finishes': []},
            driver2_abbr: {'wins': 0, 'podiums': 0, 'points': 0, 'dnfs': 0, 'finishes': []}
        }

        with ThreadPoolExecutor(max_workers=min(6, len(race_names))) as executor:
            future_to_race = {
                executor.submit(_fetch_race_results, int(year), race_name, 'R'): race_name
                for race_name in race_names
            }
            for future in as_completed(future_to_race):
                race_name = future_to_race[future]
                try:
                    results = future.result()
                    if results is None or results.empty:
                        continue
                    for driver_abbr in [driver1_abbr, driver2_abbr]:
                        driver_result = results[results['Abbreviation'] == driver_abbr]
                        if not driver_result.empty:
                            res = driver_result.iloc[0]
                            stats[driver_abbr]['points'] += float(res.get('Points', 0.0) or 0.0)
                            pos = res.get('Position')
                            if pd.notna(pos):
                                stats[driver_abbr]['finishes'].append(int(pos))
                                if int(pos) == 1:
                                    stats[driver_abbr]['wins'] += 1
                                if int(pos) <= 3:
                                    stats[driver_abbr]['podiums'] += 1
                            if res.get('Status') not in ['Finished', '+1 Lap', '+2 Laps', '+3 Laps']:
                                stats[driver_abbr]['dnfs'] += 1
                except Exception as e:
                    print(f"Could not load session for {race_name}: {e}")

        for driver_abbr in [driver1_abbr, driver2_abbr]:
            finishes = stats[driver_abbr]['finishes']
            stats[driver_abbr]['avg_finish'] = round(sum(finishes) / len(finishes), 2) if finishes else 'N/A'

        return stats
    except Exception as e:
        print(f"Error in driver comparison: {e}")
        return None


def get_tyre_usage(year, gp):
    """
    Fetches the compound distribution counts for a race.
    """
    try:
        session = ff1.get_session(int(year), gp, 'R')
        session.load(laps=True, telemetry=False, weather=False, messages=False)
        tyre_counts = session.laps['Compound'].value_counts().to_dict()
        return {'labels': list(tyre_counts.keys()), 'data': list(tyre_counts.values())}
    except Exception as e:
        print(f"Error fetching tyre usage for {year} {gp}: {e}")
        return None


def get_telemetry_analysis(year, gp, session_type='Race', driver1=None, driver2=None, lap1_num=None, lap2_num=None):
    """
    Performs in-depth telemetry and lap comparison analysis between Driver 1 and Driver 2.
    Returns:
    - Lap comparison metrics (lap time, sector times, speed traps, delta)
    - Available drivers and their valid lap numbers in the session
    - Aligned high-frequency telemetry traces (Speed, Throttle, Brake, Gear, RPM, DRS) when available
    - 2D Circuit map coordinates (X, Y) normalized to aspect ratio
    - Derived micro-sector speed analysis across distance segments
    """
    try:
        session = ff1.get_session(int(year), gp, session_type)
        session.load(telemetry=False, laps=True, weather=False, messages=False)

        if session.laps is None or session.laps.empty:
            return None

        # Build drivers list and their available laps
        drivers_meta = []
        driver_laps_map = {}
        for d_abbr, grp in session.laps.groupby('Driver'):
            clean_grp = grp.dropna(subset=['LapTime'])
            if clean_grp.empty:
                continue
            lap_nums = sorted([int(n) for n in clean_grp['LapNumber'].unique()])
            team_name = str(clean_grp['Team'].iloc[0]) if 'Team' in clean_grp.columns else ''
            driver_laps_map[d_abbr] = lap_nums
            drivers_meta.append({
                'abbr': d_abbr,
                'team': team_name,
                'laps': lap_nums
            })

        if not drivers_meta:
            return None

        # Determine Driver 1
        if not driver1 or driver1 not in driver_laps_map:
            try:
                fl = session.laps.pick_fastest()
                driver1 = fl['Driver'] if fl is not None else drivers_meta[0]['abbr']
            except Exception:
                driver1 = drivers_meta[0]['abbr']

        d1_laps = session.laps.pick_drivers(driver1).dropna(subset=['LapTime'])
        if d1_laps.empty:
            return None

        if lap1_num and int(lap1_num) in d1_laps['LapNumber'].values:
            lap1 = d1_laps[d1_laps['LapNumber'] == int(lap1_num)].iloc[0]
        else:
            lap1 = d1_laps.pick_fastest()

        # Determine Driver 2
        if not driver2 or driver2 == 'none' or driver2 not in driver_laps_map:
            second_drivers = [d['abbr'] for d in drivers_meta if d['abbr'] != driver1]
            if second_drivers:
                driver2 = second_drivers[0]

        lap2 = None
        if driver2 and driver2 in driver_laps_map:
            d2_laps = session.laps.pick_drivers(driver2).dropna(subset=['LapTime'])
            if not d2_laps.empty:
                if lap2_num and int(lap2_num) in d2_laps['LapNumber'].values:
                    lap2 = d2_laps[d2_laps['LapNumber'] == int(lap2_num)].iloc[0]
                else:
                    lap2 = d2_laps.pick_fastest()

        # Extract scalar comparison metrics
        def _extract_lap_metrics(lap_row):
            if lap_row is None:
                return None
            lt = round(lap_row['LapTime'].total_seconds(), 3) if pd.notna(lap_row.get('LapTime')) else None
            s1 = round(lap_row['Sector1Time'].total_seconds(), 3) if pd.notna(lap_row.get('Sector1Time')) and hasattr(lap_row['Sector1Time'], 'total_seconds') else None
            s2 = round(lap_row['Sector2Time'].total_seconds(), 3) if pd.notna(lap_row.get('Sector2Time')) and hasattr(lap_row['Sector2Time'], 'total_seconds') else None
            s3 = round(lap_row['Sector3Time'].total_seconds(), 3) if pd.notna(lap_row.get('Sector3Time')) and hasattr(lap_row['Sector3Time'], 'total_seconds') else None
            return {
                'driver': str(lap_row.get('Driver', '')),
                'team': str(lap_row.get('Team', '')),
                'lap_number': int(lap_row.get('LapNumber', 0)),
                'lap_time': lt,
                'sector1': s1,
                'sector2': s2,
                'sector3': s3,
                'speed_st': float(lap_row.get('SpeedST')) if pd.notna(lap_row.get('SpeedST')) else None,
                'speed_i1': float(lap_row.get('SpeedI1')) if pd.notna(lap_row.get('SpeedI1')) else None,
                'speed_i2': float(lap_row.get('SpeedI2')) if pd.notna(lap_row.get('SpeedI2')) else None,
                'speed_fl': float(lap_row.get('SpeedFL')) if pd.notna(lap_row.get('SpeedFL')) else None,
                'compound': str(lap_row.get('Compound', 'UNKNOWN')),
                'tyre_life': int(lap_row.get('TyreLife')) if pd.notna(lap_row.get('TyreLife')) else None,
                'is_personal_best': bool(lap_row.get('IsPersonalBest', False))
            }

        m1 = _extract_lap_metrics(lap1)
        m2 = _extract_lap_metrics(lap2)

        delta_info = None
        if m1 and m2 and m1['lap_time'] and m2['lap_time']:
            lap_diff = round(m1['lap_time'] - m2['lap_time'], 3)
            s1_diff = round(m1['sector1'] - m2['sector1'], 3) if m1['sector1'] and m2['sector1'] else None
            s2_diff = round(m1['sector2'] - m2['sector2'], 3) if m1['sector2'] and m2['sector2'] else None
            s3_diff = round(m1['sector3'] - m2['sector3'], 3) if m1['sector3'] and m2['sector3'] else None
            st_diff = round(m1['speed_st'] - m2['speed_st'], 1) if m1['speed_st'] and m2['speed_st'] else None
            faster_driver = m1['driver'] if lap_diff < 0 else m2['driver']
            delta_info = {
                'lap_diff': lap_diff,
                's1_diff': s1_diff,
                's2_diff': s2_diff,
                's3_diff': s3_diff,
                'speed_st_diff': st_diff,
                'faster_driver': faster_driver,
                'sign_convention': f"Driver A ({m1['driver']}) − Driver B ({m2['driver']}). Negative value means Driver A is faster."
            }

        # Check high-frequency telemetry & spatial coordinates
        has_telemetry = False
        traces = None
        circuit_map = None
        micro_sectors = None

        try:
            session.load(telemetry=True, laps=True, weather=False, messages=False)
            tel1 = lap1.get_telemetry()
            if tel1 is not None and not tel1.empty and 'Distance' in tel1.columns and 'Speed' in tel1.columns:
                max_d1 = float(tel1['Distance'].max())
                tel2 = lap2.get_telemetry() if lap2 is not None else None

                if tel2 is not None and not tel2.empty and 'Distance' in tel2.columns and 'Speed' in tel2.columns:
                    max_dist = min(max_d1, float(tel2['Distance'].max()))
                    num_pts = 220
                    common_dist = np.linspace(0, max_dist, num_pts)

                    # Interpolations on common distance grid
                    speed1 = np.interp(common_dist, tel1['Distance'], tel1['Speed'])
                    speed2 = np.interp(common_dist, tel2['Distance'], tel2['Speed'])
                    thr1 = np.interp(common_dist, tel1['Distance'], tel1['Throttle'])
                    thr2 = np.interp(common_dist, tel2['Distance'], tel2['Throttle'])
                    brk1 = np.interp(common_dist, tel1['Distance'], tel1['Brake'].astype(float))
                    brk2 = np.interp(common_dist, tel2['Distance'], tel2['Brake'].astype(float))
                    gear1 = np.round(np.interp(common_dist, tel1['Distance'], tel1['nGear']))
                    gear2 = np.round(np.interp(common_dist, tel2['Distance'], tel2['nGear']))
                    rpm1 = np.interp(common_dist, tel1['Distance'], tel1['RPM']) if 'RPM' in tel1.columns else []
                    rpm2 = np.interp(common_dist, tel2['Distance'], tel2['RPM']) if 'RPM' in tel2.columns else []
                    drs1 = np.interp(common_dist, tel1['Distance'], tel1['DRS']) if 'DRS' in tel1.columns else []
                    drs2 = np.interp(common_dist, tel2['Distance'], tel2['DRS']) if 'DRS' in tel2.columns else []

                    # Time delta integration across lap distance
                    v1_ms = np.maximum(speed1 / 3.6, 1.0)
                    v2_ms = np.maximum(speed2 / 3.6, 1.0)
                    dx = np.diff(common_dist, prepend=0)
                    dt1 = dx / v1_ms
                    dt2 = dx / v2_ms
                    cum_delta = np.cumsum(dt1 - dt2)

                    traces = {
                        'distance': [round(float(x), 1) for x in common_dist],
                        'speed1': [round(float(x), 1) for x in speed1],
                        'speed2': [round(float(x), 1) for x in speed2],
                        'throttle1': [round(float(x), 1) for x in thr1],
                        'throttle2': [round(float(x), 1) for x in thr2],
                        'brake1': [1 if x > 0.1 else 0 for x in brk1],
                        'brake2': [1 if x > 0.1 else 0 for x in brk2],
                        'gear1': [int(x) for x in gear1],
                        'gear2': [int(x) for x in gear2],
                        'rpm1': [round(float(x)) for x in rpm1] if len(rpm1) > 0 else [],
                        'rpm2': [round(float(x)) for x in rpm2] if len(rpm2) > 0 else [],
                        'drs1': [1 if x in [10, 12, 14, 1] else 0 for x in drs1] if len(drs1) > 0 else [],
                        'drs2': [1 if x in [10, 12, 14, 1] else 0 for x in drs2] if len(drs2) > 0 else [],
                        'delta': [round(float(x), 3) for x in cum_delta]
                    }

                    # Micro-sectors (20 segments along the track)
                    seg_count = 20
                    seg_edges = np.linspace(0, max_dist, seg_count + 1)
                    micro_sectors = []
                    for s_idx in range(seg_count):
                        s_start = seg_edges[s_idx]
                        s_end = seg_edges[s_idx + 1]
                        mask = (common_dist >= s_start) & (common_dist <= s_end)
                        avg_sp1 = float(np.mean(speed1[mask])) if np.any(mask) else 0.0
                        avg_sp2 = float(np.mean(speed2[mask])) if np.any(mask) else 0.0
                        diff_sp = round(avg_sp1 - avg_sp2, 1)
                        faster = m1['driver'] if diff_sp > 0 else (m2['driver'] if diff_sp < 0 else 'Tied')
                        micro_sectors.append({
                            'segment': s_idx + 1,
                            'start_dist': round(float(s_start)),
                            'end_dist': round(float(s_end)),
                            'speed1': round(avg_sp1, 1),
                            'speed2': round(avg_sp2, 1),
                            'speed_diff': diff_sp,
                            'faster': faster
                        })

                    # Circuit Map coordinates
                    if 'X' in tel1.columns and 'Y' in tel1.columns:
                        cx = np.interp(common_dist, tel1['Distance'], tel1['X'])
                        cy = np.interp(common_dist, tel1['Distance'], tel1['Y'])
                        circuit_map = {
                            'x': [round(float(v), 1) for v in cx],
                            'y': [round(float(v), 1) for v in cy],
                            'speed': [round(float(v), 1) for v in speed1],
                            'distance': [round(float(v), 1) for v in common_dist]
                        }

                    has_telemetry = True

                elif tel1 is not None and not tel1.empty and 'Distance' in tel1.columns:
                    # Single driver telemetry
                    num_pts = 220
                    common_dist = np.linspace(0, max_d1, num_pts)
                    speed1 = np.interp(common_dist, tel1['Distance'], tel1['Speed'])
                    thr1 = np.interp(common_dist, tel1['Distance'], tel1['Throttle'])
                    brk1 = np.interp(common_dist, tel1['Distance'], tel1['Brake'].astype(float))
                    gear1 = np.round(np.interp(common_dist, tel1['Distance'], tel1['nGear']))
                    rpm1 = np.interp(common_dist, tel1['Distance'], tel1['RPM']) if 'RPM' in tel1.columns else []

                    traces = {
                        'distance': [round(float(x), 1) for x in common_dist],
                        'speed1': [round(float(x), 1) for x in speed1],
                        'speed2': [],
                        'throttle1': [round(float(x), 1) for x in thr1],
                        'throttle2': [],
                        'brake1': [1 if x > 0.1 else 0 for x in brk1],
                        'brake2': [],
                        'gear1': [int(x) for x in gear1],
                        'gear2': [],
                        'rpm1': [round(float(x)) for x in rpm1] if len(rpm1) > 0 else [],
                        'rpm2': [],
                        'delta': []
                    }

                    if 'X' in tel1.columns and 'Y' in tel1.columns:
                        cx = np.interp(common_dist, tel1['Distance'], tel1['X'])
                        cy = np.interp(common_dist, tel1['Distance'], tel1['Y'])
                        circuit_map = {
                            'x': [round(float(v), 1) for v in cx],
                            'y': [round(float(v), 1) for v in cy],
                            'speed': [round(float(v), 1) for v in speed1],
                            'distance': [round(float(v), 1) for v in common_dist]
                        }

                    has_telemetry = True

        except Exception as e:
            has_telemetry = False

        return {
            'year': int(year),
            'gp': gp,
            'session': session_type,
            'driver1': m1['driver'],
            'driver2': m2['driver'] if m2 else None,
            'lap1': m1,
            'lap2': m2,
            'delta': delta_info,
            'has_telemetry': has_telemetry,
            'telemetry_message': 'High-frequency telemetry streams are active.' if has_telemetry else 'High-frequency car telemetry is unavailable for this session from the timing feed. Lap timings and sector comparisons are provided.',
            'traces': traces,
            'circuit_map': circuit_map,
            'micro_sectors': micro_sectors,
            'drivers_list': drivers_meta
        }
    except Exception as e:
        print(f"Error in telemetry analysis: {e}")
        return None


def get_team_performance(year):
    """
    Computes constructor analytics:
    - Championship points, wins, podiums
    - Driver points contribution breakdown per constructor
    - Average qualifying vs race finish position per constructor
    """
    try:
        overview = get_season_overview(year)
        if not overview or not overview.get('has_completed_races'):
            return None

        c_standings = overview.get('constructor_standings', [])
        d_standings = overview.get('driver_standings', [])

        team_stats = []
        for c in c_standings:
            team_name = c['TeamName']
            team_drivers = [d for d in d_standings if d.get('TeamName') == team_name]

            total_team_pts = float(c.get('Points', 0.0))
            driver_splits = []
            for d in team_drivers:
                d_pts = float(d.get('Points', 0.0))
                pct = round((d_pts / total_team_pts * 100.0), 1) if total_team_pts > 0 else 50.0
                driver_splits.append({
                    'abbr': d['Abbreviation'],
                    'name': d['BroadcastName'],
                    'points': d_pts,
                    'percentage': pct
                })

            team_stats.append({
                'team': team_name,
                'position': c['Position'],
                'points': total_team_pts,
                'wins': c.get('Wins', 0),
                'drivers': driver_splits
            })

        return {
            'year': int(year),
            'teams': team_stats
        }
    except Exception as e:
        print(f"Error getting team performance for {year}: {e}")
        return None


def get_tyre_degradation(year, gp, driver=None, compound=None):
    """
    Extracts lap time progression against tyre age for degradation curves.
    Uses accurate clean laps to filter out pit stops and safety car laps.
    """
    try:
        session = ff1.get_session(int(year), gp, 'R')
        session.load(telemetry=False, laps=True, weather=False, messages=False)

        if session.laps is None or session.laps.empty:
            return None

        clean_laps = session.laps.pick_wo_box().pick_accurate().dropna(subset=['LapTime', 'Compound', 'TyreLife'])
        if clean_laps.empty:
            clean_laps = session.laps.dropna(subset=['LapTime', 'Compound', 'TyreLife'])

        if driver and driver != 'all':
            clean_laps = clean_laps[clean_laps['Driver'] == driver]

        if compound and compound != 'all':
            clean_laps = clean_laps[clean_laps['Compound'].str.upper() == compound.upper()]

        degradation_data = []
        for _, row in clean_laps.iterrows():
            degradation_data.append({
                'driver': str(row['Driver']),
                'compound': str(row['Compound']).upper(),
                'tyre_life': int(row['TyreLife']),
                'lap_time': round(row['LapTime'].total_seconds(), 3),
                'lap_number': int(row['LapNumber']),
                'stint': int(row['Stint']) if pd.notna(row.get('Stint')) else 1
            })

        return {
            'year': int(year),
            'gp': gp,
            'laps': degradation_data
        }
    except Exception as e:
        print(f"Error extracting tyre degradation for {year} {gp}: {e}")
        return None


def get_season_calendar_details(year):
    """
    Fetches the full calendar enriched with completed race winner, podium,
    and session timetable for the Season Explorer module.
    """
    try:
        schedule = get_race_schedule(year)
        overview = get_season_overview(year)

        completed_rounds_map = {}
        if overview and overview.get('has_completed_races'):
            # Latest race info
            lr = overview.get('latest_race')
            if lr:
                completed_rounds_map[lr['RoundNumber']] = {
                    'winner': lr.get('Winner'),
                    'podium': lr.get('Podium')
                }

        enriched_calendar = []
        for ev in schedule:
            rnd = ev['RoundNumber']
            res_summary = completed_rounds_map.get(rnd, None)
            enriched_calendar.append({
                'RoundNumber': rnd,
                'Country': ev.get('Country', ''),
                'Location': ev.get('Location', ''),
                'OfficialEventName': ev.get('OfficialEventName', ev['EventName']),
                'EventName': ev['EventName'],
                'EventDate': ev['EventDate'],
                'EventFormat': ev.get('EventFormat', 'conventional'),
                'Sessions': ev.get('Sessions', []),
                'SessionDates': ev.get('SessionDates', {}),
                'IsCompleted': ev.get('IsCompleted', False),
                'ResultSummary': res_summary
            })

        return enriched_calendar
    except Exception as e:
        print(f"Error fetching season calendar details for {year}: {e}")
        return []