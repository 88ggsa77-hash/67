import type {
  BrowseResponse,
  ReaderBlock,
  SearchEngineId,
  SearchResponse,
  SearchResultItem,
} from '../types/browser.ts';
import {
  buildProxyUrl,
  decodeBingResultUrl,
  decodeDuckDuckGoResultUrl,
  extractDomain,
  isSafePublicHostname,
  SEARCH_ENGINES,
} from './browserLogic.ts';

const FETCH_TIMEOUT_MS = 10000;
const MAX_HTML_CHARS = 1_800_000;

const AD_DOMAIN_PATTERNS = [
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'googletagmanager.com',
  'google-analytics.com',
  'adnxs.com',
  'taboola.com',
  'outbrain.com',
  'criteo.com',
  'facebook.net',
  'scorecardresearch.com',
  'amazon-adsystem.com',
  'pubmatic.com',
  'rubiconproject.com',
  'adsafeprotected.com',
];

const AD_SELECTORS = [
  'ins.adsbygoogle',
  '[id^="google_ads_"]',
  '[id*="ad-slot"]',
  '[class*="ad-banner"]',
  '[class*="adsbox"]',
  '[class*="sponsored-"]',
  '[data-ad-slot]',
  'amp-ad',
];

function validatePublicHttpUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('الرابط المدخل غير صالح.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('يُسمح فقط ببروتوكول HTTP أو HTTPS.');
  }

  if (!isSafePublicHostname(parsed.hostname)) {
    throw new Error('تم حظر الوصول إلى هذا العنوان لأسباب أمنية.');
  }

  return parsed;
}

function resolveSafeUrl(raw: string | null | undefined, baseUrl: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('#')) return trimmed || null;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:text/html')
  ) {
    return null;
  }

  if (lower.startsWith('data:image/')) {
    return trimmed;
  }

  try {
    const resolved = new URL(trimmed, baseUrl);
    if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
      return resolved.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function isAdOrTrackerUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return AD_DOMAIN_PATTERNS.some((domain) => lower.includes(domain));
}

async function fetchThroughProxy(
  targetUrl: string,
  externalSignal?: AbortSignal,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<{ text: string; contentType: string; rawBytes: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw new DOMException('Aborted', 'AbortError');
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    const proxyUrl = buildProxyUrl(targetUrl);
    const res = await fetch(proxyUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 403 || res.status === 429) {
        throw new Error(
          `الموقع محمي ضد البوتات أو يتطلب تحقق JavaScript مباشر عبر المتصفح الأصلي (رمز الحالة ${res.status}).`
        );
      }
      throw new Error(`استجاب الموقع أو البروكسي برمز الحالة ${res.status}.`);
    }

    const contentType = res.headers.get('content-type') || 'text/html';
    const text = await res.text();
    const rawBytes = new TextEncoder().encode(text).byteLength;

    return {
      text: text.length > MAX_HTML_CHARS ? text.slice(0, MAX_HTML_CHARS) : text,
      contentType,
      rawBytes,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      if (externalSignal?.aborted) {
        throw err;
      }
      throw new Error('انتهت مهلة الاتصال بالموقع عبر البروكسي.');
    }
    if (
      err instanceof Error &&
      (err.message.startsWith('استجاب') || err.message.startsWith('الموقع محمي'))
    ) {
      throw err;
    }
    throw new Error('تعذر الوصول إلى الموقع عبر البروكسي الخارجي.');
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}

function extractReaderBlocks(
  doc: Document,
  finalUrl: string
): { blocks: ReaderBlock[]; readingMinutes: number } {
  const blocks: ReaderBlock[] = [];
  const root =
    doc.querySelector('article') ||
    doc.querySelector('main') ||
    doc.body;

  if (!root) {
    return { blocks, readingMinutes: 1 };
  }

  let wordCount = 0;
  const elements = root.querySelectorAll('h1, h2, h3, h4, p, blockquote, pre, ul, ol, img');

  for (const el of elements) {
    if (blocks.length >= 140) break;
    const tag = el.tagName.toLowerCase();

    if (tag === 'p' && el.closest('blockquote, li')) {
      continue;
    }

    if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length > 1) {
        wordCount += text.split(/\s+/).length;
        blocks.push({ type: 'heading', level: Number(tag[1]), text });
      }
      continue;
    }

    if (tag === 'p') {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length > 15) {
        wordCount += text.split(/\s+/).length;
        blocks.push({ type: 'paragraph', text });
      }
      continue;
    }

    if (tag === 'blockquote') {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length > 8) {
        wordCount += text.split(/\s+/).length;
        blocks.push({ type: 'quote', text });
      }
      continue;
    }

    if (tag === 'pre') {
      const text = (el.textContent || '').trim();
      if (text.length > 4) {
        blocks.push({ type: 'code', text: text.slice(0, 2000) });
      }
      continue;
    }

    if (tag === 'ul' || tag === 'ol') {
      const items: string[] = [];
      for (const child of Array.from(el.children)) {
        if (child.tagName.toLowerCase() === 'li') {
          const liText = (child.textContent || '').replace(/\s+/g, ' ').trim();
          if (liText.length > 1 && items.length < 25) {
            wordCount += liText.split(/\s+/).length;
            items.push(liText);
          }
        }
      }
      if (items.length > 0) {
        blocks.push({ type: 'list', items });
      }
      continue;
    }

    if (tag === 'img') {
      const rawSrc = el.getAttribute('src') || el.getAttribute('data-src');
      const src = resolveSafeUrl(rawSrc, finalUrl);
      const alt = (el.getAttribute('alt') || '').trim();
      if (src && !isAdOrTrackerUrl(src)) {
        blocks.push({ type: 'image', src, alt });
      }
    }
  }

  const readingMinutes = Math.max(1, Math.round(wordCount / 180));
  return { blocks, readingMinutes };
}

export async function browsePageViaProxy(options: {
  url: string;
  adBlock: boolean;
  noImages: boolean;
  darkMode: boolean;
  signal?: AbortSignal;
}): Promise<BrowseResponse> {
  const parsed = validatePublicHttpUrl(options.url);
  const targetUrl = parsed.toString();

  const { text, contentType, rawBytes } = await fetchThroughProxy(
    targetUrl,
    options.signal
  );

  // Plain text or JSON handling
  if (!contentType.includes('html') && !contentType.includes('xml')) {
    const escaped = text
      .slice(0, 50000)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const title = extractDomain(targetUrl);
    return {
      ok: true,
      url: options.url,
      finalUrl: targetUrl,
      title,
      description: contentType,
      favicon: '',
      blockedCount: 0,
      rawBytes,
      savedBytes: 0,
      sanitizedHtml: `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';"><style>body{font-family:monospace;padding:24px;white-space:pre-wrap;word-break:break-word;background:${options.darkMode ? '#0d1117' : '#ffffff'};color:${options.darkMode ? '#e2e8f0' : '#0f172a'};}</style></head><body>${escaped}</body></html>`,
      rawHtmlPreview: text.slice(0, 12000),
      readerBlocks: [{ type: 'code', text: text.slice(0, 12000) }],
      readingMinutes: 1,
    };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');

  // If the proxy injected a <base href="...">, use it as base URL for relative assets
  const injectedBaseHref = doc.querySelector('base')?.getAttribute('href');
  const finalUrl = resolveSafeUrl(injectedBaseHref, targetUrl) || targetUrl;

  let blockedCount = 0;
  let savedBytes = 0;

  const title =
    (doc.querySelector('title')?.textContent || '').replace(/\s+/g, ' ').trim() ||
    extractDomain(finalUrl);
  const description =
    doc.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ||
    doc.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() ||
    '';

  const rawFavicon =
    doc.querySelector('link[rel="icon"]')?.getAttribute('href') ||
    doc.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ||
    '/favicon.ico';
  const favicon = resolveSafeUrl(rawFavicon, finalUrl) || '';

  // Remove dangerous active elements & tracking scripts
  doc
    .querySelectorAll('script, object, embed, applet, base, meta[http-equiv="refresh"]')
    .forEach((el) => {
      const src = el.getAttribute('src') || '';
      if (
        el.tagName.toLowerCase() === 'script' &&
        options.adBlock &&
        (isAdOrTrackerUrl(src) || !src)
      ) {
        blockedCount += 1;
        savedBytes += 4200;
      }
      el.remove();
    });

  // Remove iframes
  doc.querySelectorAll('iframe').forEach((el) => {
    const src = el.getAttribute('src') || '';
    if (options.adBlock && isAdOrTrackerUrl(src)) {
      blockedCount += 1;
      savedBytes += 12000;
    }
    el.remove();
  });

  // Remove ad containers when adBlock is enabled
  if (options.adBlock) {
    for (const selector of AD_SELECTORS) {
      doc.querySelectorAll(selector).forEach((el) => {
        blockedCount += 1;
        savedBytes += 6500;
        el.remove();
      });
    }
    doc.querySelectorAll('img, a').forEach((el) => {
      const href = el.getAttribute('href') || el.getAttribute('src') || '';
      if (href && isAdOrTrackerUrl(href)) {
        blockedCount += 1;
        savedBytes += 3500;
        el.remove();
      }
    });
  }

  // Extract Reader Mode blocks before stripping images
  const { blocks: readerBlocks, readingMinutes } = extractReaderBlocks(doc, finalUrl);

  // Strip images in noImages (Lite mode)
  if (options.noImages) {
    const imgCount = doc.querySelectorAll('img, picture, source, svg').length;
    savedBytes += imgCount * 24000;
    doc.querySelectorAll('img, picture, source').forEach((el) => el.remove());
  }

  // Strip inline event handlers and safely resolve URLs
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const lowerAttr = attr.name.toLowerCase();
      if (lowerAttr.startsWith('on') || lowerAttr === 'srcdoc') {
        el.removeAttribute(attr.name);
        continue;
      }

      if (
        lowerAttr === 'href' ||
        lowerAttr === 'src' ||
        lowerAttr === 'action' ||
        lowerAttr === 'poster'
      ) {
        const resolved = resolveSafeUrl(attr.value, finalUrl);
        if (!resolved) {
          el.removeAttribute(attr.name);
        } else {
          el.setAttribute(attr.name, resolved);
        }
      }
    }
  });

  // Remove any origin CSP meta tags so ours governs cleanly
  doc.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').forEach((el) => el.remove());

  const head = doc.head || doc.querySelector('head') || doc.documentElement;
  if (head) {
    const cspMeta = doc.createElement('meta');
    cspMeta.setAttribute('http-equiv', 'Content-Security-Policy');
    cspMeta.setAttribute(
      'content',
      "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline' https: http:; font-src https: http: data:; media-src https: http:;"
    );

    const baseStyle = doc.createElement('style');
    baseStyle.textContent = `
      html { max-width: 100%; overflow-x: hidden; }
      body { margin: 0 auto; padding: 16px; max-width: 100%; overflow-x: hidden; line-height: 1.65; }
      img, video, table { max-width: 100% !important; height: auto !important; }
      ${
        options.darkMode
          ? `html, body { background-color: #0d1117 !important; color: #e2e8f0 !important; }
             a { color: #60a5fa !important; }
             div, section, article, main, header, nav, aside, table, td, th { background-color: transparent !important; color: inherit !important; border-color: #30363d !important; }`
          : ''
      }
    `;

    head.prepend(baseStyle);
    head.prepend(cspMeta);
  }

  return {
    ok: true,
    url: options.url,
    finalUrl,
    title,
    description,
    favicon,
    blockedCount,
    rawBytes,
    savedBytes,
    sanitizedHtml: `<!doctype html>\n${doc.documentElement.outerHTML}`,
    rawHtmlPreview: text.slice(0, 15000),
    readerBlocks: options.noImages
      ? readerBlocks.filter((b) => b.type !== 'image')
      : readerBlocks,
    readingMinutes,
  };
}

async function searchWikipediaViaProxy(
  query: string,
  signal?: AbortSignal
): Promise<SearchResultItem[]> {
  const wikiUrl = `https://ar.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=1&format=json&srlimit=10`;
  const { text } = await fetchThroughProxy(wikiUrl, signal, 6000);
  const data = JSON.parse(text) as {
    query?: { search?: Array<{ title: string; snippet: string }> };
  };
  const items = data.query?.search ?? [];
  const parser = new DOMParser();

  return items.map((item) => {
    const url = `https://ar.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;
    const snippetDoc = parser.parseFromString(item.snippet, 'text/html');
    const cleanSnippet = (snippetDoc.body.textContent || '').replace(/\s+/g, ' ').trim();
    return {
      title: item.title,
      url,
      domain: 'ar.wikipedia.org',
      snippet: cleanSnippet,
    };
  });
}

async function searchBingViaProxy(
  query: string,
  signal?: AbortSignal
): Promise<SearchResultItem[]> {
  const bingUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const { text } = await fetchThroughProxy(bingUrl, signal, 6500);
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const results: SearchResultItem[] = [];

  doc.querySelectorAll('li.b_algo').forEach((el) => {
    if (results.length >= 12) return;
    const link = el.querySelector('h2 a');
    if (!link) return;
    const title = (link.textContent || '').replace(/\s+/g, ' ').trim();
    const rawHref = link.getAttribute('href') || '';
    const decodedUrl = decodeBingResultUrl(rawHref);
    const snippet = (
      el.querySelector('.b_caption p, .b_lineclamp2, .b_snippet')?.textContent || ''
    )
      .replace(/\s+/g, ' ')
      .trim();

    if (title && (decodedUrl.startsWith('https://') || decodedUrl.startsWith('http://'))) {
      results.push({
        title,
        url: decodedUrl,
        domain: extractDomain(decodedUrl),
        snippet,
      });
    }
  });

  return results;
}

async function searchDuckDuckGoViaProxy(
  query: string,
  signal?: AbortSignal
): Promise<SearchResultItem[]> {
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const { text } = await fetchThroughProxy(ddgUrl, signal, 4000);
  const doc = new DOMParser().parseFromString(text, 'text/html');
  const results: SearchResultItem[] = [];

  doc.querySelectorAll('.result').forEach((el) => {
    if (results.length >= 12) return;
    const link = el.querySelector('a.result__a');
    if (!link) return;
    const title = (link.textContent || '').replace(/\s+/g, ' ').trim();
    const href = decodeDuckDuckGoResultUrl(link.getAttribute('href') || '');
    const snippet = (el.querySelector('.result__snippet')?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();

    if (title && (href.startsWith('https://') || href.startsWith('http://'))) {
      results.push({
        title,
        url: href,
        domain: extractDomain(href),
        snippet,
      });
    }
  });

  return results;
}

export async function searchWebViaProxy(
  query: string,
  engine: SearchEngineId,
  signal?: AbortSignal
): Promise<SearchResponse> {
  const cleanQuery = query.trim();
  const externalSearchUrl = SEARCH_ENGINES[engine].searchUrl(cleanQuery);

  if (!cleanQuery) {
    return {
      ok: true,
      query: '',
      engine,
      results: [],
      externalSearchUrl,
    };
  }

  // 1. Wikipedia dedicated engine
  if (engine === 'wikipedia') {
    try {
      const results = await searchWikipediaViaProxy(cleanQuery, signal);
      return {
        ok: true,
        query: cleanQuery,
        engine,
        results,
        externalSearchUrl,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError' && signal?.aborted) {
        throw err;
      }
    }
  }

  // 2. Bing dedicated engine
  if (engine === 'bing') {
    try {
      const results = await searchBingViaProxy(cleanQuery, signal);
      if (results.length > 0) {
        return {
          ok: true,
          query: cleanQuery,
          engine,
          results,
          externalSearchUrl,
        };
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError' && signal?.aborted) {
        throw err;
      }
    }
  }

  // 3. DuckDuckGo (with fast Bing & Wikipedia fallback via proxy if DDG times out)
  if (engine === 'duckduckgo') {
    try {
      const ddgResults = await searchDuckDuckGoViaProxy(cleanQuery, signal);
      if (ddgResults.length > 0) {
        return {
          ok: true,
          query: cleanQuery,
          engine,
          results: ddgResults,
          externalSearchUrl,
        };
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError' && signal?.aborted) {
        throw err;
      }
    }
  }

  // 4. Google or fallback -> try Bing via proxy, then Wikipedia via proxy
  try {
    const bingResults = await searchBingViaProxy(cleanQuery, signal);
    if (bingResults.length > 0) {
      return {
        ok: true,
        query: cleanQuery,
        engine,
        results: bingResults,
        externalSearchUrl,
      };
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError' && signal?.aborted) {
      throw err;
    }
  }

  try {
    const wikiResults = await searchWikipediaViaProxy(cleanQuery, signal);
    if (wikiResults.length > 0) {
      return {
        ok: true,
        query: cleanQuery,
        engine,
        results: wikiResults,
        externalSearchUrl,
      };
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError' && signal?.aborted) {
      throw err;
    }
  }

  return {
    ok: false,
    query: cleanQuery,
    engine,
    results: [],
    externalSearchUrl,
    offlineFallback: true,
    error: 'تعذر جلب نتائج البحث عبر البروكسي في الوقت الحالي. يمكنك المحاولة مرة أخرى أو فتح رابط البحث.',
  };
}
