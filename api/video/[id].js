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

    const localPath = path.join(videosDir, `${tweetId}.mp4`);
    if (fs.existsSync(localPath)) {
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

    const cachedUrl = videoCache.get(tweetId);
    if (cachedUrl) {
        return proxyVideo(cachedUrl, res);
    }

    try {
        const videoUrl = await fetchTwitterVideoUrl(tweetId);
        if (videoUrl) {
            videoCache.set(tweetId, videoUrl);
            return proxyVideo(videoUrl, res);
        }
    } catch (error) {
        console.error('Video fetch error:', error.message);
    }

    return res.status(404).json({ 
        error: 'Video not found',
        fallbackUrl: `https://x.com/BuzzHaber/status/${tweetId}`
    });
}

async function fetchTwitterVideoUrl(tweetId) {
    const tweetUrl = `https://x.com/BuzzHaber/status/${tweetId}`;

    const response = await fetch(tweetUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
    });

    if (!response.ok) return null;

    const html = await response.text();

    const patterns = [
        /https:\/\/video\.twimg\.com\/[^"'\s<>]+\.mp4[^"'\s<>]*/g,
        /https:\/\/video\.twimg\.com\/[^"'\s<>]+/g,
    ];

    for (const pattern of patterns) {
        const matches = html.match(pattern);
        if (matches && matches.length > 0) {
            let url = matches[0].split(/["'<>\s]/)[0];
            if (url.includes('?')) {
                url = url.split('?')[0];
            }
            if (url.includes('.mp4')) {
                return url;
            }
        }
    }

    const variantsMatch = html.match(/"variants"\s*:\s*\[([^\]]+)\]/);
    if (variantsMatch) {
        const urlMatches = variantsMatch[1].match(/"url"\s*:\s*"([^"]+)"/g);
        if (urlMatches) {
            for (const um of urlMatches) {
                const url = um.match(/"url"\s*:\s*"([^"]+)"/)?.[1]?.replace(/\\\//g, '/');
                if (url && url.includes('.mp4')) {
                    return url;
                }
            }
        }
    }

    return null;
}

async function proxyVideo(videoUrl, res) {
    try {
        const response = await fetch(videoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to fetch video' });
        }

        const contentType = response.headers.get('content-type') || 'video/mp4';
        const contentLength = response.headers.get('content-length');

        res.setHeader('Content-Type', contentType);
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }

        res.status(200);
        return response.body.pipe(res);
    } catch (error) {
        return res.status(500).json({ error: 'Proxy error' });
    }
}
