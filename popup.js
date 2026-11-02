const form = document.getElementById('search-form');
const input = document.getElementById('q');
const searchBtn = document.getElementById('search-btn');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const toastEl = document.getElementById('toast');
const closeTabBtn = document.getElementById('close-tab');

let timers = [];

function setStatus(text, kind) {
  statusEl.textContent = text || '';
  statusEl.dataset.kind = kind || '';
}

function schedule(fn, ms) {
  timers.push(setTimeout(fn, ms));
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toastEl.classList.remove('show'), 1600);
}

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function badge(text, variant) {
  return node('span', `badge ${variant || ''}`.trim(), text);
}

function send(msg, timeout = 90000) {
  return Promise.race([
    chrome.runtime.sendMessage(msg),
    new Promise((_, reject) => setTimeout(() => reject(new Error('后台响应超时')), timeout)),
  ]);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

function titleFromBib(bib) {
  const start = /\btitle\s*=\s*\{/i.exec(bib);
  if (!start) return '';
  let depth = 1;
  let out = '';
  for (let i = start.index + start[0].length; i < bib.length; i += 1) {
    const ch = bib[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
    out += ch;
  }
  return out.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
}

function errorText(res) {
  if (res.code === 'challenge-timeout') {
    return 'DBLP 的人机校验没有在限定时间内完成。点下面按钮打开那个标签页，手动过一下校验，再回来重试。';
  }
  if (res.code === 'no-content-script') {
    return '连不上 DBLP 页面（内容脚本未就绪）。点下面按钮打开标签页看看。';
  }
  if (res.status === 403) return 'DBLP 拒绝了请求（403）。';
  return `请求失败：${res.error || res.code || '未知错误'}`;
}

function showError(res) {
  setStatus('失败', 'error');
  const box = node('div', 'error');
  box.append(node('p', '', errorText(res)));
  const btn = node('button', 'btn primary', '打开 DBLP 标签页');
  btn.type = 'button';
  btn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'openTab' });
  });
  box.append(btn);
  resultsEl.replaceChildren(box);
}

function createCard(item, autoLoad) {
  const card = node('article', 'card');
  const titleEl = node('h2', 'title', item.title || 'DBLP 记录');
  card.append(titleEl);

  const bits = [];
  if (item.authors && item.authors.length) bits.push(item.authors.join(', '));
  if (item.venue) bits.push(item.venue);
  if (item.year) bits.push(String(item.year));
  if (bits.length) card.append(node('p', 'meta', bits.join(' · ')));

  const badges = node('div', 'badges');
  badges.append(badge('DBLP', 'ok'));
  if (item.type) badges.append(badge(item.type, ''));
  if (item.pages) badges.append(badge(item.pages, ''));
  card.append(badges);

  const actions = node('div', 'actions');
  const toggle = node('button', 'btn primary', '获取 BibTeX');
  toggle.type = 'button';
  actions.append(toggle);
  if (item.url) {
    const link = node('a', 'link', '打开 DBLP 记录');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noreferrer noopener';
    actions.append(link);
  }
  card.append(actions);

  const panel = node('div', 'bib');
  panel.hidden = true;
  const head = node('div', 'bib-head');
  const source = node('span', 'source', 'DBLP 原文（实时抓取）');
  const copyBtn = node('button', 'btn', '复制');
  copyBtn.type = 'button';
  head.append(source, copyBtn);
  const pre = node('pre', 'bibtex', '');
  const note = node('p', 'meta', '');
  panel.append(head, pre, note);

  let loaded = false;

  const load = async () => {
    if (!item.bibUrl) throw new Error('缺少 BibTeX 地址');
    const res = await send({ type: 'bib', url: item.bibUrl });
    if (!res || !res.ok) throw new Error(errorText(res || {}));
    loaded = true;
    return res;
  };

  const paint = (res) => {
    pre.textContent = res.bibtex;
    note.textContent = '';
    if (!item.title) {
      const t = titleFromBib(res.bibtex);
      if (t) titleEl.textContent = t;
    }
  };

  const open = async () => {
    panel.hidden = false;
    toggle.textContent = '收起';
    if (loaded) return;
    toggle.disabled = true;
    toggle.textContent = '获取中…';
    try {
      paint(await load());
    } catch (err) {
      pre.textContent = `获取失败：${err.message}`;
      copyBtn.disabled = true;
    } finally {
      toggle.disabled = false;
      toggle.textContent = '收起';
    }
  };

  toggle.addEventListener('click', () => {
    if (!panel.hidden) {
      panel.hidden = true;
      toggle.textContent = '获取 BibTeX';
      return;
    }
    open();
  });

  copyBtn.addEventListener('click', async () => {
    if (!pre.textContent) return;
    const ok = await copyText(pre.textContent);
    showToast(ok ? 'DBLP BibTeX 已复制' : '复制失败，请手动选中');
  });

  card.append(panel);
  if (autoLoad) open();
  return card;
}

function renderResults(list, total, query) {
  resultsEl.replaceChildren();
  if (!list.length) {
    resultsEl.append(node('p', 'hint', `DBLP 上没有找到「${query}」的结果。试试更完整的标题，或只填几个关键词。`));
    return;
  }
  list.forEach((item, index) => {
    resultsEl.append(createCard(item, index === 0));
  });
  if (total && total > list.length) {
    resultsEl.append(node('p', 'hint', `共 ${total} 条，这里显示前 ${list.length} 条。`));
  }
}

async function runSearch(query) {
  clearTimers();
  setStatus('打开 DBLP 后台标签页…');
  schedule(() => setStatus('等待 DBLP 校验（首次 5–15 秒）…'), 2500);
  schedule(() => setStatus('仍在等待校验，请勿关闭弹窗…'), 16000);
  schedule(() => setStatus('校验较慢，可以稍后重试…'), 45000);
  searchBtn.disabled = true;
  try {
    const res = await send({ type: 'search', q: query });
    clearTimers();
    if (!res) throw new Error('后台没有响应');
    if (!res.ok) {
      showError(res);
      return;
    }
    renderResults(res.results || [], res.total, query);
    setStatus(`找到 ${(res.results || []).length} 条 · DBLP`);
  } catch (err) {
    clearTimers();
    showError({ error: err.message });
  } finally {
    searchBtn.disabled = false;
  }
}

function dblpBibFromInput(text) {
  const m = /dblp\.org\/rec\/([^?#\s]+)/i.exec(text.trim());
  if (!m) return null;
  const key = m[1].replace(/\.html$/i, '').replace(/\.bib$/i, '');
  if (!key) return null;
  return {
    title: '',
    authors: [],
    venue: '',
    year: '',
    url: `https://dblp.org/rec/${key}.html`,
    bibUrl: `https://dblp.org/rec/${key}.bib?param=1`,
  };
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) {
    input.focus();
    return;
  }
  const quick = dblpBibFromInput(query);
  if (quick) {
    resultsEl.replaceChildren(createCard(quick, true));
    setStatus('正在取 DBLP 记录…');
    return;
  }
  runSearch(query);
});

closeTabBtn.addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ type: 'closeTab' });
    showToast('已关闭 DBLP 后台标签页');
  } catch {
    showToast('关闭失败');
  }
});

const initial = new URLSearchParams(location.search).get('q');
if (initial) {
  input.value = initial;
  form.requestSubmit();
} else {
  // 如果弹窗在等待 DBLP 校验时被关掉，重新打开还能看到上一次的结果。
  chrome.storage.session.get('lastSearch').then((got) => {
    const last = got && got.lastSearch;
    if (!last || Date.now() - last.at > 10 * 60 * 1000) return;
    input.value = last.q || '';
    renderResults(last.results || [], last.total, last.q || '');
    setStatus(`上次结果 · ${(last.results || []).length} 条`);
  });
}
