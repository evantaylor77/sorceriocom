import fs from 'fs';
import path from 'path';

const LOCAL_TWEETS_PATH = path.join(process.cwd(), 'data/tweets.json');
const TARGET_PROFILE = 'buzzhaber';

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
        const { limit = 20, tweetUrl, tweetId } = req.query;

        if (tweetUrl || tweetId) {
            const url = tweetUrl || `https://x.com/${TARGET_PROFILE}/status/${tweetId}`;
            return await handleVideoProxy(url, res);
        }

        let tweets = await loadTweetsFromLocal();
        tweets = tweets.filter(t => t.profile === TARGET_PROFILE);
        tweets.sort((a, b) => new Date(b.time) - new Date(a.time));
        tweets = tweets.slice(0, parseInt(limit));

        const formattedTweets = await Promise.all(tweets.map(async (tweet) => {
            const videoMedia = tweet.media?.find(m => m.type === 'video');
            const tweetUrlMedia = tweet.media?.find(m => m.type === 'tweet_url');
            
            let videoUrl = null;
            
            if (videoMedia?.url?.startsWith('/videos/')) {
                videoUrl = videoMedia.url;
            } else if (videoMedia?.url?.startsWith('http')) {
                videoUrl = videoMedia.url;
            } else if (tweetUrlMedia?.url || tweet.id) {
                const url = tweetUrlMedia?.url || `https://x.com/${TARGET_PROFILE}/status/${tweet.id}`;
                videoUrl = await fetchVideoUrl(url, tweet.id);
            }

            return {
                id: tweet.id,
                text: tweet.text,
                author: '60Saniye Haber',
                username: `@${TARGET_PROFILE}`,
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
        const response = await fetch(tweetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        });

        if (!response.ok) {
            return null;
        }

        const html = await response.text();
        let videoUrl = null;

        const mp4Matches = html.match(/https:\/\/video\.twimg\.com\/[^"'\s<>]+\.mp4[^"'\s<>]*/g);
        if (mp4Matches && mp4Matches.length > 0) {
            videoUrl = mp4Matches[0];
            if (videoUrl.includes('?')) {
                videoUrl = videoUrl.split('?')[0];
            }
        }

        if (!videoUrl) {
            const twimgMatches = html.match(/https:\/\/video\.twimg\.com\/[^"'\s<>]+/g);
            if (twimgMatches && twimgMatches.length > 0) {
                for (const match of twimgMatches) {
                    if (match.includes('.mp4') || match.includes('vid')) {
                        videoUrl = match.split(/["'<>\s]/)[0];
                        if (videoUrl.includes('?')) {
                            videoUrl = videoUrl.split('?')[0];
                        }
                        break;
                    }
                }
            }
        }

        if (!videoUrl) {
            const videoUrlMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/);
            if (videoUrlMatch) {
                videoUrl = videoUrlMatch[1].replace(/\\\//g, '/');
            }
        }

        if (!videoUrl) {
            const variantsMatch = html.match(/"variants"\s*:\s*\[([^\]]+)\]/);
            if (variantsMatch) {
                const urlMatch = variantsMatch[1].match(/"url"\s*:\s*"([^"]+)"/g);
                if (urlMatch) {
                    for (const um of urlMatch) {
                        const url = um.match(/"url"\s*:\s*"([^"]+)"/)?.[1]?.replace(/\\\//g, '/');
                        if (url && url.includes('.mp4')) {
                            videoUrl = url;
                            break;
                        }
                    }
                }
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
