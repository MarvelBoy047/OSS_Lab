# core/settings_manager.py
import json
import threading
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime, timezone

class SettingsManager:
    """Manages dynamic user settings with persistent storage and in-memory caching"""
    
    def __init__(self, settings_file: str = "user_settings.json"):
        self.settings_file = Path(settings_file)
        self._cache: Dict[str, Any] = {}
        self._lock = threading.RLock()  # Thread-safe access
        
        # Default user settings
        self.default_settings = {
            "api_key": "",
            "provider": "Groq",
            "model": "openai/gpt-oss-120b",
            "temperature": 0.7,
            "top_p": 0.9,
            "stream": False,
            "embedding_model": "BGE Small",
            "web_search_enabled": True,
            "auto_image_search": True,
            "auto_video_search": False,
            "system_instructions": "",
            "measure_unit": "Metric",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "version": "1.0"
        }
        
        self.load_settings()

    def load_settings(self) -> bool:
        """Load settings from file or create defaults"""
        with self._lock:
            try:
                if self.settings_file.exists():
                    with open(self.settings_file, 'r', encoding='utf-8') as f:
                        file_settings = json.load(f)
                        
                    # Merge with defaults (add any missing keys)
                    self._cache = {**self.default_settings, **file_settings}
                    
                    # Update version if needed
                    if self._cache.get("version") != self.default_settings["version"]:
                        self._cache["version"] = self.default_settings["version"]
                        self.save_settings()
                        
                else:
                    # Create default settings file
                    self._cache = self.default_settings.copy()
                    self.save_settings()
                    
                return True
                
            except Exception as e:
                print(f"[SettingsManager] Failed to load settings: {e}")
                self._cache = self.default_settings.copy()
                return False

    def save_settings(self) -> bool:
        """Save current settings to file"""
        with self._lock:
            try:
                self._cache["updated_at"] = datetime.now(timezone.utc).isoformat()
                
                with open(self.settings_file, 'w', encoding='utf-8') as f:
                    json.dump(self._cache, f, indent=2, ensure_ascii=False)
                    
                return True
                
            except Exception as e:
                print(f"[SettingsManager] Failed to save settings: {e}")
                return False

    def get(self, key: str, default: Any = None) -> Any:
        """Get a setting value"""
        with self._lock:
            return self._cache.get(key, default)

    def set(self, key: str, value: Any) -> bool:
        """Set a setting value and persist"""
        with self._lock:
            self._cache[key] = value
            return self.save_settings()

    def update(self, updates: Dict[str, Any]) -> bool:
        """Update multiple settings at once"""
        with self._lock:
            self._cache.update(updates)
            return self.save_settings()

    def get_all(self) -> Dict[str, Any]:
        """Get all settings (copy to prevent external modification)"""
        with self._lock:
            return self._cache.copy()

    def reset_to_defaults(self) -> bool:
        """Reset all settings to defaults"""
        with self._lock:
            self._cache = self.default_settings.copy()
            return self.save_settings()

    def is_valid_api_key(self, api_key: str = None) -> bool:
        """Validate API key format"""
        key = api_key or self.get("api_key")
        return (key and 
                isinstance(key, str) and 
                len(key) > 20)

    def get_model_config(self) -> Dict[str, Any]:
        """Get current model configuration for AI client"""
        return {
            "api_key": self.get("api_key"),
            "model": self.get("model"),
            "temperature": self.get("temperature"),
            "top_p": self.get("top_p"),
            "stream": self.get("stream"),
        }

    def get_embedding_config(self) -> Dict[str, Any]:
        """Get embedding model configuration"""
        return {
            "model": self.get("embedding_model"),
        }

# Global settings instance
settings_manager = SettingsManager()
