// 60Saniye Video Proxy API
// Proxy Twitter videos for autoplay functionality

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { tweetUrl } = req.query;

        if (!tweetUrl) {
            return res.status(400).json({ error: 'tweetUrl parameter required' });
        }

        // Extract tweet ID from URL
        const tweetIdMatch = tweetUrl.match(/status\/(\d+)/);
        if (!tweetIdMatch) {
            return res.status(400).json({ error: 'Invalid tweet URL' });
        }

        const tweetId = tweetIdMatch[1];

        // Fetch the tweet page to extract video URL
        const tweetPageResponse = await fetch(tweetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        });

        if (!tweetPageResponse.ok) {
            throw new Error(`Failed to fetch tweet: ${tweetPageResponse.status}`);
        }

        const html = await tweetPageResponse.text();

        // Extract video URL from HTML
        // Twitter stores video URLs in various formats:
        // 1. In data attributes
        // 2. In JavaScript variables
        // 3. In meta tags

        let videoUrl = null;

        // Method 1: Look for m3u8 playlist URL in HTML
        const m3u8Match = html.match(/https:\/\/video\.twimg\.com\/[^"'\s]+\.m3u8[^"'\s]*/g);
        if (m3u8Match && m3u8Match.length > 0) {
            videoUrl = m3u8Match[0];
        }

        // Method 2: Look for mp4 URL
        if (!videoUrl) {
            const mp4Match = html.match(/https:\/\/video\.twimg\.com\/[^"'\s]+\.mp4[^"'\s]*/g);
            if (mp4Match && mp4Match.length > 0) {
                videoUrl = mp4Match[0];
            }
        }

        // Method 3: Look in tweet data (JSON in script tags)
        if (!videoUrl) {
            const dataMatch = html.match(/"video_url":"([^"]+)"/);
            if (dataMatch) {
                videoUrl = dataMatch[1].replace(/\\\//g, '/');
            }
        }

        if (!videoUrl) {
            return res.status(404).json({
                error: 'Video URL not found',
                tweetId: tweetId,
                // Return tweet URL as fallback for embed
                fallbackUrl: tweetUrl
            });
        }

        // Return the video URL
        return res.json({
            tweetId: tweetId,
            videoUrl: videoUrl,
            contentType: videoUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4'
        });

    } catch (error) {
        console.error('Video proxy error:', error);
        return res.status(500).json({
            error: error.message,
            fallbackUrl: req.query.tweetUrl
        });
    }
}
// Updated: 20 Şub 2026 Cum 21:30:46
