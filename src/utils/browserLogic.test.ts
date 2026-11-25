import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROXY_BASE_URL,
  buildProxyUrl,
  decodeBingResultUrl,
  decodeDuckDuckGoResultUrl,
  normalizeInputToTarget,
  extractDomain,
  formatBytes,
  isPrivateOrReservedIp,
  isSafePublicHostname,
  createBrowserTab,
  pushTabNavigation,
  canTabGoBack,
  canTabGoForward,
  stepTabBack,
  stepTabForward,
  removeTabAndSelectNext,
  getOmniboxSuggestions,
} from './browserLogic';

test('buildProxyUrl encodes target URL onto the external Cloudflare Worker proxy', () => {
  const url = 'https://example.com/search?q=hello world&lang=ar';
  const proxied = buildProxyUrl(url);
  assert.equal(proxied, `${PROXY_BASE_URL}${encodeURIComponent(url)}`);
  assert.ok(proxied.startsWith('https://aged-bonus-7a0e.88ggsa77.workers.dev/?url='));
});

test('decodeBingResultUrl and decodeDuckDuckGoResultUrl unwrap redirect links', () => {
  const bingHref =
    'https://www.bing.com/ck/a?!&&p=123&u=a1aHR0cHM6Ly93d3cud2lraXBlZGlhLm9yZy8&ntb=1';
  assert.equal(decodeBingResultUrl(bingHref), 'https://www.wikipedia.org/');
  assert.equal(decodeBingResultUrl('https://example.com/direct'), 'https://example.com/direct');

  const ddgHref = 'https://html.duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.org%2Fpage';
  assert.equal(decodeDuckDuckGoResultUrl(ddgHref), 'https://example.org/page');
});

test('normalizeInputToTarget classifies home, URLs, domains, and search queries', () => {
  assert.deepEqual(normalizeInputToTarget(''), {
    type: 'internal',
    url: 'via://home',
    displayUrl: '',
  });

  const direct = normalizeInputToTarget('https://ar.wikipedia.org/wiki/الويب');
  assert.equal(direct.type, 'url');
  assert.ok(direct.url.startsWith('https://ar.wikipedia.org/'));

  const bareDomain = normalizeInputToTarget('example.com/docs');
  assert.equal(bareDomain.type, 'url');
  assert.equal(bareDomain.url, 'https://example.com/docs');

  const query = normalizeInputToTarget('متصفح سريع وخفيف');
  assert.equal(query.type, 'search');
  assert.equal(query.query, 'متصفح سريع وخفيف');
  assert.ok(query.url.startsWith('via://search?q='));

  const xssAttempt = normalizeInputToTarget('javascript:alert(1)');
  assert.equal(xssAttempt.type, 'search');
});

test('SSRF validators reject loopback, private, metadata, and link-local addresses', () => {
  assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('10.20.30.40'), true);
  assert.equal(isPrivateOrReservedIp('172.16.5.4'), true);
  assert.equal(isPrivateOrReservedIp('192.168.1.1'), true);
  assert.equal(isPrivateOrReservedIp('169.254.169.254'), true);
  assert.equal(isPrivateOrReservedIp('::1'), true);
  assert.equal(isPrivateOrReservedIp('::ffff:127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('fe80::1'), true);
  assert.equal(isPrivateOrReservedIp('fc00::1'), true);

  assert.equal(isPrivateOrReservedIp('93.184.216.34'), false);
  assert.equal(isPrivateOrReservedIp('1.1.1.1'), false);

  assert.equal(isSafePublicHostname('localhost'), false);
  assert.equal(isSafePublicHostname('api.internal'), false);
  assert.equal(isSafePublicHostname('127.0.0.1'), false);
  assert.equal(isSafePublicHostname('ar.wikipedia.org'), true);
});

test('extractDomain and formatBytes format values cleanly', () => {
  assert.equal(extractDomain('https://www.example.com/path'), 'example.com');
  assert.equal(extractDomain('via://home'), 'فيا ويب');
  assert.equal(formatBytes(512), '512 ب');
  assert.equal(formatBytes(2048), '2.0 ك.ب');
});

test('tab history stack supports push, back, forward, and branch truncation', () => {
  let tab = createBrowserTab({ id: 't1' });
  assert.equal(canTabGoBack(tab), false);
  assert.equal(canTabGoForward(tab), false);

  tab = pushTabNavigation(tab, 'https://example.com', 'Example');
  tab = pushTabNavigation(tab, 'https://ar.wikipedia.org', 'ويكيبيديا');
  assert.equal(canTabGoBack(tab), true);
  assert.equal(canTabGoForward(tab), false);

  tab = stepTabBack(tab);
  assert.equal(tab.url, 'https://example.com');
  assert.equal(canTabGoForward(tab), true);

  tab = pushTabNavigation(tab, 'https://news.ycombinator.com', 'HN');
  assert.equal(canTabGoForward(tab), false);
  assert.deepEqual(tab.historyStack, [
    'via://home',
    'https://example.com',
    'https://news.ycombinator.com',
  ]);

  tab = stepTabBack(tab);
  tab = stepTabForward(tab);
  assert.equal(tab.url, 'https://news.ycombinator.com');
});

test('removeTabAndSelectNext handles active tab replacement and last tab fallback', () => {
  const t1 = createBrowserTab({ id: 't1' });
  const t2 = createBrowserTab({ id: 't2', url: 'https://example.com' });

  const afterClose = removeTabAndSelectNext([t1, t2], 't2', 't2', () => 't3');
  assert.equal(afterClose.tabs.length, 1);
  assert.equal(afterClose.activeTabId, 't1');

  const afterLast = removeTabAndSelectNext([t1], 't1', 't1', () => 't-new');
  assert.equal(afterLast.tabs.length, 1);
  assert.equal(afterLast.tabs[0].id, 't-new');
  assert.equal(afterLast.activeTabId, 't-new');
});

test('getOmniboxSuggestions prioritizes bookmarks without duplicates', () => {
  const suggestions = getOmniboxSuggestions(
    'wiki',
    [
      {
        id: 'b1',
        title: 'Wikipedia Arabic',
        url: 'https://ar.wikipedia.org',
        domain: 'ar.wikipedia.org',
        createdAt: 100,
      },
    ],
    [
      {
        id: 'h1',
        title: 'Wikipedia Arabic',
        url: 'https://ar.wikipedia.org',
        domain: 'ar.wikipedia.org',
        visitedAt: 200,
      },
      {
        id: 'h2',
        title: 'WikiHow',
        url: 'https://www.wikihow.com',
        domain: 'wikihow.com',
        visitedAt: 150,
      },
    ]
  );

  assert.equal(suggestions.length, 2);
  assert.equal(suggestions[0].source, 'bookmark');
  assert.equal(suggestions[1].source, 'history');
});
