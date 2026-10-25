from django.shortcuts import render
from django.http import JsonResponse
from django.core.cache import cache
from . import fastf1_utils
from .models import DataCache
from datetime import datetime, timedelta
import re


def _sanitize_key(key):
    """
    Sanitizes string keys for safe use across all cache backends (LocMem, Redis, DB).
    """
    return re.sub(r'[^a-zA-Z0-9_.-]', '_', key)


def _get_cached_response(cache_key, loader, max_age_seconds, max_age_timedelta, fallback_keys=None):
    safe_key = _sanitize_key(cache_key)

    # 1. Check in-memory / Redis cache
    data = cache.get(safe_key)
    if data is not None:
        return data

    if fallback_keys:
        for fb_key in fallback_keys:
            fb_data = cache.get(_sanitize_key(fb_key))
            if fb_data is not None:
                return fb_data

    # 2. Check SQLite DataCache model
    candidate_keys = [safe_key]
    if fallback_keys:
        candidate_keys.extend([_sanitize_key(k) for k in fallback_keys])

    for k in candidate_keys:
        try:
            cached_data = DataCache.objects.get(cache_key=k)
            now_tz = datetime.now(cached_data.created_at.tzinfo)
            if now_tz - cached_data.created_at < max_age_timedelta:
                # Promote to memory cache
                cache.set(safe_key, cached_data.json_data, timeout=max_age_seconds)
                return cached_data.json_data
        except DataCache.DoesNotExist:
            continue

    # 3. Cache miss: execute loader
    try:
        data = loader()
    except Exception as e:
        print(f"Error in loader for key {safe_key}: {e}")
        data = None

    if data is not None:
        try:
            DataCache.objects.update_or_create(cache_key=safe_key, defaults={'json_data': data})
        except Exception as e:
            print(f"Error persisting to DataCache table for key {safe_key}: {e}")
        try:
            cache.set(safe_key, data, timeout=max_age_seconds)
        except Exception as e:
            print(f"Error setting memory cache for key {safe_key}: {e}")
    return data


# --- Page Views ---

def home_view(request):
    current_year = datetime.now().year
    default_year = 2024 if current_year > 2024 else current_year
    years = list(range(current_year, 2017, -1))

    selected_year = request.GET.get('year')
    try:
        selected_year = int(selected_year) if selected_year else default_year
    except ValueError:
        selected_year = default_year

    try:
        overview_data = _get_cached_response(
            f"season_overview_{selected_year}",
            lambda: fastf1_utils.get_season_overview(selected_year),
            max_age_seconds=60 * 60 * 24,
            max_age_timedelta=timedelta(days=1),
            fallback_keys=[f"leaderboards_{selected_year}"]
        )
    except Exception as e:
        print(f"Error retrieving season overview for {selected_year}: {e}")
        overview_data = None

    context = {
        'years': years,
        'selected_year': selected_year,
        'overview': overview_data,
        'leaderboards': overview_data,  # Backward compatibility
    }
    return render(request, 'core/home.html', context)


def dashboard_view(request):
    current_year = datetime.now().year
    default_year = 2024 if current_year > 2024 else current_year
    years = list(range(current_year, 2017, -1))

    selected_year = request.GET.get('year', default_year)
    try:
        selected_year = int(selected_year)
    except ValueError:
        selected_year = default_year

    selected_gp = request.GET.get('gp', 'Bahrain Grand Prix')
    selected_session = request.GET.get('session', 'Race')

    context = {
        'years': years,
        'year': selected_year,
        'gp': selected_gp,
        'session': selected_session,
    }
    return render(request, 'core/dashboard.html', context)


def telemetry_view(request):
    current_year = datetime.now().year
    default_year = 2024 if current_year > 2024 else current_year
    years = list(range(current_year, 2017, -1))

    selected_year = request.GET.get('year', default_year)
    try:
        selected_year = int(selected_year)
    except ValueError:
        selected_year = default_year

    selected_gp = request.GET.get('gp', 'Bahrain Grand Prix')
    selected_session = request.GET.get('session', 'Race')
    d1 = request.GET.get('driver1', '')
    d2 = request.GET.get('driver2', '')

    context = {
        'years': years,
        'year': selected_year,
        'gp': selected_gp,
        'session': selected_session,
        'driver1': d1,
        'driver2': d2,
    }
    return render(request, 'core/telemetry.html', context)


def analytics_view(request):
    current_year = datetime.now().year
    default_year = 2024 if current_year > 2024 else current_year
    years = list(range(current_year, 2017, -1))

    selected_year = request.GET.get('year', default_year)
    try:
        selected_year = int(selected_year)
    except ValueError:
        selected_year = default_year

    selected_gp = request.GET.get('gp', 'Bahrain Grand Prix')
    selected_tab = request.GET.get('tab', 'tab-driver-comp')
    d1 = request.GET.get('driver1', '')
    d2 = request.GET.get('driver2', '')

    context = {
        'years': years,
        'year': selected_year,
        'gp': selected_gp,
        'tab': selected_tab,
        'driver1': d1,
        'driver2': d2,
    }
    return render(request, 'core/analytics.html', context)


def explorer_view(request):
    current_year = datetime.now().year
    default_year = 2024 if current_year > 2024 else current_year
    years = list(range(current_year, 2017, -1))

    selected_year = request.GET.get('year', default_year)
    try:
        selected_year = int(selected_year)
    except ValueError:
        selected_year = default_year

    context = {
        'years': years,
        'selected_year': selected_year,
    }
    return render(request, 'core/explorer.html', context)


def admin_info_view(request):
    return render(request, 'core/admin_info.html')


# --- API Endpoints ---

def api_season_overview(request, year):
    overview_data = _get_cached_response(
        f"season_overview_{year}",
        lambda: fastf1_utils.get_season_overview(year),
        max_age_seconds=60 * 60 * 24,
        max_age_timedelta=timedelta(days=1),
        fallback_keys=[f"leaderboards_{year}"]
    )
    if overview_data:
        return JsonResponse(overview_data)
    return JsonResponse({'error': f'Season overview for {year} unavailable.'}, status=404)


def api_get_schedule(request, year):
    schedule_data = _get_cached_response(
        f"schedule_{year}",
        lambda: fastf1_utils.get_race_schedule(year),
        max_age_seconds=60 * 60 * 24,
        max_age_timedelta=timedelta(days=1)
    )
    return JsonResponse(schedule_data or [], safe=False)


def api_get_drivers(request, year):
    driver_data = _get_cached_response(
        f"drivers_{year}",
        lambda: fastf1_utils.get_all_drivers_for_year(year),
        max_age_seconds=60 * 60 * 24,
        max_age_timedelta=timedelta(days=1)
    )
    return JsonResponse(driver_data or [], safe=False)


def api_get_sessions(request, year, gp):
    schedule = _get_cached_response(
        f"schedule_{year}",
        lambda: fastf1_utils.get_race_schedule(year),
        max_age_seconds=60 * 60 * 24,
        max_age_timedelta=timedelta(days=1)
    )
    if schedule:
        for ev in schedule:
            if ev.get('EventName') == gp:
                return JsonResponse({'gp': gp, 'sessions': ev.get('Sessions', ['Race'])})
    return JsonResponse({'gp': gp, 'sessions': ['Practice 1', 'Practice 2', 'Practice 3', 'Qualifying', 'Race']})


def api_get_session_data(request, year, gp):
    session_name = request.GET.get('session', 'Race')
    safe_session = _sanitize_key(session_name)
    safe_gp = _sanitize_key(gp)

    cache_key = f"session_{year}_{safe_gp}_{safe_session}"
    fallback_keys = []
    if session_name.lower() in ['race', 'r']:
        fallback_keys.append(f"session_{year}_{gp}")

    session_data = _get_cached_response(
        cache_key,
        lambda: fastf1_utils.get_session_data(year, gp, session_name),
        max_age_seconds=60 * 60 * 24,
        max_age_timedelta=timedelta(days=1),
        fallback_keys=fallback_keys
    )
    return JsonResponse(session_data) if session_data else JsonResponse({'error': f'Session data for {year} {gp} ({session_name}) not found.'}, status=404)


def api_lap_time_data(request, year, gp, driver):
    session_name = request.GET.get('session', 'Race')
    safe_session = _sanitize_key(session_name)
    safe_gp = _sanitize_key(gp)

    cache_key = f"lap_times_{year}_{safe_gp}_{driver}_{safe_session}"
    fallback_keys = []
    if session_name.lower() in ['race', 'r']:
        fallback_keys.append(f"lap_times_{year}_{gp}_{driver}")

    lap_data = _get_cached_response(
        cache_key,
        lambda: fastf1_utils.get_lap_time_data(year, gp, driver, session_name),
        max_age_seconds=60 * 60 * 24 * 7,
        max_age_timedelta=timedelta(days=7),
        fallback_keys=fallback_keys
    )
    if lap_data:
        return JsonResponse(lap_data, safe=False)
    return JsonResponse({'error': f'Could not generate lap time data for {driver}.'}, status=404)


def api_driver_comparison(request, year, driver1, driver2):
    cache_key = f"compare_{year}_{driver1}_{driver2}"
    comparison_data = _get_cached_response(
        cache_key,
        lambda: fastf1_utils.get_driver_comparison(year, driver1, driver2),
        max_age_seconds=60 * 60 * 24,
        max_age_timedelta=timedelta(days=1)
    )
    if comparison_data:
        return JsonResponse(comparison_data)
    return JsonResponse({'error': 'Could not generate driver comparison.'}, status=404)


def api_tyre_usage(request, year, gp):
    safe_gp = _sanitize_key(gp)
    cache_key = f"tyre_usage_{year}_{safe_gp}"
    tyre_data = _get_cached_response(
        cache_key,
        lambda: fastf1_utils.get_tyre_usage(year, gp),
        max_age_seconds=60 * 60 * 24,
        max_age_timedelta=timedelta(days=1),
        fallback_keys=[f"tyre_usage_{year}_{gp}"]
    )
    return JsonResponse(tyre_data) if tyre_data else JsonResponse({'error': 'Could not get tyre usage data.'}, status=404)


def api_telemetry(request, year, gp):
    session_name = request.GET.get('session', 'Race')
    driver1 = request.GET.get('driver1', None)
    driver2 = request.GET.get('driver2', None)
    lap1 = request.GET.get('lap1', None)
    lap2 = request.GET.get('lap2', None)
    try:
        lap1_num = int(lap1) if lap1 else None
    except ValueError:
        lap1_num = None
    try:
        lap2_num = int(lap2) if lap2 else None
    except ValueError:
        lap2_num = None

    safe_gp = _sanitize_key(gp)
    safe_session = _sanitize_key(session_name)
    safe_d1 = _sanitize_key(driver1 or 'default')
    safe_d2 = _sanitize_key(driver2 or 'none')
    cache_key = f"telemetry_{year}_{safe_gp}_{safe_session}_{safe_d1}_{safe_d2}_{lap1_num}_{lap2_num}"

    data = _get_cached_response(
        cache_key,
        lambda: fastf1_utils.get_telemetry_analysis(
            year, gp, session_name, driver1, driver2, lap1_num, lap2_num
        ),
        max_age_seconds=60 * 60 * 24 * 7,
        max_age_timedelta=timedelta(days=7)
    )
    if data:
        return JsonResponse(data)
    return JsonResponse({'error': f'Telemetry data for {year} {gp} ({session_name}) could not be generated.'}, status=404)


def api_team_performance(request, year):
    cache_key = f"team_perf_{year}"
    data = _get_cached_response(
        cache_key,
        lambda: fastf1_utils.get_team_performance(year),
        max_age_seconds=60 * 60 * 24,
        max_age_timedelta=timedelta(days=1)
    )
    if data:
        return JsonResponse(data)
    return JsonResponse({'error': f'Team performance data for {year} unavailable.'}, status=404)


def api_tyre_degradation(request, year, gp):
    driver = request.GET.get('driver', 'all')
    compound = request.GET.get('compound', 'all')
    safe_gp = _sanitize_key(gp)
    safe_driver = _sanitize_key(driver)
    safe_comp = _sanitize_key(compound)
    cache_key = f"tyre_deg_{year}_{safe_gp}_{safe_driver}_{safe_comp}"

    data = _get_cached_response(
        cache_key,
        lambda: fastf1_utils.get_tyre_degradation(year, gp, driver, compound),
        max_age_seconds=60 * 60 * 24 * 7,
        max_age_timedelta=timedelta(days=7)
    )
    if data:
        return JsonResponse(data)
    return JsonResponse({'error': f'Tyre degradation data for {year} {gp} unavailable.'}, status=404)


def api_season_calendar(request, year):
    cache_key = f"season_calendar_{year}"
    data = _get_cached_response(
        cache_key,
        lambda: fastf1_utils.get_season_calendar_details(year),
        max_age_seconds=60 * 60 * 24,
        max_age_timedelta=timedelta(days=1)
    )
    if data:
        return JsonResponse(data, safe=False)
    return JsonResponse([], safe=False)