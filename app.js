// 60Saniye News App - Single news display platform

class SeksenSaniyeApp {
    constructor() {
        this.newsData = [];
        this.currentNewsIndex = 0;
        this.isLoading = false;
        this.currentVideo = null;

        this.init();
    }

    async init() {
        this.cacheElements();
        this.setupEventListeners();
        await this.fetchNews();

        if (this.newsData.length > 0) {
            this.displayNews(0);
        }
    }

    cacheElements() {
        // Container elements
        this.loadingState = document.getElementById('loadingState');
        this.newsContent = document.getElementById('newsContent');
        this.errorState = document.getElementById('errorState');

        // News display elements
        this.newsText = document.getElementById('newsText');
        this.newsTime = document.getElementById('newsTime');
        this.newsVideo = document.getElementById('newsVideo');
        this.videoContainer = document.getElementById('videoContainer');
        this.embedContainer = document.getElementById('embedContainer');
        this.videoControls = document.getElementById('videoControls');
        this.hashtagsContainer = document.getElementById('hashtags');

        // Navigation elements
        this.nextBtn = document.getElementById('nextBtn');
        this.currentIndexEl = document.getElementById('currentIndex');
        this.totalNewsEl = document.getElementById('totalNews');
        this.retryBtn = document.getElementById('retryBtn');

        // Video controls
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.muteBtn = document.getElementById('muteBtn');
    }

    setupEventListeners() {
        // Next button
        this.nextBtn.addEventListener('click', () => this.nextNews());

        // Retry button
        if (this.retryBtn) {
            this.retryBtn.addEventListener('click', () => this.fetchNews());
        }

        // Video controls
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }

        if (this.muteBtn) {
            this.muteBtn.addEventListener('click', () => this.toggleMute());
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowRight') {
                e.preventDefault();
                this.nextNews();
            }
            if (e.code === 'KeyM') {
                this.toggleMute();
            }
        });

        // Touch gestures for mobile
        this.setupTouchGestures();
    }

    setupTouchGestures() {
        let touchStartX = 0;
        let touchStartY = 0;

        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });

        document.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;

            // Swipe left to go to next news
            if (Math.abs(diffX) > Math.abs(diffY) && diffX < -50) {
                this.nextNews();
            }
        });
    }

    async fetchNews() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoading();

        try {
            const response = await fetch('/api/scrape-tweets?limit=50');
            const data = await response.json();

            if (data.tweets && data.tweets.length > 0) {
                this.newsData = data.tweets;
                this.currentNewsIndex = 0;

                // Update total count
                if (this.totalNewsEl) {
                    this.totalNewsEl.textContent = this.newsData.length;
                }

                this.hideLoading();
                this.displayNews(0);
            } else {
                this.showError();
            }
        } catch (error) {
            console.error('Failed to fetch news:', error);
            this.showError();
        } finally {
            this.isLoading = false;
        }
    }

    displayNews(index) {
        if (!this.newsData[index]) return;

        const news = this.newsData[index];

        // Update current index display
        if (this.currentIndexEl) {
            this.currentIndexEl.textContent = index + 1;
        }

        // Update text content
        this.newsText.innerHTML = this.formatText(news.text);
        this.newsTime.textContent = news.time;

        // Display hashtags
        this.displayHashtags(news.text);

        // Handle video/media
        this.displayMedia(news);

        // Show content
        this.newsContent.style.display = 'block';
        this.errorState.style.display = 'none';

        // Enable next button
        this.nextBtn.disabled = false;
    }

    displayMedia(news) {
        // Reset containers
        this.embedContainer.innerHTML = '';
        this.newsVideo.style.display = 'none';
        this.videoControls.style.display = 'none';

        // Check if news has video
        if (news.hasVideo && news.media && news.media.length > 0) {
            // Check for tweet_url (Twitter video)
            const tweetUrlMedia = news.media.find(m => m.type === 'tweet_url');
            const videoMedia = news.media.find(m => m.type === 'video');

            if (tweetUrlMedia) {
                // Use video proxy to get direct video URL for autoplay
                this.loadVideoFromTweetUrl(tweetUrlMedia.url);
            } else if (videoMedia && videoMedia.url && !videoMedia.url.startsWith('blob:')) {
                // Direct video URL
                this.newsVideo.style.display = 'block';
                this.videoControls.style.display = 'flex';
                this.newsVideo.src = videoMedia.url;
                this.videoContainer.style.display = 'block';
                this.playVideo();
            } else {
                // No playable video
                this.videoContainer.style.display = 'none';
            }
        } else {
            this.videoContainer.style.display = 'none';
        }
    }

    async loadVideoFromTweetUrl(tweetUrl) {
        // Show loading state
        this.videoContainer.style.display = 'block';
        this.embedContainer.innerHTML = '<p style="color: #666; text-align: center; padding: 20px;">Video yükleniyor...</p>';

        try {
            // Try to get direct video URL from our proxy API
            const response = await fetch(`/api/video-proxy?tweetUrl=${encodeURIComponent(tweetUrl)}`);

            if (response.ok) {
                const data = await response.json();

                if (data.videoUrl) {
                    // We got a direct video URL - play it
                    this.embedContainer.innerHTML = '';
                    this.newsVideo.style.display = 'block';
                    this.videoControls.style.display = 'flex';
                    this.newsVideo.src = data.videoUrl;
                    this.playVideo();
                } else {
                    // No video URL found - use Twitter embed fallback
                    this.displayTwitterEmbedFallback(tweetUrl);
                }
            } else {
                // API failed - use Twitter embed fallback
                this.displayTwitterEmbedFallback(tweetUrl);
            }
        } catch (error) {
            console.error('Video proxy error:', error);
            // On error, use Twitter embed fallback
            this.displayTwitterEmbedFallback(tweetUrl);
        }
    }

    displayTwitterEmbedFallback(tweetUrl) {
        // Fallback to Twitter embed (no autoplay)
        this.embedContainer.innerHTML = '';
        this.newsVideo.style.display = 'none';
        this.videoControls.style.display = 'none';

        if (!document.getElementById('twitter-wjs')) {
            const script = document.createElement('script');
            script.id = 'twitter-wjs';
            script.src = 'https://platform.twitter.com/widgets.js';
            script.charset = 'utf-8';
            script.async = true;
            document.head.appendChild(script);
        }

        const blockquote = document.createElement('blockquote');
        blockquote.className = 'twitter-tweet';
        blockquote.setAttribute('data-theme', 'dark');

        const link = document.createElement('a');
        link.href = tweetUrl;
        link.textContent = 'Videoyu görüntüle';

        blockquote.appendChild(link);
        this.embedContainer.appendChild(blockquote);

        if (window.twttr) {
            window.twttr.widgets.load(this.embedContainer);
        }
    }

    displayTwitterEmbed(tweetUrl) {
        // This method is now replaced by loadVideoFromTweetUrl
        this.loadVideoFromTweetUrl(tweetUrl);
    }

    displayHashtags(text) {
        const hashtags = this.extractHashtags(text);

        if (hashtags.length > 0) {
            this.hashtagsContainer.innerHTML = hashtags
                .map(tag => `<span class="hashtag">#${tag}</span>`)
                .join('');
            this.hashtagsContainer.style.display = 'flex';
        } else {
            this.hashtagsContainer.style.display = 'none';
        }
    }

    extractHashtags(text) {
        const hashtagRegex = /#(\w+)/g;
        const matches = text.match(hashtagRegex);
        return matches ? matches.map(tag => tag.substring(1)) : [];
    }

    formatText(text) {
        // Convert line breaks to paragraphs
        const lines = text.split('\n').filter(line => line.trim());
        return lines.map(line => `<p>${line}</p>`).join('');
    }

    nextNews() {
        // Cycle back to start if at end
        this.currentNewsIndex = (this.currentNewsIndex + 1) % this.newsData.length;

        // Add transition animation
        this.newsContent.style.opacity = '0';
        this.newsContent.style.transform = 'translateX(-20px)';

        setTimeout(() => {
            this.displayNews(this.currentNewsIndex);
            this.newsContent.style.transform = 'translateX(20px)';

            setTimeout(() => {
                this.newsContent.style.opacity = '1';
                this.newsContent.style.transform = 'translateX(0)';
            }, 50);
        }, 200);
    }

    playVideo() {
        if (this.newsVideo && this.newsVideo.src) {
            this.newsVideo.play().catch(err => {
                console.log('Auto-play prevented:', err);
            });
            this.updatePlayPauseButton(true);
        }
    }

    pauseVideo() {
        if (this.newsVideo) {
            this.newsVideo.pause();
            this.updatePlayPauseButton(false);
        }
    }

    togglePlayPause() {
        if (this.newsVideo.paused) {
            this.playVideo();
        } else {
            this.pauseVideo();
        }
    }

    toggleMute() {
        if (this.newsVideo) {
            this.newsVideo.muted = !this.newsVideo.muted;
            this.updateMuteButton();
        }
    }

    updatePlayPauseButton(isPlaying) {
        const iconPlay = this.playPauseBtn?.querySelector('.icon-play');
        const iconPause = this.playPauseBtn?.querySelector('.icon-pause');

        if (iconPlay && iconPause) {
            iconPlay.style.display = isPlaying ? 'none' : 'block';
            iconPause.style.display = isPlaying ? 'block' : 'none';
        }
    }

    updateMuteButton() {
        const iconMuted = this.muteBtn?.querySelector('.icon-muted');
        const iconUnmuted = this.muteBtn?.querySelector('.icon-unmuted');

        if (iconMuted && iconUnmuted) {
            iconMuted.style.display = this.newsVideo.muted ? 'block' : 'none';
            iconUnmuted.style.display = this.newsVideo.muted ? 'none' : 'block';
        }
    }

    showLoading() {
        this.loadingState.style.display = 'flex';
        this.newsContent.style.display = 'none';
        this.errorState.style.display = 'none';
        this.nextBtn.disabled = true;
    }

    hideLoading() {
        this.loadingState.style.display = 'none';
    }

    showError() {
        this.loadingState.style.display = 'none';
        this.newsContent.style.display = 'none';
        this.errorState.style.display = 'flex';
        this.nextBtn.disabled = true;
    }
}

// Global app instance
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new SeksenSaniyeApp();
});
