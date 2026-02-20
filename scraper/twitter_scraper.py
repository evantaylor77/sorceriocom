"""
60Saniye Twitter Scraper
Scrapes video tweets from @buzzhaber profile for the 60Saniye news platform.
"""

import json
import logging
import random
import time
from pathlib import Path
from typing import List, Dict, Optional

import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException

from dom_extractor import build_extraction_script, build_fallback_extraction_script
from video_downloader import VideoDownloader

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class TwitterScraper:
    """Scraper for @buzzhaber Twitter profile."""

    TIMEOUT = 30
    TARGET_TWEETS = 20
    MAX_SCROLL_ATTEMPTS = 10

    def __init__(self, headless: bool = True, data_dir: Optional[Path] = None):
        """Initialize scraper.

        Args:
            headless: Run browser in headless mode
            data_dir: Directory to save scraped data
        """
        self.headless = headless
        self.data_dir = data_dir or Path("data")
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self.driver: Optional[uc.Chrome] = None
        self.wait: Optional[WebDriverWait] = None

        # Initialize video downloader
        self.videos_dir = self.data_dir / "videos"
        self.video_downloader = VideoDownloader(self.videos_dir)

    def _init_driver(self) -> bool:
        """Initialize Chrome driver.

        Returns:
            True if driver initialized successfully
        """
        try:
            logger.info("Initializing Chrome driver...")
            options = uc.ChromeOptions()

            # Add options for stability
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-gpu')
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_argument('--log-level=3')

            if self.headless:
                options.add_argument('--headless=new')

            self.driver = uc.Chrome(options=options, version_main=None)
            self.wait = WebDriverWait(self.driver, self.TIMEOUT)

            logger.info("Chrome driver initialized successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize driver: {e}")
            return False

    def _close_driver(self):
        """Close the Chrome driver."""
        if self.driver:
            try:
                self.driver.quit()
                logger.info("Driver closed")
            except Exception as e:
                logger.error(f"Error closing driver: {e}")
            finally:
                self.driver = None
                self.wait = None

    def _human_pause(self, min_sec: float = 0.5, max_sec: float = 1.5):
        """Pause for a random human-like duration."""
        time.sleep(random.uniform(min_sec, max_sec))

    def _goto_profile_url(self, profile: str) -> bool:
        """Navigate to a Twitter profile page.

        Args:
            profile: Username without @

        Returns:
            True if page loaded successfully
        """
        try:
            url = f"https://twitter.com/{profile}"
            logger.info(f"Navigating to {url}")

            self.driver.get(url)
            self._human_pause(2, 3)

            # Check if we need to handle login gate
            self._dismiss_login_gate()

            # Wait for tweets to load
            try:
                self.wait.until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, 'article[data-testid="tweet"]'))
                )
                logger.info(f"Tweets loaded for @{profile}")
                return True

            except TimeoutException:
                # Fallback: check for any article element
                try:
                    self.wait.until(
                        EC.presence_of_element_located((By.TAG_NAME, 'article'))
                    )
                    logger.info(f"Articles loaded for @{profile}")
                    return True
                except TimeoutException:
                    logger.warning(f"No tweets found for @{profile}")
                    return False

        except Exception as e:
            logger.error(f"Error navigating to @{profile}: {e}")
            return False

    def _dismiss_login_gate(self):
        """Try to dismiss login popup if present."""
        try:
            # Look for dismiss buttons
            dismiss_selectors = [
                '[data-testid="app-bar-close"]',
                '[aria-label="Close"]',
                'div[role="button"][tabindex="0"]',
            ]

            for selector in dismiss_selectors:
                try:
                    buttons = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    for button in buttons:
                        if button.is_displayed():
                            button.click()
                            logger.debug(f"Dismissed login gate with {selector}")
                            self._human_pause(0.3, 0.5)
                            return
                except Exception:
                    continue

        except Exception as e:
            logger.debug(f"No login gate to dismiss: {e}")

    def _extract_tweets_from_dom(self, profile: str) -> List[Dict]:
        """Extract tweet data from DOM using JavaScript.

        Args:
            profile: Profile username

        Returns:
            List of tweet dictionaries
        """
        try:
            time.sleep(0.5)

            # Test JavaScript execution
            try:
                test_result = self.driver.execute_script("return 'test';")
                if test_result != 'test':
                    logger.warning(f"JavaScript execution test failed for @{profile}")
                    return []
            except Exception as e:
                logger.warning(f"JavaScript execution not working: {e}")
                return []

            # Execute main extraction script
            script = build_extraction_script(profile)
            result = self.driver.execute_script(script)

            # Try fallback if main returns None
            if result is None:
                logger.warning(f"Main script returned None, trying fallback...")
                try:
                    fallback_script = build_fallback_extraction_script(profile)
                    result = self.driver.execute_script(fallback_script)
                    if result and isinstance(result, list):
                        logger.info(f"Fallback extraction successful: {len(result)} tweets")
                except Exception as e:
                    logger.error(f"Fallback extraction failed: {e}")

            if result is None:
                result = []

            if not isinstance(result, list):
                logger.warning(f"Unexpected result type: {type(result)}")
                return []

            return result

        except Exception as e:
            logger.error(f"DOM extraction error: {e}")
            return []

    def scrape_profile(self, profile: str) -> List[Dict]:
        """Scrape tweets from a profile.

        Args:
            profile: Username without @

        Returns:
            List of tweet dictionaries
        """
        if not self.driver:
            if not self._init_driver():
                return []

        try:
            logger.info(f"Scraping tweets from @{profile}")

            if not self._goto_profile_url(profile):
                logger.error(f"Failed to load profile timeline for @{profile}")
                return []

            # Initial warmup scrolls
            for _ in range(2):
                scroll_amount = random.randint(400, 800)
                self.driver.execute_script(f"window.scrollBy(0, {scroll_amount});")
                self._human_pause(0.8, 1.2)
                self._dismiss_login_gate()

            collected: List[Dict] = []
            seen_ids = set()
            no_new_tweets_count = 0

            while len(collected) < self.TARGET_TWEETS and no_new_tweets_count < 3:
                # Extract tweets from DOM
                raw_tweets = self._extract_tweets_from_dom(profile)
                new_count = 0

                for tweet in raw_tweets:
                    tweet_id = tweet.get('id')
                    if tweet_id and tweet_id not in seen_ids:
                        # Download video blobs to local files
                        tweet = self.video_downloader.process_tweet_videos(self.driver, tweet)

                        seen_ids.add(tweet_id)
                        collected.append(tweet)
                        new_count += 1
                        logger.debug(f"Added tweet {tweet_id}")

                if new_count == 0:
                    no_new_tweets_count += 1
                else:
                    no_new_tweets_count = 0
                    logger.info(f"Found {new_count} new tweets, total: {len(collected)}")

                if len(collected) >= self.TARGET_TWEETS:
                    break

                # Scroll for more tweets
                scroll_amount = random.randint(800, 1400)
                self.driver.execute_script(f"window.scrollBy(0, {scroll_amount});")
                self._human_pause(1.2, 1.8)
                self._dismiss_login_gate()

            result = collected[:self.TARGET_TWEETS]
            logger.info(f"Successfully scraped {len(result)} tweets from @{profile}")

            return result

        except Exception as e:
            logger.error(f"Error scraping @{profile}: {e}")
            return []

    def save_tweets(self, tweets: List[Dict], filename: str = "tweets.json"):
        """Save tweets to JSON file.

        Args:
            tweets: List of tweet dictionaries
            filename: Output filename
        """
        if not tweets:
            logger.warning("No tweets to save")
            return

        output_file = self.data_dir / filename

        try:
            # Load existing tweets
            existing_tweets = []
            if output_file.exists():
                with open(output_file, 'r', encoding='utf-8') as f:
                    existing_tweets = json.load(f)

            # Get existing IDs
            existing_ids = {t.get('id') for t in existing_tweets}

            # Add new tweets
            new_count = 0
            for tweet in tweets:
                if tweet.get('id') not in existing_ids:
                    existing_tweets.append(tweet)
                    new_count += 1

            # Save merged list
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(existing_tweets, f, ensure_ascii=False, indent=2)

            logger.info(f"Saved {new_count} new tweets to {output_file}")
            logger.info(f"Total tweets in file: {len(existing_tweets)}")

        except Exception as e:
            logger.error(f"Error saving tweets: {e}")

    def run(self, profile: str = "buzzhaber"):
        """Run the scraper for a profile.

        Args:
            profile: Username to scrape (default: buzzhaber)
        """
        try:
            tweets = self.scrape_profile(profile)

            if tweets:
                self.save_tweets(tweets)

                # Log summary
                video_count = sum(1 for t in tweets if t.get('video', False))
                logger.info(f"""
╔════════════════════════════════════════╗
║   60Saniye Scraper Results             ║
╠════════════════════════════════════════╣
║  Total tweets:  {len(tweets):<20} ║
║  Video tweets:  {video_count:<20} ║
║  Profile:       @{profile:<18} ║
╚════════════════════════════════════════╝
                """)
            else:
                logger.warning("No tweets scraped")

        finally:
            self._close_driver()


def main():
    """Main entry point."""
    import sys

    profile = sys.argv[1] if len(sys.argv) > 1 else "buzzhaber"

    scraper = TwitterScraper(headless=False)
    scraper.run(profile)


if __name__ == "__main__":
    main()
