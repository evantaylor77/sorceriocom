// 60Saniye API - Scrape tweets from @buzzhaber profile
// Vercel serverless function

import fs from 'fs';
import path from 'path';

const LOCAL_TWEETS_PATH = path.join(process.cwd(), 'data/tweets.json');
const TARGET_PROFILE = 'buzzhaber';

export default async function handler(req, res) {
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
        const { limit = 20, tweetUrl } = req.query;

        if (tweetUrl) {
            return await handleVideoProxy(tweetUrl, res);
        }

        let tweets = await loadTweetsFromLocal();
        tweets = tweets.filter(t => t.profile === TARGET_PROFILE);
        tweets.sort((a, b) => new Date(b.time) - new Date(a.time));
        tweets = tweets.slice(0, parseInt(limit));

        const formattedTweets = tweets.map(tweet => {
            const videoMedia = tweet.media?.find(m => m.type === 'video' && m.url?.startsWith('/videos/'));
            
            return {
                id: tweet.id,
                text: tweet.text,
                author: '60Saniye Haber',
                username: `@${TARGET_PROFILE}`,
                time: formatTime(tweet.time),
                media: tweet.media || [],
                hasVideo: !!videoMedia,
                hasImage: tweet.image || false,
                videoUrl: videoMedia?.url || null,
                likes: tweet.engagement?.likes || 0,
                retweets: tweet.engagement?.retweets || 0,
                profile: tweet.profile
            };
        });

        return res.json({
            tweets: formattedTweets,
            total: formattedTweets.length
        });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            error: error.message,
            tweets: []
        });
    }
}

async function handleVideoProxy(tweetUrl, res) {
    try {
        const tweetIdMatch = tweetUrl.match(/status\/(\d+)/);
        if (!tweetIdMatch) {
            return res.status(400).json({ error: 'Invalid tweet URL' });
        }

        const tweetId = tweetIdMatch[1];

        // Check if we have local video for this tweet
        const videosDir = path.join(process.cwd(), 'data/videos');
        const possibleExtensions = ['.mp4', '.webm'];
        
        for (const ext of possibleExtensions) {
            const videoPath = path.join(videosDir, `${tweetId}${ext}`);
            if (fs.existsSync(videoPath)) {
                return res.json({
                    tweetId: tweetId,
                    videoUrl: `/videos/${tweetId}${ext}`,
                    contentType: ext === '.mp4' ? 'video/mp4' : 'video/webm',
                    local: true
                });
            }
        }

        // Try to fetch from Twitter page
        const tweetPageResponse = await fetch(tweetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            }
        });

        if (!tweetPageResponse.ok) {
            throw new Error(`Failed to fetch tweet: ${tweetPageResponse.status}`);
        }

        const html = await tweetPageResponse.text();
        let videoUrl = null;

        const m3u8Match = html.match(/https:\/\/video\.twimg\.com\/[^"'\s]+\.m3u8[^"'\s]*/g);
        if (m3u8Match && m3u8Match.length > 0) {
            videoUrl = m3u8Match[0];
        }

        if (!videoUrl) {
            const mp4Match = html.match(/https:\/\/video\.twimg\.com\/[^"'\s]+\.mp4[^"'\s]*/g);
            if (mp4Match && mp4Match.length > 0) {
                videoUrl = mp4Match[0];
            }
        }

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
                fallbackUrl: tweetUrl
            });
        }

        return res.json({
            tweetId: tweetId,
            videoUrl: videoUrl,
            contentType: videoUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4',
            local: false
        });

    } catch (error) {
        console.error('Video proxy error:', error);
        return res.status(500).json({
            error: error.message,
            fallbackUrl: tweetUrl
        });
    }
}

async function loadTweetsFromLocal() {
    try {
        const tweetsData = fs.readFileSync(LOCAL_TWEETS_PATH, 'utf8');
        return JSON.parse(tweetsData);
    } catch (error) {
        console.log('Local tweets not found');
        return [];
    }
}

function formatTime(isoTime) {
    const date = new Date(isoTime);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Az önce';
    if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}
