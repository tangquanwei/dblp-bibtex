// 在 dblp.org 页面里执行：同源 fetch 会带上浏览器已经通过 Anubis 校验的 cookie。
// 页面还停在挑战页时，接口会返回 202 或挑战 HTML，调用方会重试。

function decodeEntities(text) {
  const area = document.createElement('textarea');
  area.innerHTML = text;
  return area.value;
}

function mapHit(hit) {
  const info = (hit && hit.info) || {};
  const raw = info.authors && info.authors.author;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const authors = list.map((a) => (typeof a === 'string' ? a : a && a.text) || '').filter(Boolean);
  const url = info.url || '';
  const key = info.key || (/\/rec\/(.+)\.html$/.exec(url) || [])[1] || '';
  return {
    title: decodeEntities(String(info.title || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim(),
    authors,
    venue: info.venue || '',
    year: info.year || '',
    type: info.type || '',
    pages: info.pages || '',
    doi: info.doi || '',
    key,
    url,
    bibUrl: key ? `https://dblp.org/rec/${key}.bib?param=1` : '',
  };
}

function isChallenge(status, text) {
  return status === 202 || /not a bot|Oh noes!/i.test(text.slice(0, 400));
}

async function search(q) {
  const url = `https://dblp.org/search/publ/api?q=${encodeURIComponent(q)}&format=json&h=12`;
  const res = await fetch(url, { credentials: 'include', headers: { accept: 'application/json' } });
  const text = await res.text();
  if (isChallenge(res.status, text)) return { ok: false, status: 202 };
  if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, status: res.status, error: '非 JSON 响应' };
  }
  const hits = (body && body.result && body.result.hits) || {};
  const list = hits.hit || [];
  return {
    ok: true,
    status: 200,
    total: Number(hits['@total'] || list.length),
    results: list.map(mapHit),
  };
}

async function bib(url) {
  if (!/^https:\/\/dblp\.org\/rec\//.test(url)) return { ok: false, error: '不是 DBLP 记录地址' };
  const res = await fetch(url, { credentials: 'include' });
  const text = await res.text();
  if (isChallenge(res.status, text)) return { ok: false, status: 202 };
  if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
  const trimmed = text.trim();
  if (!/^@\w+\s*[{(]/.test(trimmed)) return { ok: false, error: '返回的不是 BibTeX' };
  return { ok: true, status: 200, bibtex: trimmed };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return false;
  if (msg.type === 'ping') {
    sendResponse({ ok: true, href: location.href });
    return false;
  }
  if (msg.type === 'search') {
    search(msg.q).then(sendResponse, (err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (msg.type === 'bib') {
    bib(msg.url).then(sendResponse, (err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  return false;
});
