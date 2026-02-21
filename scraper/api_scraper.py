"""
60Saniye Autonomous Twitter Scraper
Uses undetected-chromedriver with session cookies for reliable scraping.
Reads profiles from target_profiles.txt, scrapes video tweets, merges with existing data.
"""

import json
import logging
import random
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional

import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException

from session_manager import SessionManager
from dom_extractor import build_extraction_script, build_fallback_extraction_script

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parent.parent
MAX_TOTAL_TWEETS = 500
TARGET_VIDEO_TWEETS = 20
TIMEOUT = 30


def load_profiles() -> List[str]:
    pfile = REPO_ROOT / "target_profiles.txt"
    try:
        if not pfile.exists():
            return ["buzzhaber"]
        lines = pfile.read_text(encoding="utf-8").strip().splitlines()
        return [
            ln.strip().lstrip("@")
            for ln in lines
            if ln.strip() and not ln.strip().startswith("#")
        ] or ["buzzhaber"]
    except Exception:
        return ["buzzhaber"]


def init_driver(headless: bool, session_mgr: SessionManager):
    options = uc.ChromeOptions()
    if headless:
        options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=800,600")
    options.add_argument("--window-position=9999,9999")
    options.add_argument("--no-first-run")
    options.add_argument("--no-default-browser-check")
    options.add_argument("--disable-infobars")

    driver = uc.Chrome(options=options, version_main=None)
    wait = WebDriverWait(driver, TIMEOUT)

    time.sleep(0.5)

    if session_mgr.is_session_valid():
        if session_mgr.load_cookies_to_driver(driver):
            logger.info("Session cookies loaded")
            try:
                driver.get("https://x.com/home")
                time.sleep(2)
                wait.until(EC.presence_of_element_located(
                    (By.CSS_SELECTOR, "[data-testid='primaryColumn'], article")
                ))
                logger.info("Session verified - logged in")
            except TimeoutException:
                logger.warning("Session may be expired - continuing anyway")
        else:
            logger.warning("Failed to load cookies")
    else:
        logger.warning("No valid session found - scraping as guest (limited)")

    return driver, wait


def dismiss_login_gate(driver):
    try:
        driver.find_element(By.TAG_NAME, "body").send_keys(Keys.ESCAPE)
        time.sleep(random.uniform(0.3, 0.6))
    except Exception:
        pass
    for sel in [
        "div[role='dialog'] [aria-label='Kapat']",
        "div[role='dialog'] [aria-label='Close']",
        "button[aria-label='Close']",
        "[data-testid='app-bar-close']",
        "[data-testid='sheetDialog'] [aria-label='Close']",
    ]:
        try:
            els = driver.find_elements(By.CSS_SELECTOR, sel)
            if els:
                els[0].click()
                time.sleep(random.uniform(0.3, 0.6))
                break
        except Exception:
            continue
    try:
        driver.execute_script("""
            for (const n of document.querySelectorAll("div[role='dialog'], [data-testid='sheetDialog']"))
                n.style.display='none';
            const h=document.querySelector('html');
            if(h&&h.style.overflow==='hidden') h.style.overflow='auto';
        """)
    except Exception:
        pass


def goto_profile(driver, wait, profile: str) -> bool:
    urls = [
        f"https://x.com/{profile}",
        f"https://twitter.com/{profile}",
    ]
    for url in urls:
        try:
            driver.get(url)
            wait.until(lambda d: d.execute_script("return document.readyState") == "complete")
            time.sleep(random.uniform(2.0, 3.0))
            dismiss_login_gate(driver)
            current = driver.current_url or ""
            if "login" in current or "/i/flow/login" in current:
                continue
            try:
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "article")))
                time.sleep(random.uniform(0.8, 1.2))
                articles = driver.find_elements(By.CSS_SELECTOR, "article")
                if articles:
                    return True
            except TimeoutException:
                continue
        except Exception:
            continue
    return False


def extract_tweets(driver, profile: str) -> List[Dict]:
    try:
        time.sleep(0.5)
        script = build_extraction_script(profile)
        result = driver.execute_script(script)
        if result is None:
            fallback = build_fallback_extraction_script(profile)
            result = driver.execute_script(fallback)
        if isinstance(result, list):
            return result
    except Exception as e:
        logger.error(f"DOM extraction error for @{profile}: {e}")
    return []


def scrape_profile(driver, wait, profile: str) -> List[Dict]:
    logger.info(f"Scraping @{profile}...")
    if not goto_profile(driver, wait, profile):
        logger.warning(f"Failed to load @{profile}")
        return []

    for _ in range(2):
        driver.execute_script(f"window.scrollBy(0, {random.randint(400, 800)});")
        time.sleep(random.uniform(0.8, 1.2))
        dismiss_login_gate(driver)

    collected: List[Dict] = []
    seen_ids: set = set()
    no_new = 0

    while len(collected) < TARGET_VIDEO_TWEETS and no_new < 3:
        raw = extract_tweets(driver, profile)
        new_count = 0
        for tweet in raw:
            tid = tweet.get("id")
            if tid and tid not in seen_ids and tweet.get("video"):
                seen_ids.add(tid)
                collected.append(tweet)
                new_count += 1
        if new_count == 0:
            no_new += 1
        else:
            no_new = 0
        if len(collected) >= TARGET_VIDEO_TWEETS:
            break
        driver.execute_script(f"window.scrollBy(0, {random.randint(800, 1400)});")
        time.sleep(random.uniform(1.2, 1.8))
        dismiss_login_gate(driver)

    result = collected[:TARGET_VIDEO_TWEETS]
    logger.info(f"  Got {len(result)} video tweets from @{profile}")
    return result


def load_existing(data_dir: Path) -> List[Dict]:
    f = data_dir / "tweets.json"
    try:
        if f.exists():
            return json.loads(f.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []


def save_tweets(data_dir: Path, new_tweets: List[Dict]):
    existing = load_existing(data_dir)
    by_id = {t.get("id"): t for t in existing if t.get("id")}
    for t in new_tweets:
        if t.get("id"):
            by_id[t["id"]] = t
    merged = list(by_id.values())
    merged.sort(key=lambda x: x.get("time", ""), reverse=True)
    merged = merged[:MAX_TOTAL_TWEETS]
    out = data_dir / "tweets.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)
    logger.info(f"Saved {len(merged)} total tweets (merged, deduped, capped at {MAX_TOTAL_TWEETS})")


def main():
    data_dir = REPO_ROOT / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    headless = "--no-headless" not in sys.argv

    session_mgr = SessionManager.from_env() or SessionManager()

    profiles = load_profiles()
    if len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
        profiles = [sys.argv[1].lstrip("@")]

    logger.info(f"Profiles to scrape: {profiles}")

    driver = None
    try:
        driver, wait = init_driver(headless, session_mgr)
        all_tweets: List[Dict] = []

        for i, profile in enumerate(profiles, 1):
            logger.info(f"[{i}/{len(profiles)}] @{profile}")
            tweets = scrape_profile(driver, wait, profile)
            all_tweets.extend(tweets)
            if i < len(profiles):
                time.sleep(random.uniform(2, 4))

        if all_tweets:
            save_tweets(data_dir, all_tweets)
            logger.info(f"Done: {len(all_tweets)} video tweets from {len(profiles)} profiles")
        else:
            logger.warning("No video tweets scraped from any profile")
    except Exception as e:
        logger.error(f"Scraper error: {e}", exc_info=True)
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass


if __name__ == "__main__":
    main()
