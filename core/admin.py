from django.contrib import admin
from .models import DataCache

@admin.register(DataCache)
class DataCacheAdmin(admin.ModelAdmin):
    list_display = ('cache_key', 'created_at')
    search_fields = ('cache_key',)
    
    # Action to clear selected cache entries
    def clear_cache(self, request, queryset):
        queryset.delete()
    clear_cache.short_description = "Delete selected cache entries"
    actions = [clear_cache]