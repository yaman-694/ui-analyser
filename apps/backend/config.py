"""Configuration management for the website analyzer."""

import os
from dataclasses import dataclass
from typing import Dict


@dataclass
class Config:
    """Configuration settings for the website analyzer."""
    
    # Browser Configuration
    max_browsers: int = 4
    max_tabs_per_browser: int = 8
    screenshot_timeout: int = 30000  # milliseconds
    lighthouse_timeout: int = 300    # seconds
    
    # Analysis Thresholds
    load_time_threshold: float = 3.0      # seconds
    performance_score_threshold: int = 70  # percentage
    fcp_threshold: float = 2.5            # seconds
    
    # Docker Configuration
    auto_start_docker: bool = True        # Automatically start Docker if not running
    
    # AI Configuration
    openai_model: str = "gpt-4o"
    openai_max_tokens: int = 1500
    openai_temperature: float = 0.0
    openai_seed: int = 12345
    
    # Screenshot Configuration
    desktop_viewport: Dict[str, int] = None
    mobile_viewport: Dict[str, int] = None
    mobile_user_agent: str = "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)"
    
    def __post_init__(self):
        """Set default viewport configurations."""
        if self.desktop_viewport is None:
            self.desktop_viewport = {"width": 1920, "height": 1080}
        
        if self.mobile_viewport is None:
            self.mobile_viewport = {"width": 375, "height": 667}

    def validate(self) -> None:
        """Validate configuration values."""
        if self.max_browsers <= 0:
            raise ValueError("max_browsers must be positive")
        
        if self.max_tabs_per_browser <= 0:
            raise ValueError("max_tabs_per_browser must be positive")
        
        if self.screenshot_timeout <= 0:
            raise ValueError("screenshot_timeout must be positive")
        
        if self.lighthouse_timeout <= 0:
            raise ValueError("lighthouse_timeout must be positive")
        
        if not os.getenv("OPENAI_API_KEY"):
            raise EnvironmentError("OPENAI_API_KEY environment variable is required")


# Default configuration instance
default_config = Config()
