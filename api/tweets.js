// Twitter API v2 - Fetch tweets from BuzzHaber profile
// This is a Vercel serverless function

import { TwitterApi } from 'twitter-api-v2';

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
        const { page = 0, limit = 10 } = req.query;

        // Twitter API credentials - should be in environment variables
        const BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;

        if (!BEARER_TOKEN) {
            // Return sample data if no token provided
            return res.json({
                tweets: getSampleTweets(parseInt(page) * parseInt(limit), parseInt(limit)),
                hasMore: true,
                page: parseInt(page)
            });
        }

        // Initialize Twitter client
        const client = new TwitterApi(BEARER_TOKEN);

        // Fetch tweets from BuzzHaber user
        // Note: You need to replace 'BuzzHaberTR' with the actual username
        const userTimeline = await client.v2.userTimeline(
            'BuzzHaberTR', // username
            {
                'tweet.fields': ['created_at', 'public_metrics', 'entities', 'attachments'],
                'media.fields': ['type', 'url', 'preview_image_url', 'variants'],
                'expansions': ['attachments.media_keys'],
                max_results: Math.min(parseInt(limit), 100)
            }
        );

        const tweets = userTimeline.data.data || [];

        const formattedTweets = tweets.map(tweet => ({
            id: tweet.id,
            text: tweet.text,
            author: 'BuzzHaber',
            username: '@BuzzHaberTR',
            time: formatTime(tweet.created_at),
            likes: tweet.public_metrics?.like_count || 0,
            retweets: tweet.public_metrics?.retweet_count || 0,
            replies: tweet.public_metrics?.reply_count || 0,
            hashtags: tweet.entities?.hashtags?.map(h => h.tag) || [],
            media: extractMedia(tweet, userTimeline.data.includes?.media)
        }));

        return res.json({
            tweets: formattedTweets,
            hasMore: tweets.length === parseInt(limit),
            page: parseInt(page)
        });

    } catch (error) {
        console.error('Twitter API Error:', error);

        // Return sample data on error
        const { page = 0, limit = 10 } = req.query;
        return res.json({
            tweets: getSampleTweets(parseInt(page) * parseInt(limit), parseInt(limit)),
            hasMore: true,
            page: parseInt(page),
            error: error.message
        });
    }
}

function formatTime(createdAt) {
    const date = new Date(createdAt);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds

    if (diff < 60) return 'Az önce';
    if (diff < 3600) return `${Math.floor(diff / 60)} dakika önce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
    return date.toLocaleDateString('tr-TR');
}

function extractMedia(tweet, includes) {
    if (!tweet.attachments?.media_keys || !includes) return null;

    const mediaKey = tweet.attachments.media_keys[0];
    const media = includes.find(m => m.media_key === mediaKey);

    if (!media) return null;

    if (media.type === 'video' || media.type === 'animated_gif') {
        // Get the highest quality video variant
        const videoVariants = media.variants?.filter(v => v.content_type === 'video/mp4') || [];
        const highestQuality = videoVariants.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
        return highestQuality?.url || null;
    }

    return media.url || media.preview_image_url || null;
}

// Sample tweets data for fallback/demo
function getSampleTweets(offset = 0, limit = 10) {
    const allTweets = [
        {
            id: 1,
            text: '🚀 Son dakika! Türkiye\'nin yeni yapay zeka girişimi 1 milyon dolar yatırım aldı. Teknoloji devleri dikkatle izliyor. Sektördeki uzmanlar bu gelişmeyi "dönüş noktası" olarak nitelendiriyor. https://buzzhaber.com/yapay-zeka-yatirimi',
            author: 'BuzzHaber',
            username: '@BuzzHaberTR',
            time: '2 saat önce',
            likes: 1234,
            retweets: 567,
            hashtags: ['teknoloji', 'yatırım', 'yapayzeka', 'girisim'],
            media: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
        },
        {
            id: 2,
            text: '⚽ Spor dünyasından şok transfer iddiası! Süper star ekipler bırakıyor. Detaylar gelmeye devam ediyor. Kaynaklara göre 50 milyon euro'luk anlaşma kapıda. Transfer döneminin en bombası! 🏆',
            author: 'BuzzHaber',
            username: '@BuzzHaberTR',
            time: '3 saat önce',
            likes: 2341,
            retweets: 891,
            hashtags: ['futbol', 'transfer', 'spor', 'süperlig'],
            media: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
        },
        {
            id: 3,
            text: '📱 Apple yeni iPhone\'u tanıttı! İşte özellikleri ve fiyatı. Yeni model, daha güçlü işlemci ve geliştirilmiş kamera ile geliyor. Türkiye fiyatı da belli oldu! https://buzzhaber.com/yeni-iphone',
            author: 'BuzzHaber',
            username: '@BuzzHaberTR',
            time: '4 saat önce',
            likes: 3456,
            retweets: 1234,
            hashtags: ['apple', 'iphone', 'teknoloji', 'mobil'],
            media: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
        },
        {
            id: 4,
            text: '💼 Ekonomide yeni gelişme! Merkez Bankası faiz kararını açıkladı. Politika faizi 50 baz puan indirildi. Piyasalar kararı olumlu karşıladı. https://buzzhaber.com/merkez-bankasi-faiz',
            author: 'BuzzHaber',
            username: '@BuzzHaberTR',
            time: '5 saat önce',
            likes: 4567,
            retweets: 1567,
            hashtags: ['ekonomi', 'faiz', 'merkezbankasi', 'piyasa'],
            media: null
        },
        {
            id: 5,
            text: '🌍 İklim değişikliği alarm! Bilim insanları kritik eşik aşıldığını açıkladı. Küresel ısınma 1.5 dereceyi aştı. Uzmanlar acil eylem çağrısında bulunuyor. 🌡️',
            author: 'BuzzHaber',
            username: '@BuzzHaberTR',
            time: '6 saat önce',
            likes: 5678,
            retweets: 2345,
            hashtags: ['iklim', 'cevre', 'dunya', 'iklimkrizi'],
            media: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
        },
        {
            id: 6,
            text: '🎬 Netflix\'ten yeni dizi! Türkiye\'de rekor kıran yapım sezon finali yapıyor. Final bölümüyle ilgili detaylar sızdırıldı. Spoiler uyarısı! 🍿',
            author: 'BuzzHaber',
            username: '@BuzzHaberTR',
            time: '7 saat önce',
            likes: 2890,
            retweets: 1023,
            hashtags: ['netflix', 'dizi', 'yapim', 'turkiye'],
            media: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4'
        },
        {
            id: 7,
            text: '🏎️ Formula 1\'de heyecan dorukta! Türk pilotun ilk pole pozisyonu! Türkiye\'yi gururlandıran başarı. Yarış hafta sonu kaçmaz! 🏁',
            author: 'BuzzHaber',
            username: '@BuzzHaberTR',
            time: '8 saat önce',
            likes: 3456,
            retweets: 1456,
            hashtags: ['f1', 'formula1', 'motor Sporları', 'turkiye'],
            media: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4'
        },
        {
            id: 8,
            text: '💳 Kripto para piyasasında hareketlilik! Bitcoin yeni ATH yapabilir mi? Analistler yorumluyor. Altcoin\'lerde de yükseliş devam ediyor. 📈',
            author: 'BuzzHaber',
            username: '@BuzzHaberTR',
            time: '9 saat önce',
            likes: 1987,
            retweets: 876,
            hashtags: ['kripto', 'bitcoin', 'altcoin', 'yatirim'],
            media: null
        },
        {
            id: 9,
            text: '🎵 Müzik dünyasından büyük kayıp! Efsane sanatçı hayatını kaybetti. Sevenlerine başsağlığı mesajları yağıyor. https://buzzhaber.com/muzik-kayip',
            author: 'BuzzHaber',
            username: '@BuzzHaberTR',
            time: '10 saat önce',
            likes: 8765,
            retweets: 4567,
            hashtags: ['muzik', 'sanatci', 'kayip', 'bas sagligi'],
            media: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4'
        },
        {
            id: 10,
            text: '🏥 Sağlık Bakanlığı\'ndan yeni açıklama! Aşı takvimi güncellendi. Yeni dozlar için randevular açıldı. Bakan:"Hedefimiz tam koruma" 💉',
            author: 'BuzzHaber',
            username: '@BuzzHaberTR',
            time: '11 saat önce',
            likes: 2345,
            retweets: 987,
            hashtags: ['saglik', 'asi', 'bakanlik', 'koruma'],
            media: null
        },
        {
            id: 11,
            text: '🎮 Oyun dünyasında sarsıcı iddia! Yeni konsol geliyor! Özellikleri sızdırıldı. Rakipler alarmde! https://buzzhaber.com/yeni-konsol',
            author: 'BuzzHaber',
            username: '@BuzzHaberTR',
            time: '12 saat önce',
            likes: 1678,
            retweets: 654,
            hashtags: ['oyun', 'konsol', 'gaming', 'teknoloji'],
            media: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'
        },
        {
            id: 12,
            text: '✈️ Türk Hava Yolları\'ndan yeni rota! 20 yeni ülkeye uçacak. Türkiye\'yi dünyaya bağlayan proje. Uçuşlar nisan ayında başlıyor. 🌍',
            author: 'BuzzHaber',
            username: '@BuzzHaberTR',
            time: '13 saat önce',
            likes: 2345,
            retweets: 789,
            hashtags: ['thy', 'havacilik', 'turkiye', 'seyahat'],
            media: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4'
        },
        {
            id: 13,
            text: '📺 Netflix yeni abone paketi açıkladı! Reklamlı paket Türkiye\'de de kullanıma sunuluyor. Fiyatlar belli oldu. https://buzzhaber.com/netflix-reklam',
            author: 'BuzzHaber',
            username: '@BuzzHaberTR',
            time: '14 saat önce',
            likes: 1432,
            retweets: 543,
            hashtags: ['netflix', 'abone', 'paket', 'yayin'],
            media: null
        },
        {
            id: 14,
            text: '🌙 NASA\'dan uzay haberi! Yeni keşif tüm dünyayı şaşırttı. Bilim dünyasında çalkantı. Detaylar gelecek... 🚀',
            author: 'BuzzHaber',
            username: '@BuzzHaberTR',
            time: '15 saat önce',
            likes: 5432,
            retweets: 2345,
            hashtags: ['nasa', 'uzay', 'bilim', 'kesif'],
            media: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
        },
        {
            id: 15,
            text: '⚡ Elektrik faturalarında yeni düzenleme! Faturalar düşecek mi? Bakan açıklama yapıyor. Yüzde 10 indirim gündemde. 💡',
            author: 'BuzzHaber',
            username: '@BuzzHaberTR',
            time: '16 saat önce',
            likes: 3456,
            retweets: 1234,
            hashtags: ['elektrik', 'fatura', 'enerji', 'indirim'],
            media: null
        }
    ];

    return allTweets.slice(offset, offset + limit);
}
