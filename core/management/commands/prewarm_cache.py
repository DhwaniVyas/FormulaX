from datetime import datetime

from django.core.cache import cache
from django.core.management.base import BaseCommand

from core import fastf1_utils
from core.models import DataCache


class Command(BaseCommand):
    help = 'Pre-warm FastF1 and Django cache entries for the latest race and season data.'

    def add_arguments(self, parser):
        parser.add_argument('--year', type=int, help='Year to prewarm cache for')
        parser.add_argument('--gp', type=str, help='Grand Prix event name to prewarm cache for')
        parser.add_argument('--driver1', type=str, help='Driver 1 abbreviation for comparison caching')
        parser.add_argument('--driver2', type=str, help='Driver 2 abbreviation for comparison caching')

    def handle(self, *args, **options):
        year = options.get('year') or datetime.now().year
        gp = options.get('gp')
        driver1 = options.get('driver1')
        driver2 = options.get('driver2')

        self.stdout.write(self.style.NOTICE(f'Prewarming cache for year={year} gp={gp or "latest race"}'))

        schedule = fastf1_utils.get_race_schedule(year)
        DataCache.objects.update_or_create(
            cache_key=f'schedule_{year}',
            defaults={'json_data': schedule}
        )
        cache.set(f'schedule_{year}', schedule, timeout=60 * 60 * 24)

        drivers = fastf1_utils.get_all_drivers_for_year(year)
        DataCache.objects.update_or_create(
            cache_key=f'drivers_{year}',
            defaults={'json_data': drivers}
        )
        cache.set(f'drivers_{year}', drivers, timeout=60 * 60 * 24)

        overview = fastf1_utils.get_season_overview(year)
        if overview:
            DataCache.objects.update_or_create(
                cache_key=f'season_overview_{year}',
                defaults={'json_data': overview}
            )
            cache.set(f'season_overview_{year}', overview, timeout=60 * 60 * 24)
            DataCache.objects.update_or_create(
                cache_key=f'leaderboards_{year}',
                defaults={'json_data': overview}
            )
            cache.set(f'leaderboards_{year}', overview, timeout=60 * 60 * 24)
            self.stdout.write(self.style.SUCCESS(f'Cached season overview for {year}.'))
        else:
            self.stdout.write(self.style.WARNING(f'Season overview could not be cached for {year}.'))

        if gp is None and schedule:
            try:
                gp = sorted(schedule, key=lambda item: item['EventDate'])[-1]['EventName']
            except Exception:
                gp = None

        if gp:
            session_data = fastf1_utils.get_session_data(year, gp, 'R')
            if session_data:
                DataCache.objects.update_or_create(
                    cache_key=f'session_{year}_{gp}',
                    defaults={'json_data': session_data}
                )
                cache.set(f'session_{year}_{gp}', session_data, timeout=60 * 60 * 24)
                self.stdout.write(self.style.SUCCESS(f'Cached session data for {gp}.'))
            else:
                self.stdout.write(self.style.WARNING(f'Could not cache session data for {gp}.'))

            tyre_data = fastf1_utils.get_tyre_usage(year, gp)
            if tyre_data:
                DataCache.objects.update_or_create(
                    cache_key=f'tyre_usage_{year}_{gp}',
                    defaults={'json_data': tyre_data}
                )
                cache.set(f'tyre_usage_{year}_{gp}', tyre_data, timeout=60 * 60 * 24)
                self.stdout.write(self.style.SUCCESS(f'Cached tyre usage data for {gp}.'))
            else:
                self.stdout.write(self.style.WARNING(f'Could not cache tyre usage for {gp}.'))

        if driver1 and driver2:
            comparison_data = fastf1_utils.get_driver_comparison(year, driver1, driver2)
            if comparison_data:
                DataCache.objects.update_or_create(
                    cache_key=f'compare_{year}_{driver1}_{driver2}',
                    defaults={'json_data': comparison_data}
                )
                cache.set(f'compare_{year}_{driver1}_{driver2}', comparison_data, timeout=60 * 60 * 24)
                self.stdout.write(self.style.SUCCESS(f'Cached driver comparison for {driver1} and {driver2}.'))
            else:
                self.stdout.write(self.style.WARNING(f'Could not cache driver comparison for {driver1} and {driver2}.'))

        self.stdout.write(self.style.SUCCESS('Prewarm complete.'))
