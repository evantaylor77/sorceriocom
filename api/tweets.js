// BuzzNews API - Fetch tweets from BuzzFinal data
// Vercel serverless function

import fs from 'fs';
import path from 'path';

const BUZZFINAL_TWEETS_PATH = path.join(process.cwd(), '../BuzzFinal/twitter/tweets.json');

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
        const { limit = 20, offset = 0 } = req.query;

        // Try to read from BuzzFinal tweets.json
        let tweets = [];

        try {
            const tweetsData = fs.readFileSync(BUZZFINAL_TWEETS_PATH, 'utf8');
            tweets = JSON.parse(tweetsData);

            // Sort by time (newest first)
            tweets.sort((a, b) => new Date(b.time) - new Date(a.time));

            // Filter to only tweets with media (images or videos)
            tweets = tweets.filter(t => t.media && t.media.length > 0);

        } catch (error) {
            console.log('BuzzFinal tweets not found, using sample data');
            tweets = getSampleTweets();
        }

        // Apply pagination
        const startIndex = parseInt(offset);
        const endIndex = startIndex + parseInt(limit);
        const paginatedTweets = tweets.slice(startIndex, endIndex);

        // Format tweets for frontend
        const formattedTweets = paginatedTweets.map(tweet => ({
            id: tweet.id,
            text: tweet.text,
            author: formatProfileName(tweet.profile),
            username: `@${tweet.profile}`,
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
            total: tweets.length,
            hasMore: endIndex < tweets.length,
            offset: startIndex,
            limit: parseInt(limit)
        });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            error: error.message,
            tweets: getSampleTweets().slice(0, parseInt(req.query.limit) || 20)
        });
    }
}

function formatProfileName(profile) {
    const profileNames = {
        'asayisberkemal0': 'Asayis Berkemal',
        'ajans_muhbir': 'Ajans Muhbir',
        'metropolmedya_': 'Metrop Medya',
        'darkwebhaber': 'Dark Web Haber',
        'gazete_manusta': 'Gazete Manuşta',
        'son_dakika': 'Son Dakika',
        'haber_global': 'Haber Global',
        'flash_haber': 'Flash Haber'
    };
    return profileNames[profile] || profile.charAt(0).toUpperCase() + profile.slice(1);
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

// Sample tweets fallback
function getSampleTweets() {
    return [
        {
            id: '1',
            text: 'Son dakika haberleri içinBuzzHaber\'i takip edin! 🚀',
            author: 'BuzzHaber',
            username: '@BuzzHaberTR',
            time: 'Az önce',
            media: [],
            hasVideo: false,
            hasImage: false
        }
    ];
}
