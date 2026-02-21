import fs from 'fs';
import path from 'path';

const LOCAL_TWEETS_PATH = path.join(process.cwd(), 'data/tweets.json');
const MAX_LIMIT = 500;

const videoCache = new Map();

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
        const { limit = 20, tweetUrl, tweetId, profile } = req.query;

        if (tweetUrl || tweetId) {
            const url = tweetUrl || `https://x.com/i/status/${tweetId}`;
            return await handleVideoProxy(url, res);
        }

        let tweets = await loadTweetsFromLocal();
        if (profile) {
            tweets = tweets.filter(t => (t.profile || '').toLowerCase() === String(profile).toLowerCase());
        }
        tweets.sort((a, b) => new Date(b.time) - new Date(a.time));
        const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), MAX_LIMIT);
        tweets = tweets.slice(0, safeLimit);

        const formattedTweets = await Promise.all(tweets.map(async (tweet) => {
            const videoMedia = tweet.media?.find(m => m.type === 'video');
            const tweetUrlMedia = tweet.media?.find(m => m.type === 'tweet_url');
            
            let videoUrl = null;

            if (tweet.video_url) {
                videoUrl = tweet.video_url;
            } else if (videoMedia?.url?.startsWith('/videos/')) {
                videoUrl = videoMedia.url;
            } else if (videoMedia?.url?.startsWith('http')) {
                videoUrl = videoMedia.url;
            } else if (tweetUrlMedia?.url || tweet.id) {
                const url = tweetUrlMedia?.url || `https://x.com/i/status/${tweet.id}`;
                videoUrl = await fetchVideoUrl(url, tweet.id);
            }

            const tweetProfile = tweet.profile || 'buzzhaber';
            return {
                id: tweet.id,
                text: tweet.text,
                author: '60Saniye Haber',
                username: `@${tweetProfile}`,
                time: formatTime(tweet.time),
                media: tweet.media || [],
                hasVideo: tweet.video || !!videoUrl,
                hasImage: tweet.image || false,
                videoUrl: videoUrl,
                likes: tweet.engagement?.likes || 0,
                retweets: tweet.engagement?.retweets || 0,
                profile: tweet.profile
            };
        }));

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

async function fetchVideoUrl(tweetUrl, tweetId) {
    if (videoCache.has(tweetId)) {
        return videoCache.get(tweetId);
    }

    try {
        const syndicationUrl = `https://syndication.twitter.com/tweet-result?id=${tweetId}&token=0`;
        
        const response = await fetch(syndicationUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; VideoFetcher/1.0)',
            }
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        let videoUrl = null;
        
        if (data.video_info?.variants) {
            const mp4Variants = data.video_info.variants.filter(v => 
                v.content_type === 'video/mp4' || v.url?.includes('.mp4')
            );
            
            if (mp4Variants.length > 0) {
                mp4Variants.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
                videoUrl = mp4Variants[0].url;
            }
        }

        if (!videoUrl) {
            const jsonStr = JSON.stringify(data);
            const mp4Matches = jsonStr.match(/https:\/\/video\.twimg\.com\/[^"]+\.mp4[^"]*/g);
            
            if (mp4Matches && mp4Matches.length > 0) {
                const highResUrl = mp4Matches.find(url => url.includes('720x') || url.includes('1080x'));
                videoUrl = highResUrl || mp4Matches[0];
            }
        }

        if (videoUrl) {
            videoCache.set(tweetId, videoUrl);
            if (videoCache.size > 100) {
                const firstKey = videoCache.keys().next().value;
                videoCache.delete(firstKey);
            }
        }

        return videoUrl;

    } catch (error) {
        console.error(`Error fetching video URL for ${tweetId}:`, error.message);
        return null;
    }
}

async function handleVideoProxy(tweetUrl, res) {
    try {
        const tweetIdMatch = tweetUrl.match(/status\/(\d+)/);
        if (!tweetIdMatch) {
            return res.status(400).json({ error: 'Invalid tweet URL' });
        }

        const tweetId = tweetIdMatch[1];

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

        const videoUrl = await fetchVideoUrl(tweetUrl, tweetId);

        if (videoUrl) {
            return res.json({
                tweetId: tweetId,
                videoUrl: videoUrl,
                contentType: videoUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4',
                local: false
            });
        }

        return res.status(404).json({
            error: 'Video URL not found',
            tweetId: tweetId,
            fallbackUrl: tweetUrl
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
