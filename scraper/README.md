# 60Saniye Twitter Scraper

Scrapes video tweets from @buzzhaber for the 60Saniye news platform.

## Installation

```bash
cd scraper
pip install -r requirements.txt
```

## Usage

### Basic Usage

```bash
python twitter_scraper.py
```

This will scrape @buzzhaber and save tweets to `../data/tweets.json`.

### Custom Profile

```bash
python twitter_scraper.py different_username
```

## Output

The scraper generates `data/tweets.json` with the following structure:

```json
[
  {
    "id": "1234567890",
    "text": "Tweet text here",
    "time": "2026-02-20T10:30:00.000Z",
    "media": [
      {
        "type": "video",
        "url": "https://video.twimg.com/..."
      }
    ],
    "video": true,
    "image": false,
    "engagement": {},
    "profile": "buzzhaber"
  }
]
```

## Features

- **Direct Video URLs**: Extracts `.mp4` URLs directly from Twitter DOM
- **Incremental Updates**: Only adds new tweets, preserves existing data
- **Rate Limiting**: Human-like delays between actions
- **Login Gate Handling**: Automatically dismisses login popups

## Troubleshooting

### Chrome Driver Issues
If you encounter Chrome driver issues, try:
```bash
pip install --upgrade undetected-chromedriver
```

### No Videos Found
The scraper detects videos but may not always get direct URLs if Twitter changes their DOM structure.

### Empty Output
- Check if @buzzhaber has recent tweets with videos
- Try running with `headless=False` to see what's happening
