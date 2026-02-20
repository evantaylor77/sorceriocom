"""
Video Downloader Module for 60Saniye
Downloads video blobs from Twitter and saves them locally.
Enhanced with direct URL download support.
"""

import base64
import logging
import time
import requests
from pathlib import Path
from typing import Optional, Dict, List
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class VideoDownloader:
    """Downloads and stores Twitter videos locally."""

    CHUNK_SIZE = 8192
    MAX_RETRIES = 3
    REQUEST_TIMEOUT = 60

    def __init__(self, videos_dir: Path):
        """Initialize video downloader.

        Args:
            videos_dir: Directory to store downloaded videos
        """
        self.videos_dir = Path(videos_dir)
        self.videos_dir.mkdir(parents=True, exist_ok=True)
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.5",
            }
        )

    def download_video_from_blob(
        self, driver, blob_url: str, tweet_id: str
    ) -> Optional[str]:
        """Download a video from a blob URL.

        Args:
            driver: Selenium WebDriver instance
            blob_url: The blob URL (e.g., blob:https://x.com/...)
            tweet_id: Tweet ID for filename

        Returns:
            Relative path to downloaded video, or None if failed
        """
        try:
            js_code = f"""
            async function fetchBlob() {{
                try {{
                    const response = await fetch({repr(blob_url)});
                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
                    return base64;
                }} catch(e) {{
                    return null;
                }}
            }}
            return await fetchBlob();
            """

            base64_data = driver.execute_script(js_code)

            if not base64_data:
                logger.warning(f"Failed to fetch blob for tweet {tweet_id}")
                return None

            video_data = base64.b64decode(base64_data)
            filename = f"{tweet_id}.mp4"
            video_path = self.videos_dir / filename

            with open(video_path, "wb") as f:
                f.write(video_data)

            logger.info(f"Downloaded blob video for tweet {tweet_id}: {filename}")
            return f"/videos/{filename}"

        except Exception as e:
            logger.error(f"Error downloading blob video for tweet {tweet_id}: {e}")
            return None

    def download_video_from_url(self, video_url: str, tweet_id: str) -> Optional[str]:
        """Download a video from a direct HTTP URL.

        Args:
            video_url: Direct video URL
            tweet_id: Tweet ID for filename

        Returns:
            Relative path to downloaded video, or None if failed
        """
        for attempt in range(self.MAX_RETRIES):
            try:
                logger.info(
                    f"Downloading video from URL (attempt {attempt + 1}): {video_url[:80]}..."
                )

                response = self.session.get(
                    video_url,
                    stream=True,
                    timeout=self.REQUEST_TIMEOUT,
                    allow_redirects=True,
                )
                response.raise_for_status()

                # Determine file extension from content-type or URL
                content_type = response.headers.get("content-type", "")
                if "mp4" in content_type or ".mp4" in video_url:
                    ext = ".mp4"
                elif "webm" in content_type or ".webm" in video_url:
                    ext = ".webm"
                else:
                    ext = ".mp4"

                filename = f"{tweet_id}{ext}"
                video_path = self.videos_dir / filename

                total_size = int(response.headers.get("content-length", 0))
                downloaded = 0

                with open(video_path, "wb") as f:
                    for chunk in response.iter_content(chunk_size=self.CHUNK_SIZE):
                        if chunk:
                            f.write(chunk)
                            downloaded += len(chunk)

                logger.info(
                    f"Downloaded video for tweet {tweet_id}: {filename} ({downloaded} bytes)"
                )
                return f"/videos/{filename}"

            except requests.exceptions.RequestException as e:
                logger.warning(
                    f"Download attempt {attempt + 1} failed for tweet {tweet_id}: {e}"
                )
                if attempt < self.MAX_RETRIES - 1:
                    time.sleep(2**attempt)
                continue
            except Exception as e:
                logger.error(f"Error downloading video for tweet {tweet_id}: {e}")
                return None

        return None

    def try_tweet_video_api(self, tweet_url: str, tweet_id: str) -> Optional[str]:
        """Try to get video URL from tweet page and download.

        Args:
            tweet_url: Full tweet URL
            tweet_id: Tweet ID for filename

        Returns:
            Relative path to downloaded video, or None if failed
        """
        try:
            response = self.session.get(tweet_url, timeout=self.REQUEST_TIMEOUT)
            response.raise_for_status()

            html = response.text
            video_url = None

            # Method 1: Look for m3u8 playlist URL
            import re

            m3u8_match = re.search(
                r'https://video\.twimg\.com/[^"\']+\.m3u8[^"\']*', html
            )
            if m3u8_match:
                video_url = m3u8_match.group(0)

            # Method 2: Look for mp4 URL
            if not video_url:
                mp4_match = re.search(
                    r'https://video\.twimg\.com/[^"\']+\.mp4[^"\']*', html
                )
                if mp4_match:
                    video_url = mp4_match.group(0)

            # Method 3: Look for video_url in JSON
            if not video_url:
                video_url_match = re.search(r'"video_url":"([^"]+)"', html)
                if video_url_match:
                    video_url = video_url_match.group(1).replace("\\/", "/")

            if video_url:
                logger.info(
                    f"Found video URL for tweet {tweet_id}: {video_url[:60]}..."
                )
                return self.download_video_from_url(video_url, tweet_id)

            return None

        except Exception as e:
            logger.error(f"Error fetching tweet page for {tweet_id}: {e}")
            return None

    def process_tweet_videos(self, driver, tweet: Dict) -> Dict:
        """Process and download videos for a tweet.

        Args:
            driver: Selenium WebDriver instance
            tweet: Tweet dictionary with media array

        Returns:
            Updated tweet dictionary with local video paths
        """
        if not tweet.get("video", False):
            return tweet

        media = tweet.get("media", [])
        updated_media = []
        tweet_id = tweet.get("id", f"vid_{int(time.time())}")
        video_downloaded = False

        for item in media:
            item_type = item.get("type", "")

            # Skip if already have local video
            if video_downloaded and item_type in ("video", "video_blob", "tweet_url"):
                continue

            if item_type == "video_blob":
                # Download from blob URL
                blob_url = item.get("url", "")
                local_path = self.download_video_from_blob(driver, blob_url, tweet_id)
                if local_path:
                    updated_media.append({"type": "video", "url": local_path})
                    video_downloaded = True
                else:
                    updated_media.append(item)

            elif item_type == "video":
                video_url = item.get("url", "")

                # Already local path
                if video_url.startswith("/videos/"):
                    updated_media.append(item)
                    video_downloaded = True
                    continue

                # Download from HTTP URL
                if video_url.startswith("http"):
                    local_path = self.download_video_from_url(video_url, tweet_id)
                    if local_path:
                        updated_media.append({"type": "video", "url": local_path})
                        video_downloaded = True
                    else:
                        updated_media.append(item)

            elif item_type == "tweet_url":
                # Fallback: Try to get video from tweet page
                if not video_downloaded:
                    tweet_url = item.get("url", "")
                    local_path = self.try_tweet_video_api(tweet_url, tweet_id)
                    if local_path:
                        updated_media.append({"type": "video", "url": local_path})
                        video_downloaded = True
                    else:
                        # Keep tweet URL as fallback for frontend
                        updated_media.append(item)
                else:
                    # Video already downloaded, still keep tweet_url
                    updated_media.append(item)

            elif item_type == "image":
                updated_media.append(item)

        tweet["media"] = updated_media
        return tweet


def repr(s: str) -> str:
    """Simple string representation for JavaScript."""
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'
