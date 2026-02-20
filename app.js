// BuzzHaber News App - Main JavaScript

class BuzzNewsApp {
    constructor() {
        this.tweets = [];
        this.currentPage = 0;
        this.tweetsPerPage = 10;
        this.isLoading = false;
        this.observer = null;

        this.init();
    }

    init() {
        this.loadTweets();
        this.setupInfiniteScroll();
        this.setupEventListeners();
    }

    async loadTweets() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoader(true);

        try {
            // Fetch tweets from our API
            const response = await fetch(`/api/tweets?page=${this.currentPage}&limit=${this.tweetsPerPage}`);
            const data = await response.json();

            if (data.tweets && data.tweets.length > 0) {
                this.tweets = [...this.tweets, ...data.tweets];
                this.renderTweets(data.tweets);
                this.currentPage++;
            } else if (this.currentPage === 0) {
                // Show sample data if no tweets available
                this.loadSampleData();
            }
        } catch (error) {
            console.error('Failed to load tweets:', error);
            // Load sample data on error
            this.loadSampleData();
        } finally {
            this.isLoading = false;
            this.showLoader(false);
        }
    }

    loadSampleData() {
        const sampleTweets = [
            {
                id: 1,
                text: '🚀 Son dakika! Türkiye'nin yeni yapay zeka girişimi 1 milyon dolar yatırım aldı. Teknoloji devleri dikkatle izliyor...',
                media: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4',
                author: 'BuzzHaber',
                username: '@BuzzHaberTR',
                time: '2 saat önce',
                likes: 1234,
                retweets: 567,
                hashtags: ['teknoloji', 'yatırım', 'yapayzekaa']
            },
            {
                id: 2,
                text: '⚽ Spor dünyasından şok transfer iddiası! Süper star ekipler bırakıyor. Detaylar geldi...',
                media: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_2mb.mp4',
                author: 'BuzzHaber',
                username: '@BuzzHaberTR',
                time: '3 saat önce',
                likes: 2341,
                retweets: 891,
                hashtags: ['futbol', 'transfer', 'spor']
            },
            {
                id: 3,
                text: '🌍 İklim değişikliği alarm! Bilim insanları kritik eşik aşıldığını açıkladı. İşte detaylar...',
                media: null,
                author: 'BuzzHaber',
                username: '@BuzzHaberTR',
                time: '5 saat önce',
                likes: 5678,
                retweets: 2345,
                hashtags: ['iklim', 'çevre', 'dünya']
            },
            {
                id: 4,
                text: '📱 Apple yeni iPhone'u tanıttı! İşte özellikleri ve fiyatı...',
                media: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_5mb.mp4',
                author: 'BuzzHaber',
                username: '@BuzzHaberTR',
                time: '6 saat önce',
                likes: 3456,
                retweets: 1234,
                hashtags: ['apple', 'iphone', 'teknoloji']
            },
            {
                id: 5,
                text: '💼 Ekonomide yeni gelişme! Merkez Bankası faiz kararını açıkladı...',
                author: 'BuzzHaber',
                username: '@BuzzHaberTR',
                time: '8 saat önce',
                likes: 4567,
                retweets: 1567,
                hashtags: ['ekonomi', 'faiz', 'merkezbankası']
            }
        ];

        this.tweets = sampleTweets;
        this.renderTweets(sampleTweets);
    }

    renderTweets(tweets) {
        const feed = document.getElementById('newsFeed');

        tweets.forEach(tweet => {
            const card = this.createTweetCard(tweet);
            feed.appendChild(card);
        });

        // Setup video autoplay for new cards
        this.setupVideoAutoplay();
    }

    createTweetCard(tweet) {
        const card = document.createElement('div');
        card.className = 'news-card';
        card.dataset.tweetId = tweet.id;

        const hashtags = tweet.hashtags ? tweet.hashtags.map(tag =>
            `<span class="hashtag">#${tag}</span>`
        ).join('') : '';

        const mediaHtml = tweet.media ? `
            <div class="news-video-container">
                <video class="news-video" muted playsinline loop poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Crect fill='%2316181c' width='16' height='9'/%3E%3C/svg%3E">
                    <source src="${tweet.media}" type="video/mp4">
                </video>
                <div class="video-overlay"></div>
                <div class="video-play-btn"></div>
            </div>
        ` : '';

        card.innerHTML = `
            <div class="news-card-header">
                <div class="news-meta">
                    <div class="news-avatar">⚡</div>
                    <div>
                        <div class="news-author">${tweet.author}</div>
                        <div class="news-username">${tweet.username}</div>
                    </div>
                    <div class="news-time">${tweet.time}</div>
                </div>
                <div class="news-content">
                    ${this.formatTweetText(tweet.text)}
                    ${hashtags ? `<div class="news-hashtags">${hashtags}</div>` : ''}
                </div>
            </div>
            ${mediaHtml}
            <div class="news-card-actions">
                <button class="action-btn like">
                    <span>❤️</span>
                    <span>${this.formatNumber(tweet.likes || 0)}</span>
                </button>
                <button class="action-btn retweet">
                    <span>🔄</span>
                    <span>${this.formatNumber(tweet.retweets || 0)}</span>
                </button>
                <button class="action-btn share">
                    <span>📤</span>
                    <span>Paylaş</span>
                </button>
            </div>
        `;

        return card;
    }

    formatTweetText(text) {
        // Convert URLs to links
        text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        // Convert line breaks
        text = text.replace(/\n/g, '<br>');
        return text;
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    setupVideoAutoplay() {
        const videos = document.querySelectorAll('.news-video:not(.initialized)');

        videos.forEach(video => {
            video.classList.add('initialized');
            video.muted = true; // Autoplay requires muted

            // Play on hover
            const card = video.closest('.news-card');
            const playBtn = card.querySelector('.video-play-btn');

            const playVideo = () => {
                video.play().catch(e => console.log('Autoplay prevented:', e));
                video.classList.remove('paused');
            };

            const pauseVideo = () => {
                video.pause();
                video.classList.add('paused');
            };

            // Hover to play
            card.addEventListener('mouseenter', playVideo);
            card.addEventListener('mouseleave', pauseVideo);

            // Click to toggle mute
            video.addEventListener('click', () => {
                video.muted = !video.muted;
            });

            playBtn.addEventListener('click', () => {
                if (video.paused) {
                    video.play();
                    video.classList.remove('paused');
                } else {
                    video.pause();
                    video.classList.add('paused');
                }
            });

            // Intersection Observer for viewport autoplay
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !entry.target.classList.contains('manually-paused')) {
                        entry.target.play().catch(() => {});
                    } else {
                        entry.target.pause();
                    }
                });
            }, { threshold: 0.6 });

            observer.observe(video);
        });
    }

    setupInfiniteScroll() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.isLoading) {
                    this.loadTweets();
                }
            });
        }, { threshold: 0.1 });

        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            this.observer.observe(loadMoreBtn);
        }
    }

    setupEventListeners() {
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadTweets());
        }

        // Action buttons
        document.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('.action-btn');
            if (actionBtn) {
                this.handleAction(actionBtn);
            }
        });
    }

    handleAction(btn) {
        if (btn.classList.contains('like')) {
            btn.style.color = btn.style.color === 'rgb(249, 24, 128)' ? '' : '#f91880';
            const count = btn.querySelector('span:last-child');
            const currentCount = parseInt(count.textContent) || 0;
            count.textContent = this.formatNumber(currentCount + (btn.style.color === 'rgb(249, 24, 128)' ? 1 : -1));
        } else if (btn.classList.contains('share')) {
            const tweetText = btn.closest('.news-card').querySelector('.news-content').textContent;
            const shareUrl = encodeURIComponent(window.location.href);
            const text = encodeURIComponent(tweetText);
            window.open(`https://twitter.com/intent/tweet?text=${text}&url=${shareUrl}`, '_blank');
        }
    }

    showLoader(show) {
        const loader = document.getElementById('loader');
        const loadMoreBtn = document.getElementById('loadMoreBtn');

        if (loader) loader.style.display = show ? 'block' : 'none';
        if (loadMoreBtn) loadMoreBtn.style.display = show ? 'none' : 'flex';
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new BuzzNewsApp();
});
