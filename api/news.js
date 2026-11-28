// Vercel Serverless Function for RSS News Feed
import { setApiSecurityHeaders } from '../lib/security.js';
import { getSharedTextCache, setSharedTextCache } from '../lib/sharedCache.js';

const MAX_RSS_BYTES = 1_500_000;
const MAX_ITEMS = 50;
const DAILY_NEWS_TTL_SECONDS = 24 * 60 * 60;
const dailyNewsMemoryCache = new Map();

const KST_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});

const getKstDateKey = (now = new Date()) => KST_DATE_FORMATTER.format(now);

export const decodeHtmlEntities = (value) => String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => {
        const num = Number(code);
        return Number.isFinite(num) && num >= 32 && num <= 0x10ffff ? String.fromCodePoint(num) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        const num = parseInt(hex, 16);
        return Number.isFinite(num) && num >= 32 && num <= 0x10ffff ? String.fromCodePoint(num) : '';
    })
    .replace(/\s+/g, ' ')
    .trim();

export default async function handler(req, res) {
    setApiSecurityHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { type } = req.query; // 'korean' or 'world'

        if (!type || (type !== 'korean' && type !== 'world')) {
            return res.status(400).json({ error: 'Invalid type. Use "korean" or "world"' });
        }

        // 같은 날(KST) 모든 사용자가 동일한 대표 기사를 공유해 후속 Gemini 요약 공용 캐시 히트율을 높입니다.
        const dailyCacheKey = `news:${type}:${getKstDateKey()}`;
        const memArticle = dailyNewsMemoryCache.get(dailyCacheKey);
        if (memArticle) {
            res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400');
            res.setHeader('X-News-Cache', 'HIT');
            return res.status(200).json({ article: memArticle });
        }

        const sharedArticle = await getSharedTextCache(dailyCacheKey);
        if (sharedArticle && typeof sharedArticle.title === 'string') {
            dailyNewsMemoryCache.set(dailyCacheKey, sharedArticle);
            res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400');
            res.setHeader('X-News-Cache', 'HIT-SHARED');
            return res.status(200).json({ article: sharedArticle });
        }

        // RSS 피드 URL 설정
        let rssUrl;
        if (type === 'korean') {
            // Google News 한국 뉴스 RSS
            rssUrl = 'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko';
        } else {
            // Google News 세계 뉴스 RSS (영어)
            rssUrl = 'https://news.google.com/rss?hl=en&gl=US&ceid=US:en';
        }

        // RSS 피드 가져오기
        const response = await fetch(rssUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(10_000)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!/xml|rss/i.test(contentType)) {
            throw new Error('Unexpected RSS content type');
        }

        const contentLength = Number(response.headers.get('content-length') || 0);
        if (Number.isFinite(contentLength) && contentLength > MAX_RSS_BYTES) {
            throw new Error('RSS response too large');
        }

        const xmlText = await response.text();
        if (xmlText.length > MAX_RSS_BYTES) {
            throw new Error('RSS response too large');
        }

        // XML 파싱 (간단한 정규식 기반 파싱)
        const items = [];
        const itemRegex = /<item>(.*?)<\/item>/gs;
        let match;

        while ((match = itemRegex.exec(xmlText)) !== null) {
            if (items.length >= MAX_ITEMS) break;
            const itemXml = match[1];

            const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/s);
            const linkMatch = itemXml.match(/<link>(.*?)<\/link>/s);
            const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/s);
            const descriptionMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/s);
            const sourceMatch = itemXml.match(/<source[^>]*>(.*?)<\/source>/s);

            if (titleMatch) {
                const rawTitle = (titleMatch[1] || titleMatch[2] || '').trim();
                const link = linkMatch ? linkMatch[1].trim() : '';
                const pubDate = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();
                const description = descriptionMatch ? (descriptionMatch[1] || descriptionMatch[2] || '').trim() : '';
                const rawSourceName = sourceMatch ? sourceMatch[1].trim() : (type === 'korean' ? 'Google News Korea' : 'Google News');

                // HTML 태그 제거 및 엔티티 디코딩
                const cleanDescription = decodeHtmlEntities(description.replace(/<[^>]*>/g, ' '));
                const cleanTitle = decodeHtmlEntities(rawTitle.replace(/<[^>]*>/g, ' '));
                const cleanSourceName = decodeHtmlEntities(rawSourceName.replace(/<[^>]*>/g, ' '));

                const safeLink = /^https?:\/\//i.test(link) ? link : '';
                items.push({
                    title: cleanTitle.slice(0, 300),
                    description: cleanDescription.slice(0, 2000),
                    url: safeLink,
                    publishedAt: pubDate,
                    source: {
                        name: (cleanSourceName || (type === 'korean' ? 'Google News Korea' : 'Google News')).slice(0, 120)
                    }
                });
            }
        }

        if (items.length === 0) {
            return res.status(404).json({ error: 'No news articles found' });
        }

        // RSS 상위 헤드라인 중 첫 기사를 일일 대표 기사로 선택하고 공유 캐시에 고정합니다.
        const selectedArticle = items[0];
        if (dailyNewsMemoryCache.size > 16) dailyNewsMemoryCache.clear();
        dailyNewsMemoryCache.set(dailyCacheKey, selectedArticle);
        void setSharedTextCache(dailyCacheKey, selectedArticle, DAILY_NEWS_TTL_SECONDS);

        // 같은 뉴스 요청은 CDN/브라우저에서 재사용해 함수 호출과 RSS 요청을 줄입니다.
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400');
        res.setHeader('X-News-Cache', 'MISS');
        res.status(200).json({ article: selectedArticle });

    } catch (error) {
        console.error('RSS News error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

