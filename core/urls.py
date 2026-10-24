from django.urls import path
from . import views

urlpatterns = [
    # Page URLs
    path('', views.home_view, name='home'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('telemetry/', views.telemetry_view, name='telemetry'),
    path('analytics/', views.analytics_view, name='analytics'),
    path('explorer/', views.explorer_view, name='explorer'),
    path('admin_info/', views.admin_info_view, name='admin_info'),

    # API endpoints for fetching data asynchronously
    path('api/season_overview/<int:year>/', views.api_season_overview, name='api_season_overview'),
    path('api/schedule/<int:year>/', views.api_get_schedule, name='api_get_schedule'),
    path('api/drivers/<int:year>/', views.api_get_drivers, name='api_get_drivers'),
    path('api/sessions/<int:year>/<str:gp>/', views.api_get_sessions, name='api_get_sessions'),
    path('api/session_data/<int:year>/<str:gp>/', views.api_get_session_data, name='api_get_session_data'),
    path('api/lap_time_data/<int:year>/<str:gp>/<str:driver>/', views.api_lap_time_data, name='api_lap_time_data'),
    path('api/driver_comparison/<int:year>/<str:driver1>/<str:driver2>/', views.api_driver_comparison, name='api_driver_comparison'),
    path('api/tyre_usage/<int:year>/<str:gp>/', views.api_tyre_usage, name='api_tyre_usage'),
    path('api/telemetry/<int:year>/<str:gp>/', views.api_telemetry, name='api_telemetry'),
    path('api/team_performance/<int:year>/', views.api_team_performance, name='api_team_performance'),
    path('api/tyre_degradation/<int:year>/<str:gp>/', views.api_tyre_degradation, name='api_tyre_degradation'),
    path('api/season_calendar/<int:year>/', views.api_season_calendar, name='api_season_calendar'),
]