"""
Video Downloader Module for 60Saniye
Downloads video blobs from Twitter and saves them locally.
"""

import base64
import logging
import time
from pathlib import Path
from typing import Optional, Dict

logger = logging.getLogger(__name__)


class VideoDownloader:
    """Downloads and stores Twitter videos locally."""

    def __init__(self, videos_dir: Path):
        """Initialize video downloader.

        Args:
            videos_dir: Directory to store downloaded videos
        """
        self.videos_dir = Path(videos_dir)
        self.videos_dir.mkdir(parents=True, exist_ok=True)

    def download_video_from_blob(self, driver, blob_url: str, tweet_id: str) -> Optional[str]:
        """Download a video from a blob URL.

        Args:
            driver: Selenium WebDriver instance
            blob_url: The blob URL (e.g., blob:https://x.com/...)
            tweet_id: Tweet ID for filename

        Returns:
            Relative path to downloaded video, or None if failed
        """
        try:
            # JavaScript to fetch blob and convert to base64
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

            # Execute JavaScript to get base64 data
            base64_data = driver.execute_script(js_code)

            if not base64_data:
                logger.warning(f"Failed to fetch blob for tweet {tweet_id}")
                return None

            # Decode base64 and save to file
            video_data = base64.b64decode(base64_data)
            filename = f"{tweet_id}.mp4"
            video_path = self.videos_dir / filename

            with open(video_path, 'wb') as f:
                f.write(video_data)

            logger.info(f"Downloaded video for tweet {tweet_id}: {filename}")
            return f"/videos/{filename}"

        except Exception as e:
            logger.error(f"Error downloading video for tweet {tweet_id}: {e}")
            return None

    def process_tweet_videos(self, driver, tweet: Dict) -> Dict:
        """Process and download videos for a tweet.

        Args:
            driver: Selenium WebDriver instance
            tweet: Tweet dictionary with media array

        Returns:
            Updated tweet dictionary with local video paths
        """
        if not tweet.get('video', False):
            return tweet

        media = tweet.get('media', [])
        updated_media = []

        for item in media:
            if item.get('type') == 'video':
                blob_url = item.get('url', '')
                tweet_id = tweet.get('id', f'vid_{int(time.time())}')

                # Skip if already a local URL
                if blob_url.startswith('/videos/') or blob_url.startswith('http'):
                    updated_media.append(item)
                    continue

                # Try to download the blob video
                local_path = self.download_video_from_blob(driver, blob_url, tweet_id)
                if local_path:
                    updated_media.append({
                        'type': 'video',
                        'url': local_path
                    })
                else:
                    # Keep original if download failed
                    updated_media.append(item)
            else:
                updated_media.append(item)

        tweet['media'] = updated_media
        return tweet


def repr(s: str) -> str:
    """Simple string representation for JavaScript."""
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'
