import fs from 'fs';
import path from 'path';

const videosDir = path.join(process.cwd(), 'data/videos');
const videoCache = new Map();

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;

    if (!id || !id.match(/^\d+$/)) {
        return res.status(400).json({ error: 'Invalid tweet ID' });
    }

    const ext = path.extname(id);
    const tweetId = ext ? id.replace(ext, '') : id;

    // 1. Local file
    const localPath = path.join(videosDir, `${tweetId}.mp4`);
    if (fs.existsSync(localPath)) {
        return serveLocalVideo(localPath, req, res);
    }

    // 2. In-memory cache
    const cachedUrl = videoCache.get(tweetId);
    if (cachedUrl) {
        return proxyVideo(cachedUrl, res, req);
    }

    // 3. Pre-resolved URL from tweets.json (most reliable, no API call needed)
    try {
        const tweetsPath = path.join(process.cwd(), 'data/tweets.json');
        if (fs.existsSync(tweetsPath)) {
            const tweets = JSON.parse(fs.readFileSync(tweetsPath, 'utf8'));
            const tweet = tweets.find(t => t.id === tweetId);
            if (tweet) {
                const storedUrl = tweet.video_url;
                if (storedUrl && storedUrl.startsWith('http')) {
                    videoCache.set(tweetId, storedUrl);
                    return proxyVideo(storedUrl, res, req);
                }
            }
        }
    } catch (e) {
        console.error('Tweets lookup error:', e.message);
    }

    // 4. Syndication API fallback (may be rate-limited)
    try {
        const videoUrl = await fetchTwitterVideoUrl(tweetId);
        if (videoUrl) {
            videoCache.set(tweetId, videoUrl);
            if (videoCache.size > 200) {
                const firstKey = videoCache.keys().next().value;
                videoCache.delete(firstKey);
            }
            return proxyVideo(videoUrl, res, req);
        }
    } catch (error) {
        console.error('Video fetch error:', error.message);
    }

    return res.status(404).json({
        error: 'Video not found',
        fallbackUrl: `https://x.com/i/status/${tweetId}`
    });
}

function serveLocalVideo(localPath, req, res) {
    const stat = fs.statSync(localPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');

    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Content-Length', chunkSize);
        res.status(206);

        const stream = fs.createReadStream(localPath, { start, end });
        return stream.pipe(res);
    }

    res.setHeader('Content-Length', fileSize);
    res.status(200);
    return fs.createReadStream(localPath).pipe(res);
}

async function fetchTwitterVideoUrl(tweetId) {
    try {
        const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=0`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VideoFetcher/1.0)' }
        });
        if (!response.ok) return null;
        const data = await response.json();

        // Check mediaDetails array (common structure)
        if (data.mediaDetails) {
            for (const md of data.mediaDetails) {
                const variants = md.video_info?.variants;
                if (variants) {
                    const mp4s = variants
                        .filter(v => v.content_type === 'video/mp4')
                        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
                    if (mp4s.length > 0) return mp4s[0].url;
                }
            }
        }

        // Regex fallback on full JSON
        const jsonStr = JSON.stringify(data);
        const mp4Matches = jsonStr.match(/https:\/\/video\.twimg\.com\/[^"]+\.mp4[^"]*/g);
        if (mp4Matches && mp4Matches.length > 0) {
            return mp4Matches.find(u => u.includes('720x') || u.includes('1080x')) || mp4Matches[0];
        }

        return null;
    } catch (error) {
        console.error('Syndication API error:', error.message);
        return null;
    }
}

async function proxyVideo(videoUrl, res, req) {
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': '*/*',
            'Referer': 'https://x.com/',
            'Origin': 'https://x.com',
        };

        if (req.headers.range) {
            headers['Range'] = req.headers.range;
        }

        const response = await fetch(videoUrl, { headers });

        if (!response.ok) {
            return res.status(response.status).json({
                error: 'Failed to fetch video',
                directUrl: videoUrl
            });
        }

        const contentType = response.headers.get('content-type') || 'video/mp4';
        const contentLength = response.headers.get('content-length');
        const contentRange = response.headers.get('content-range');

        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Accept-Ranges', 'bytes');

        if (contentLength) res.setHeader('Content-Length', contentLength);
        if (contentRange) {
            res.setHeader('Content-Range', contentRange);
            res.status(206);
        } else {
            res.status(200);
        }

        const reader = response.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
        }
        return res.end();
    } catch (error) {
        console.error('Proxy error:', error.message, videoUrl);
        return res.status(500).json({
            error: 'Proxy error',
            directUrl: videoUrl
        });
    }
}
