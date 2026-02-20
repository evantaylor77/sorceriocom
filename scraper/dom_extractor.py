"""
DOM extraction utilities for 60Saniye tweet scraper.
Handles extracting tweet data from Twitter DOM using JavaScript.
Enhanced with direct video URL extraction.
"""

import json
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)


def build_extraction_script(profile: str) -> str:
    """
    Build JavaScript script to extract tweets from DOM.
    Enhanced with direct video URL extraction.

    Args:
        profile: Twitter profile username

    Returns:
        JavaScript code as string
    """
    encoded_profile = json.dumps(profile)

    script = f"""
    var results = [];
    var articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
    if (articles.length === 0) {{
        articles = Array.from(document.querySelectorAll('article'));
    }}

    for (var index = 0; index < articles.length; index++) {{
        try {{
            var article = articles[index];

            // Skip quoted tweets
            var allElements = Array.from(article.querySelectorAll('*'));
            var hasQuotedTweet = false;
            for (var q = 0; q < allElements.length; q++) {{
                var el = allElements[q];
                var text = (el.textContent || '').trim();
                if (text === 'Quote') {{
                    hasQuotedTweet = true;
                    break;
                }}
            }}
            if (hasQuotedTweet) {{
                continue;
            }}

            // Extract tweet text
            var textNode = article.querySelector('[data-testid="tweetText"]') ||
                           article.querySelector('[lang]') ||
                           article.querySelector('div[dir="auto"]') ||
                           article.querySelector('span');

            // Extract timestamp
            var timeNode = article.querySelector('time') || article.querySelector('[datetime]');
            var time = timeNode ? (timeNode.getAttribute('datetime') || '') : '';

            // Extract tweet ID from URL
            var tweetId = null;
            var timeEl = article.querySelector('a[href*="/status/"] time') || article.querySelector('time');
            if (timeEl) {{
                var timeAnchor = timeEl.closest('a[href*="/status/"]');
                if (timeAnchor) {{
                    var href = timeAnchor.getAttribute('href');
                    var match = href && href.match(/\\/status\\/(\\d+)/);
                    if (match) tweetId = match[1];
                }}
            }}

            if (!tweetId) {{
                var linkNode = article.querySelector('a[href*="/status/"]');
                if (linkNode) {{
                    var href = linkNode.getAttribute('href');
                    var match = href && href.match(/\\/status\\/(\\d+)/);
                    if (match) tweetId = match[1];
                }}
            }}

            if (!tweetId) {{
                tweetId = 'tweet_' + index + '_' + Date.now();
            }}

            // Extract media with ENHANCED video URL detection
            var media = [];
            var anchorSelector = ':scope a[href*="/status/' + tweetId + '/photo/"]';
            var anchors = article.querySelectorAll(anchorSelector);

            for (var a = 0; a < anchors.length; a++) {{
                var anchor = anchors[a];
                var nearestArticle = anchor.closest('article');
                if (nearestArticle && nearestArticle !== article) continue;

                // Extract images
                var img = anchor.querySelector('img[src*="pbs.twimg.com/media"]');
                if (img) {{
                    var src = img.getAttribute('src');
                    if (src && src.indexOf('profile_images') === -1 && src.indexOf('default_profile') === -1) {{
                        media.push({{ type: 'image', src: src }});
                    }}
                }}
            }}

            // ENHANCED: Extract tweet URL for Twitter embed
            var tweetUrl = '';
            var statusLink = article.querySelector('a[href*="/status/"]');
            if (statusLink) {{
                var href = statusLink.getAttribute('href');
                if (href.indexOf('/') === 0) {{
                    tweetUrl = 'https://x.com' + href;
                }} else {{
                    tweetUrl = href;
                }}
            }}

            // Store tweet URL for embed
            if (tweetUrl) {{
                media.push({{ type: 'tweet_url', url: tweetUrl }});
            }}

            // Detect video presence
            var hasVideo = false;
            if (article.querySelector('video') !== null) {{
                hasVideo = true;
            }}
            if (!hasVideo) {{
                var ariaLabels = article.querySelectorAll('[aria-label]');
                for (var al = 0; al < ariaLabels.length; al++) {{
                    var label = ariaLabels[al].getAttribute('aria-label');
                    if (label && label.toLowerCase().indexOf('embedded video') !== -1) {{
                        hasVideo = true;
                        break;
                    }}
                }}
            }}
            if (!hasVideo) {{
                var videoLinks = article.querySelectorAll('a[href*="/video/"]');
                if (videoLinks.length > 0) {{
                    hasVideo = true;
                }}
            }}

            // Detect image presence
            var hasImage = false;
            if (article.querySelector('a[href*="/photo/"]') !== null) {{
                hasImage = true;
            }}
            if (!hasImage && media.length > 0) {{
                for (var m = 0; m < media.length; m++) {{
                    if (media[m].type === 'image') {{
                        hasImage = true;
                        break;
                    }}
                }}
            }}

            // Extract text with line break preservation
            var text = '';
            if (textNode) {{
                function extractTextWithLineBreaks(node) {{
                    if (!node) return '';
                    var result = '';
                    var childNodes = node.childNodes;
                    for (var i = 0; i < childNodes.length; i++) {{
                        var child = childNodes[i];
                        if (child.nodeType === 3) {{
                            result += child.textContent || child.nodeValue || '';
                        }} else if (child.nodeType === 1) {{
                            var tagName = child.tagName ? child.tagName.toLowerCase() : '';
                            if (tagName === 'br') {{
                                result += '\\n';
                            }} else if (['p', 'div', 'li'].indexOf(tagName) !== -1) {{
                                var childText = extractTextWithLineBreaks(child);
                                if (childText) {{
                                    if (result && result[result.length - 1] !== '\\n') {{
                                        result += '\\n';
                                    }}
                                    result += childText;
                                    if (i < childNodes.length - 1) {{
                                        result += '\\n';
                                    }}
                                }}
                            }} else {{
                                result += extractTextWithLineBreaks(child);
                            }}
                        }}
                    }}
                    return result;
                }}
                text = extractTextWithLineBreaks(textNode).trim();
            }}

            if (text || media.length > 0) {{
                var tweetObj = {{
                    id: tweetId,
                    text: text,
                    time: time || new Date().toISOString(),
                    media: media,
                    engagement: {{}},
                    profile: {encoded_profile},
                    index: index
                }};

                if (hasVideo) {{
                    tweetObj.video = true;
                }}
                if (hasImage) {{
                    tweetObj.image = true;
                }}

                results.push(tweetObj);
            }}
        }} catch (err) {{
            console.error('Error extracting tweet:', err);
        }}
    }}

    return results;
    """
    return script


def build_fallback_extraction_script(profile: str) -> str:
    """
    Build fallback JavaScript script for tweet extraction (ES5 compatible).

    Args:
        profile: Twitter profile username

    Returns:
        JavaScript code as string
    """
    encoded_profile = json.dumps(profile)

    script = f"""
    var results = [];
    var articles = document.querySelectorAll('article[data-testid="tweet"], article');
    for (var i = 0; i < articles.length; i++) {{
        try {{
            var article = articles[i];

            // Skip quoted tweets
            var allElements = Array.from(article.querySelectorAll('*'));
            var hasQuotedTweet = false;
            for (var q = 0; q < allElements.length; q++) {{
                var el = allElements[q];
                var text = (el.textContent || '').trim();
                if (text === 'Quote') {{
                    hasQuotedTweet = true;
                    break;
                }}
            }}
            if (hasQuotedTweet) {{
                continue;
            }}

            var textEl = article.querySelector('[data-testid="tweetText"]') ||
                         article.querySelector('[lang]') ||
                         article.querySelector('div[dir="auto"]');

            // Extract text with line breaks
            var text = '';
            if (textEl) {{
                function extractTextWithLineBreaks(node) {{
                    if (!node) return '';
                    var result = '';
                    var childNodes = node.childNodes;
                    for (var i = 0; i < childNodes.length; i++) {{
                        var child = childNodes[i];
                        if (child.nodeType === 3) {{
                            result += child.textContent || child.nodeValue || '';
                        }} else if (child.nodeType === 1) {{
                            var tagName = child.tagName ? child.tagName.toLowerCase() : '';
                            if (tagName === 'br') {{
                                result += '\\n';
                            }} else if (['p', 'div', 'li'].indexOf(tagName) !== -1) {{
                                var childText = extractTextWithLineBreaks(child);
                                if (childText) {{
                                    if (result && result[result.length - 1] !== '\\n') {{
                                        result += '\\n';
                                    }}
                                    result += childText;
                                    if (i < childNodes.length - 1) {{
                                        result += '\\n';
                                    }}
                                }}
                            }} else {{
                                result += extractTextWithLineBreaks(child);
                            }}
                        }}
                    }}
                    return result;
                }}
                text = extractTextWithLineBreaks(textEl).trim();
            }}

            var timeEl = article.querySelector('time');
            var time = timeEl ? (timeEl.getAttribute('datetime') || '') : '';
            var linkEl = article.querySelector('a[href*="/status/"]');
            var tweetId = 'unknown_' + i;
            if (linkEl) {{
                var href = linkEl.getAttribute('href');
                var match = href && href.match(/\\/status\\/(\\d+)/);
                if (match) tweetId = match[1];
            }}

            // Extract tweet URL for Twitter embed
            var media = [];
            var statusLink = article.querySelector('a[href*="/status/"]');
            if (statusLink) {{
                var href = statusLink.getAttribute('href');
                var tweetUrl = '';
                if (href.indexOf('/') === 0) {{
                    tweetUrl = 'https://x.com' + href;
                }} else {{
                    tweetUrl = href;
                }}
                if (tweetUrl) {{
                    media.push({{ type: 'tweet_url', url: tweetUrl }});
                }}
            }}

            // Detect video
            var hasVideo = false;
            if (article.querySelector('video') !== null) {{
                hasVideo = true;
            }} else {{
                var ariaLabels = article.querySelectorAll('[aria-label]');
                for (var al = 0; al < ariaLabels.length; al++) {{
                    var label = ariaLabels[al].getAttribute('aria-label');
                    if (label && label.toLowerCase().indexOf('embedded video') !== -1) {{
                        hasVideo = true;
                        break;
                    }}
                }}
            }}

            // Detect image
            var hasImage = false;
            if (article.querySelector('a[href*="/photo/"]') !== null) {{
                hasImage = true;
            }}

            if (text) {{
                var tweetObj = {{
                    id: tweetId,
                    text: text,
                    time: time || new Date().toISOString(),
                    media: media,
                    engagement: {{}},
                    profile: {encoded_profile},
                    index: i
                }};

                if (hasVideo) {{
                    tweetObj.video = true;
                }}
                if (hasImage) {{
                    tweetObj.image = true;
                }}

                results.push(tweetObj);
            }}
        }} catch(e) {{
            console.error('Error in fallback:', e);
        }}
    }}
    return results;
    """
    return script
