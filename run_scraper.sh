#!/bin/bash
# 60Saniye Scraper - Run Script

echo "========================================"
echo "  60Saniye Twitter Scraper"
echo "  Scraping @buzzhaber..."
echo "========================================"
echo ""

cd scraper
python twitter_scraper.py buzzhaber

echo ""
echo "========================================"
echo "  Scraping complete!"
echo "  Data saved to: data/tweets.json"
echo "========================================"
