"""
Session Manager for 60Saniye Twitter Scraper.
Handles saving, loading, and applying Twitter session cookies.
"""

import json
import os
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent


class SessionManager:
    SESSION_VALIDITY_DAYS = 7

    def __init__(self, session_file: Optional[str] = None):
        self.session_path = Path(session_file) if session_file else (REPO_ROOT / "scraper" / "session.json")

    def load_session(self) -> Optional[Dict]:
        if not self.session_path.exists():
            return None
        try:
            data = json.loads(self.session_path.read_text(encoding="utf-8"))
            if isinstance(data, dict) and "cookies" in data:
                return data
        except Exception as e:
            logger.error(f"Session load error: {e}")
        return None

    def save_session(self, cookies: List[Dict], username: str) -> bool:
        try:
            if self.session_path.exists():
                self.session_path.unlink()
            now = datetime.now()
            data = {
                "username": username,
                "cookies": cookies,
                "saved_at": now.isoformat(),
                "expires_at": (now + timedelta(days=self.SESSION_VALIDITY_DAYS)).isoformat(),
            }
            self.session_path.parent.mkdir(parents=True, exist_ok=True)
            self.session_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            return True
        except Exception as e:
            logger.error(f"Session save error: {e}")
            return False

    def is_session_valid(self) -> bool:
        data = self.load_session()
        if not data:
            return False
        cookies = data.get("cookies", [])
        if not isinstance(cookies, list) or not cookies:
            return False
        names = [c.get("name", "") for c in cookies]
        return any(n in names for n in ("auth_token", "ct0", "twid"))

    def get_cookies(self) -> Optional[List[Dict]]:
        data = self.load_session()
        return data.get("cookies") if data else None

    def load_cookies_to_driver(self, driver) -> bool:
        cookies = self.get_cookies()
        if not cookies:
            return False
        try:
            driver.get("https://x.com")
            import time
            time.sleep(1)
            added = 0
            for cookie in cookies:
                try:
                    sc = {
                        "name": cookie.get("name"),
                        "value": cookie.get("value"),
                        "domain": cookie.get("domain", ".x.com"),
                        "path": cookie.get("path", "/"),
                    }
                    if cookie.get("secure"):
                        sc["secure"] = True
                    if cookie.get("httpOnly"):
                        sc["httpOnly"] = True
                    if cookie.get("expiry"):
                        sc["expiry"] = cookie.get("expiry")
                    driver.add_cookie(sc)
                    added += 1
                except Exception:
                    continue
            if added == 0:
                return False
            driver.refresh()
            return True
        except Exception as e:
            logger.error(f"Cookie load error: {e}")
            return False

    @staticmethod
    def from_env() -> Optional["SessionManager"]:
        """Create session from TWITTER_SESSION_JSON env var (for CI)."""
        raw = os.environ.get("TWITTER_SESSION_JSON")
        if not raw:
            return None
        try:
            data = json.loads(raw)
            tmp_path = REPO_ROOT / "scraper" / "session.json"
            tmp_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            logger.info("Session loaded from environment variable")
            return SessionManager(str(tmp_path))
        except Exception as e:
            logger.error(f"Failed to parse TWITTER_SESSION_JSON: {e}")
            return None
