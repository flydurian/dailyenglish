// Vercel Serverless Function for RSS News Feed
import { setApiSecurityHeaders } from '../lib/security.js';
const MAX_RSS_BYTES = 1_500_000;
const MAX_ITEMS = 50;

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
            const sourceMatch = itemXml.match(/<source url="(.*?)">(.*?)<\/source>/s);
            
            if (titleMatch) {
                const title = (titleMatch[1] || titleMatch[2] || '').trim();
                const link = linkMatch ? linkMatch[1].trim() : '';
                const pubDate = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();
                const description = descriptionMatch ? (descriptionMatch[1] || descriptionMatch[2] || '').trim() : '';
                const sourceName = sourceMatch ? sourceMatch[2].trim() : (type === 'korean' ? 'Google News Korea' : 'Google News');
                
                // HTML 태그 제거
                const cleanDescription = description
                    .replace(/<[^>]*>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .trim();
                
                const safeLink = /^https?:\/\//i.test(link) ? link : '';
                items.push({
                    title: title.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').slice(0, 300),
                    description: cleanDescription.slice(0, 2000),
                    url: safeLink,
                    publishedAt: pubDate,
                    source: {
                        name: sourceName.slice(0, 120)
                    }
                });
            }
        }

        if (items.length === 0) {
            return res.status(404).json({ error: 'No news articles found' });
        }

        // 랜덤하게 하나 선택
        const randomArticle = items[Math.floor(Math.random() * items.length)];

        // 같은 뉴스 요청은 CDN/브라우저에서 재사용해 함수 호출과 RSS 요청을 줄입니다.
        res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400');
        res.status(200).json({ article: randomArticle });
        
    } catch (error) {
        console.error('RSS News error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

