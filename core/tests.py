from django.test import TestCase, Client
from django.urls import reverse
from django.core.cache import cache
from core.models import DataCache
from core import fastf1_utils
from core.views import _sanitize_key, _get_cached_response
import pandas as pd
import numpy as np
from datetime import timedelta, datetime
import json


class TestFastF1Utils(TestCase):
    def test_clean_json_value_primitives(self):
        self.assertIsNone(fastf1_utils._clean_json_value(None))
        self.assertIsNone(fastf1_utils._clean_json_value(np.nan))
        self.assertIsNone(fastf1_utils._clean_json_value(pd.NaT))
        self.assertEqual(fastf1_utils._clean_json_value(42), 42)
        self.assertEqual(fastf1_utils._clean_json_value(np.int64(99)), 99)
        self.assertEqual(fastf1_utils._clean_json_value(3.14159), 3.14159)
        self.assertEqual(fastf1_utils._clean_json_value(np.float64(2.718)), 2.718)
        self.assertTrue(fastf1_utils._clean_json_value(True))
        self.assertFalse(fastf1_utils._clean_json_value(False))

    def test_clean_json_value_timedeltas_and_timestamps(self):
        td = pd.Timedelta(seconds=92.608)
        self.assertEqual(fastf1_utils._clean_json_value(td), 92.608)

        ts = pd.Timestamp('2024-03-02 15:00:00')
        self.assertEqual(fastf1_utils._clean_json_value(ts), '2024-03-02T15:00:00')

    def test_clean_dataframe(self):
        df = pd.DataFrame({
            'Driver': ['VER', 'HAM'],
            'Time': [pd.Timedelta(seconds=90.1), pd.NaT],
            'Points': [np.float64(25.0), np.nan],
            'Position': [np.int64(1), np.int64(2)]
        })
        cleaned = fastf1_utils._clean_dataframe(df)
        self.assertEqual(len(cleaned), 2)
        self.assertEqual(cleaned[0]['Driver'], 'VER')
        self.assertEqual(cleaned[0]['Time'], 90.1)
        self.assertEqual(cleaned[0]['Points'], 25.0)
        self.assertEqual(cleaned[0]['Position'], 1)
        self.assertIsNone(cleaned[1]['Time'])
        self.assertIsNone(cleaned[1]['Points'])

        # Guarantee standard json.dumps serializes without error
        json_str = json.dumps(cleaned)
        self.assertIn('"VER"', json_str)
class TestCoreViewsAndRouting(TestCase):
    def setUp(self):
        self.client = Client()
        current_year = datetime.now().year
        default_year = 2024 if current_year > 2024 else current_year
        for yr in set([current_year, default_year]):
            DataCache.objects.create(
                cache_key=f"season_overview_{yr}",
                json_data={
                    'has_completed_races': False,
                    'year': yr,
                    'driver_standings': [],
                    'constructor_standings': [],
                    'driver_leader': None,
                    'constructor_leader': None,
                    'latest_race': None,
                    'next_race': None,
                    'progression': {'rounds': [], 'drivers': {}, 'constructors': {}},
                    'race_name': f'No completed races in {yr}'
                }
            )

    def test_sanitize_key(self):
        self.assertEqual(_sanitize_key("session_2024_Bahrain Grand Prix_Race"), "session_2024_Bahrain_Grand_Prix_Race")
        self.assertEqual(_sanitize_key("lap_times/2024#1"), "lap_times_2024_1")

    def test_home_view(self):
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'core/home.html')
        self.assertTemplateUsed(response, 'core/base.html')
        self.assertIn('years', response.context)
        self.assertIn('selected_year', response.context)

    def test_dashboard_view(self):
        response = self.client.get(reverse('dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'core/dashboard.html')
        self.assertIn('year', response.context)
        self.assertIn('gp', response.context)
        self.assertIn('session', response.context)

    def test_telemetry_view(self):
        response = self.client.get(reverse('telemetry'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'core/telemetry.html')
        self.assertIn('year', response.context)
        self.assertIn('gp', response.context)
        self.assertIn('session', response.context)

    def test_analytics_view(self):
        response = self.client.get(reverse('analytics'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'core/analytics.html')
        self.assertIn('tab', response.context)

    def test_explorer_view(self):
        response = self.client.get(reverse('explorer'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'core/explorer.html')
        self.assertIn('selected_year', response.context)

    def test_admin_info_view(self):
        response = self.client.get(reverse('admin_info'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'core/admin_info.html')


class TestDataCacheAndApiEndpoints(TestCase):
    def setUp(self):
        self.client = Client()
        cache.clear()
        # Seed a dummy cached session to test fast API retrieval
        self.test_session_payload = {
            'year': 2024,
            'gp': 'Test Grand Prix',
            'session_name': 'Race',
            'session_type': 'R',
            'fastest_lap_driver': 'VER',
            'fastest_lap_time': 92.5,
            'results': [
                {'Position': 1, 'BroadcastName': 'M VERSTAPPEN', 'Abbreviation': 'VER', 'TeamName': 'Red Bull Racing', 'Points': 25.0, 'Status': 'Finished'}
            ],
            'laps': [
                {'Driver': 'VER', 'LapNumber': 1, 'LapTime': 95.0, 'Team': 'Red Bull Racing', 'IsPersonalBest': True}
            ],
            'pit_stops': [],
            'stints': [],
            'weather': None
        }
        DataCache.objects.create(
            cache_key='session_2024_Test_Grand_Prix_Race',
            json_data=self.test_session_payload
        )

        self.test_overview_payload = {
            'has_completed_races': True,
            'year': 2024,
            'driver_standings': [
                {'Position': 1, 'Abbreviation': 'VER', 'BroadcastName': 'M VERSTAPPEN', 'TeamName': 'Red Bull Racing', 'Points': 25.0, 'Wins': 1}
            ],
            'constructor_standings': [
                {'Position': 1, 'TeamName': 'Red Bull Racing', 'Points': 25.0, 'Wins': 1}
            ],
            'driver_leader': {'BroadcastName': 'M VERSTAPPEN', 'TeamName': 'Red Bull Racing', 'Points': 25.0},
            'constructor_leader': {'TeamName': 'Red Bull Racing', 'Points': 25.0},
            'latest_race': {'EventName': 'Test Grand Prix', 'RoundNumber': 1, 'Country': 'Testland'},
            'next_race': None,
            'progression': {'rounds': ['R1'], 'events': ['Test GP'], 'drivers': {}, 'constructors': {}},
            'race_name': 'Test Grand Prix 2024'
        }
        DataCache.objects.create(
            cache_key='season_overview_2024',
            json_data=self.test_overview_payload
        )

        # Seed Telemetry
        DataCache.objects.create(
            cache_key='telemetry_2024_Test_Grand_Prix_Race_default_none_None_None',
            json_data={
                'year': 2024,
                'gp': 'Test Grand Prix',
                'session': 'Race',
                'driver1': 'VER',
                'driver2': 'HAM',
                'has_telemetry': True,
                'distance': [0, 50, 100],
                'time_delta': [0, -0.05, -0.1],
                'lap1': {'lap_number': 1, 'lap_time': 90.0},
                'lap2': {'lap_number': 1, 'lap_time': 90.1},
                'micro_sectors': []
            }
        )

        # Seed Team Performance
        DataCache.objects.create(
            cache_key='team_perf_2024',
            json_data={
                'year': 2024,
                'teams': [
                    {'team': 'Red Bull Racing', 'position': 1, 'points': 860.0, 'wins': 21, 'drivers': []}
                ]
            }
        )

        # Seed Tyre Degradation
        DataCache.objects.create(
            cache_key='tyre_deg_2024_Test_Grand_Prix_all_all',
            json_data={
                'year': 2024,
                'gp': 'Test Grand Prix',
                'laps': [
                    {'driver': 'VER', 'compound': 'MEDIUM', 'tyre_life': 5, 'lap_time': 92.4}
                ]
            }
        )

        # Seed Season Calendar
        DataCache.objects.create(
            cache_key='season_calendar_2024',
            json_data=[
                {
                    'RoundNumber': 1,
                    'EventName': 'Test Grand Prix',
                    'Country': 'Testland',
                    'EventDate': '2024-03-02',
                    'IsCompleted': True,
                    'Sessions': ['Practice 1', 'Practice 2', 'Practice 3', 'Qualifying', 'Race']
                }
            ]
        )

    def test_api_session_data_cached(self):
        response = self.client.get('/api/session_data/2024/Test Grand Prix/?session=Race')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['fastest_lap_driver'], 'VER')
        self.assertEqual(len(data['results']), 1)
        self.assertEqual(data['results'][0]['Abbreviation'], 'VER')

    def test_api_season_overview_cached(self):
        response = self.client.get('/api/season_overview/2024/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['has_completed_races'])
        self.assertEqual(data['driver_leader']['BroadcastName'], 'M VERSTAPPEN')

    def test_api_get_sessions_fallback(self):
        response = self.client.get('/api/sessions/2024/Unknown GP/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('sessions', data)
        self.assertIn('Race', data['sessions'])

    def test_api_telemetry_cached(self):
        response = self.client.get('/api/telemetry/2024/Test Grand Prix/?session=Race')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['driver1'], 'VER')
        self.assertTrue(data['has_telemetry'])

    def test_api_team_performance_cached(self):
        response = self.client.get('/api/team_performance/2024/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['teams'][0]['team'], 'Red Bull Racing')

    def test_api_tyre_degradation_cached(self):
        response = self.client.get('/api/tyre_degradation/2024/Test Grand Prix/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data['laps']), 1)
        self.assertEqual(data['laps'][0]['driver'], 'VER')

    def test_api_season_calendar_cached(self):
        response = self.client.get('/api/season_calendar/2024/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['EventName'], 'Test Grand Prix')


class TestDeploymentAndEdgeCases(TestCase):
    def setUp(self):
        self.client = Client()
        cache.clear()

    def test_home_view_cold_start_empty_cache(self):
        """Home page should render reliably with HTTP 200 even when DataCache is totally empty."""
        DataCache.objects.all().delete()
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'core/home.html')
        self.assertIn('years', response.context)
        self.assertIn('selected_year', response.context)

    def test_home_view_invalid_year_handled(self):
        """Invalid year parameters should fall back safely without error."""
        response = self.client.get(reverse('home') + '?year=invalid_string')
        self.assertEqual(response.status_code, 200)

    def test_api_empty_schedule_returns_empty_list(self):
        """API get_schedule should return an empty list rather than null when empty."""
        response = self.client.get('/api/schedule/1950/')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)

    def test_api_empty_drivers_returns_empty_list(self):
        """API get_drivers should return an empty list rather than null when empty."""
        response = self.client.get('/api/drivers/1950/')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)

    def test_api_empty_calendar_returns_empty_list(self):
        """API season_calendar should return an empty list rather than 404 when empty."""
        response = self.client.get('/api/season_calendar/1950/')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)

    def test_render_production_settings(self):
        """Verify settings required for Render deployment."""
        from django.conf import settings
        self.assertIn(".onrender.com", settings.ALLOWED_HOSTS)
        self.assertTrue(any(".onrender.com" in orig for orig in settings.CSRF_TRUSTED_ORIGINS))
        self.assertEqual(
            settings.STORAGES['staticfiles']['BACKEND'],
            'whitenoise.storage.CompressedStaticFilesStorage'
        )
        self.assertFalse(settings.WHITENOISE_MANIFEST_STRICT)


