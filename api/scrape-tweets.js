// 60Saniye API - Scrape tweets from @BuzzFinal profile
// Vercel serverless function

import fs from 'fs';
import path from 'path';

// BuzzFinal tweets path (if available locally)
const BUZZFINAL_TWEETS_PATH = path.join(process.cwd(), '../BuzzFinal/twitter/tweets.json');

// Target profile
const TARGET_PROFILE = 'BuzzFinal';

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
        const { limit = 20 } = req.query;

        // Try to read from local BuzzFinal tweets.json first
        let tweets = await loadTweetsFromLocal();

        // Filter for BuzzFinal profile only
        tweets = tweets.filter(t => t.profile === TARGET_PROFILE);

        // Sort by time (newest first)
        tweets.sort((a, b) => new Date(b.time) - new Date(a.time));

        // Limit results
        tweets = tweets.slice(0, parseInt(limit));

        // Format tweets for frontend
        const formattedTweets = tweets.map(tweet => ({
            id: tweet.id,
            text: tweet.text,
            author: '60Saniye Haber',
            username: `@${TARGET_PROFILE}`,
            time: formatTime(tweet.time),
            media: tweet.media || [],
            hasVideo: tweet.video || false,
            hasImage: tweet.image || false,
            likes: tweet.engagement?.likes || 0,
            retweets: tweet.engagement?.retweets || 0,
            profile: tweet.profile
        }));

        return res.json({
            tweets: formattedTweets,
            total: formattedTweets.length
        });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            error: error.message,
            tweets: getSampleTweets()
        });
    }
}

async function loadTweetsFromLocal() {
    try {
        const tweetsData = fs.readFileSync(BUZZFINAL_TWEETS_PATH, 'utf8');
        return JSON.parse(tweetsData);
    } catch (error) {
        console.log('Local tweets not found, using sample data');
        return getSampleTweets();
    }
}

function formatTime(isoTime) {
    const date = new Date(isoTime);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds

    if (diff < 60) return 'Az önce';
    if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

// Sample tweets fallback with video examples
function getSampleTweets() {
    return [
        {
            id: '1',
            text: 'Son dakika! Gelişmeler devam ediyor. Detaylar yakında...',
            profile: 'BuzzFinal',
            time: new Date().toISOString(),
            media: [
                {
                    type: 'video',
                    url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4'
                }
            ],
            video: true,
            image: false,
            engagement: { likes: 1234, retweets: 567 }
        },
        {
            id: '2',
            text: '60Saniye ile en son haberleri takip edin! ⚡ #SonDakika #Haber',
            profile: 'BuzzFinal',
            time: new Date(Date.now() - 3600000).toISOString(),
            media: [],
            video: false,
            image: false,
            engagement: { likes: 892, retweets: 234 }
        },
        {
            id: '3',
            text: 'Bu akşamki gündem maddeleri çok önemli. Tüm detaylar videomuzda...',
            profile: 'BuzzFinal',
            time: new Date(Date.now() - 7200000).toISOString(),
            media: [
                {
                    type: 'video',
                    url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4'
                }
            ],
            video: true,
            image: false,
            engagement: { likes: 2456, retweets: 890 }
        }
    ];
}
