// BuzzHaber News App - BuzzFinal Integration

class BuzzNewsApp {
    constructor() {
        this.tweets = [];
        this.currentPage = 0;
        this.tweetsPerPage = 20;
        this.isLoading = false;
        this.totalTweets = 0;

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
            const offset = this.currentPage * this.tweetsPerPage;
            const response = await fetch(`/api/tweets?limit=${this.tweetsPerPage}&offset=${offset}`);
            const data = await response.json();

            if (data.tweets && data.tweets.length > 0) {
                this.tweets = [...this.tweets, ...data.tweets];
                this.totalTweets = data.total || this.tweets.length;
                this.renderTweets(data.tweets);
                this.currentPage++;
            } else {
                this.showEndMessage();
            }
        } catch (error) {
            console.error('Failed to load tweets:', error);
        } finally {
            this.isLoading = false;
            this.showLoader(false);
        }
    }

    renderTweets(tweets) {
        const feed = document.getElementById('newsFeed');

        tweets.forEach(tweet => {
            const card = this.createTweetCard(tweet);
            feed.appendChild(card);
        });

        // Setup media elements
        this.setupMediaElements();
    }

    createTweetCard(tweet) {
        const card = document.createElement('div');
        card.className = 'news-card';
        card.dataset.tweetId = tweet.id;

        // Extract hashtags from text
        const hashtags = this.extractHashtags(tweet.text);
        const hashtagHtml = hashtags.length > 0 ?
            `<div class="news-hashtags">${hashtags.map(tag => `<span class="hashtag">#${tag}</span>`).join('')}</div>` : '';

        // Format text with line breaks
        const formattedText = this.formatText(tweet.text);

        // Media HTML
        let mediaHtml = '';
        if (tweet.media && tweet.media.length > 0) {
            const firstMedia = tweet.media[0];
            if (firstMedia.type === 'video' || tweet.hasVideo) {
                mediaHtml = `
                    <div class="news-video-container">
                        <video class="news-video" muted playsinline loop
                               poster="${firstMedia.url || ''}"
                               src="${firstMedia.url || ''}">
                        </video>
                        <div class="video-overlay"></div>
                        <div class="video-play-btn"></div>
                        <div class="mute-indicator">🔇</div>
                    </div>
                `;
            } else if (firstMedia.type === 'image' || tweet.hasImage) {
                const images = tweet.media.map(m => m.url).filter(Boolean);
                if (images.length > 0) {
                    mediaHtml = `
                        <div class="news-image-container ${images.length > 1 ? 'multiple-images' : ''}">
                            ${images.map(url => `
                                <img src="${url}" alt="Haber görseli" class="news-image" loading="lazy">
                            `).join('')}
                        </div>
                    `;
                }
            }
        }

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
                    ${formattedText}
                    ${hashtagHtml}
                </div>
            </div>
            ${mediaHtml}
            <div class="news-card-actions">
                <button class="action-btn like" onclick="app.toggleLike(this)">
                    <span>❤️</span>
                    <span class="count">${this.formatNumber(tweet.likes || 0)}</span>
                </button>
                <button class="action-btn retweet" onclick="app.toggleRetweet(this)">
                    <span>🔄</span>
                    <span class="count">${this.formatNumber(tweet.retweets || 0)}</span>
                </button>
                <button class="action-btn share" onclick="app.shareTweet('${tweet.id}')">
                    <span>📤</span>
                    <span>Paylaş</span>
                </button>
            </div>
        `;

        return card;
    }

    extractHashtags(text) {
        const hashtagRegex = /#(\w+)/g;
        const matches = text.match(hashtagRegex);
        return matches ? matches.map(tag => tag.substring(1)) : [];
    }

    formatText(text) {
        // Convert line breaks
        text = text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>');
        return `<p>${text}</p>`;
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    setupMediaElements() {
        const videos = document.querySelectorAll('.news-video:not(.initialized)');

        videos.forEach(video => {
            video.classList.add('initialized');
            const card = video.closest('.news-card');
            const playBtn = card.querySelector('.video-play-btn');
            const muteIndicator = card.querySelector('.mute-indicator');

            // Auto-play on viewport
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.play().catch(() => {});
                    } else {
                        entry.target.pause();
                    }
                });
            }, { threshold: 0.5 });

            observer.observe(video);

            // Hover to play/pause
            card.addEventListener('mouseenter', () => {
                video.play().catch(() => {});
            });

            card.addEventListener('mouseleave', () => {
                video.pause();
            });

            // Click to toggle mute
            video.addEventListener('click', () => {
                video.muted = !video.muted;
                if (muteIndicator) {
                    muteIndicator.textContent = video.muted ? '🔇' : '🔊';
                    muteIndicator.style.opacity = video.muted ? '1' : '0';
                }
            });

            // Play button click
            if (playBtn) {
                playBtn.addEventListener('click', () => {
                    if (video.paused) {
                        video.play();
                    } else {
                        video.pause();
                    }
                });
            }
        });

        // Image gallery for multiple images
        const imageContainers = document.querySelectorAll('.multiple-images');
        imageContainers.forEach(container => {
            const images = container.querySelectorAll('.news-image');
            if (images.length > 1) {
                container.classList.add('gallery-' + images.length);
            }
        });
    }

    setupInfiniteScroll() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.isLoading) {
                    this.loadTweets();
                }
            });
        }, { threshold: 0.1 });

        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            observer.observe(loadMoreBtn);
        }
    }

    setupEventListeners() {
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => this.loadTweets());
        }
    }

    toggleLike(btn) {
        btn.classList.toggle('active');
        const count = btn.querySelector('.count');
        const current = parseInt(count.textContent) || 0;
        count.textContent = this.formatNumber(btn.classList.contains('active') ? current + 1 : current - 1);
    }

    toggleRetweet(btn) {
        btn.classList.toggle('active');
    }

    shareTweet(tweetId) {
        if (navigator.share) {
            navigator.share({
                title: 'BuzzHaber',
                text: 'Haberi paylaş!',
                url: window.location.href
            });
        } else {
            // Copy to clipboard
            navigator.clipboard.writeText(window.location.href);
            alert('Link kopyalandı!');
        }
    }

    showLoader(show) {
        const loader = document.getElementById('loader');
        const loadMoreBtn = document.getElementById('loadMoreBtn');

        if (loader) loader.style.display = show ? 'block' : 'none';
        if (loadMoreBtn) loadMoreBtn.style.display = show ? 'none' : 'flex';
    }

    showEndMessage() {
        const container = document.querySelector('.load-more-container');
        if (container) {
            container.innerHTML = `
                <div class="end-message">
                    <p>🎉 Tüm haberleri gördünüz!</p>
                    <small>Daha fazla haber için sonra tekrar kontrol edin.</small>
                </div>
            `;
        }
    }
}

// Global app instance
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new BuzzNewsApp();
});
