    
from django.db import models

class DataCache(models.Model):
    # A key to identify the data, e.g., "comparison_2025_VER_HAM"
    cache_key = models.CharField(max_length=255, unique=True, primary_key=True)
    
    # The actual data stored as JSON
    json_data = models.JSONField()
    
    # Timestamp of when the data was created
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Cache for '{self.cache_key}' created at {self.created_at.strftime('%Y-%m-%d %H:%M')}"