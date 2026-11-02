// 后台协调：确保有一个 dblp.org 标签页，让浏览器自己完成 Anubis 校验，
// 然后通过内容脚本在页面内查询 DBLP 接口（同源，带 cookie）。

const TAB_KEY = 'dblpTabId';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function storedTabId() {
  const got = await chrome.storage.session.get(TAB_KEY);
  return got[TAB_KEY];
}

async function ensureTab() {
  const id = await storedTabId();
  if (id !== undefined) {
    try {
      const tab = await chrome.tabs.get(id);
      if (tab && tab.url && tab.url.startsWith('https://dblp.org/')) return tab;
    } catch {
      // tab 已被关闭，走下面的新建流程
    }
  }
  const tab = await chrome.tabs.create({ url: 'https://dblp.org/', active: false });
  await chrome.storage.session.set({ [TAB_KEY]: tab.id });
  return tab;
}

async function ping(tabId) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'ping' });
  } catch {
    return null;
  }
}

async function waitForContent(tabId, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await ping(tabId)) return true;
    await sleep(700);
  }
  return false;
}

async function search(q) {
  const tab = await ensureTab();
  if (!(await waitForContent(tab.id))) {
    return { ok: false, code: 'no-content-script', tabId: tab.id };
  }
  const end = Date.now() + 60000;
  while (Date.now() < end) {
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'search', q });
      if (res && res.ok) {
        await chrome.storage.session.set({
          lastSearch: { q, results: res.results, total: res.total, at: Date.now() },
        });
        return { ...res, tabId: tab.id };
      }
      if (res && (res.status === 202 || res.status === 403)) {
        await sleep(1000);
        continue;
      }
      if (res) return { ...res, tabId: tab.id };
    } catch {
      // 页面正在被 Anubis 重载，内容脚本暂时不可达，重试
    }
    await sleep(1000);
  }
  return { ok: false, code: 'challenge-timeout', tabId: tab.id };
}

async function bib(url) {
  const tab = await ensureTab();
  if (!(await waitForContent(tab.id))) {
    return { ok: false, code: 'no-content-script', tabId: tab.id };
  }
  const end = Date.now() + 45000;
  while (Date.now() < end) {
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: 'bib', url });
      if (res && res.ok) return { ...res, tabId: tab.id };
      if (res && (res.status === 202 || res.status === 403)) {
        await sleep(900);
        continue;
      }
      if (res) return { ...res, tabId: tab.id };
    } catch {
      // 同上
    }
    await sleep(900);
  }
  return { ok: false, code: 'challenge-timeout', tabId: tab.id };
}

async function closeTab() {
  const id = await storedTabId();
  if (id !== undefined) {
    try {
      await chrome.tabs.remove(id);
    } catch {
      // 已经没了
    }
  }
  await chrome.storage.session.remove(TAB_KEY);
  return { ok: true };
}

async function openTab() {
  const tab = await ensureTab();
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true });
  return { ok: true, tabId: tab.id };
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const id = await storedTabId();
  if (id === tabId) await chrome.storage.session.remove(TAB_KEY);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return false;
  if (msg.type === 'search') {
    search(msg.q).then(sendResponse, (err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (msg.type === 'bib') {
    bib(msg.url).then(sendResponse, (err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (msg.type === 'closeTab') {
    closeTab().then(sendResponse);
    return true;
  }
  if (msg.type === 'openTab') {
    openTab().then(sendResponse);
    return true;
  }
  return false;
});
