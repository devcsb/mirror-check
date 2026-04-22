(function () {
  if (window.__mirrorCheck) {
    window.__mirrorCheck.panel.remove();
    delete window.__mirrorCheck;
    return;
  }

  const state = {
    storageWrites: [],
    cookieWrites: [],
    networkCalls: [],
    clicks: [],
    startedAt: Date.now(),
  };

  const panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;right:16px;bottom:16px;width:360px;max-height:78vh;' +
    'display:flex;flex-direction:column;overflow:hidden;' +
    'background:#0f1317;color:#e6edf3;' +
    'border:1px solid #2b313a;border-radius:12px;' +
    'box-shadow:0 20px 50px rgba(0,0,0,.45),0 4px 12px rgba(0,0,0,.3);' +
    'font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;' +
    'z-index:2147483647';
  document.documentElement.appendChild(panel);

  const origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    state.storageWrites.push({
      store: this === window.localStorage ? 'local' : 'session',
      key, value: String(value).slice(0, 200), t: Date.now(),
    });
    render();
    return origSetItem.apply(this, arguments);
  };

  const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  if (cookieDesc && cookieDesc.set) {
    Object.defineProperty(document, 'cookie', {
      get: cookieDesc.get.bind(document),
      set: function (v) {
        state.cookieWrites.push({ value: String(v).slice(0, 200), t: Date.now() });
        render();
        return cookieDesc.set.call(document, v);
      },
      configurable: true,
    });
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = (init && init.method) || (typeof input === 'object' && input && input.method) || 'GET';
    state.networkCalls.push({ type: 'fetch', method: String(method).toUpperCase(), url, t: Date.now() });
    render();
    return origFetch.apply(this, arguments);
  };

  const origXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    state.networkCalls.push({ type: 'xhr', method: String(method).toUpperCase(), url: String(url), t: Date.now() });
    render();
    return origXhrOpen.apply(this, arguments);
  };

  if (navigator.sendBeacon) {
    const origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      state.networkCalls.push({ type: 'beacon', method: 'POST', url: String(url), t: Date.now() });
      render();
      return origBeacon(url, data);
    };
  }

  document.addEventListener('click', function (e) {
    if (panel.contains(e.target)) return;
    const target = e.target;
    const label = (target.innerText || target.value || target.getAttribute('aria-label') || target.tagName || '')
      .trim().replace(/\s+/g, ' ').slice(0, 50);
    state.clicks.push({ label, t: Date.now() });
    render();
  }, true);

  const snapshot = {
    localStorage: { ...localStorage },
    sessionStorage: { ...sessionStorage },
    cookies: document.cookie,
  };

  window.__mirrorCheck = { state, panel, snapshot };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function trunc(s, max) {
    s = String(s);
    return s.length <= max ? s : s.slice(0, max - 1) + '…';
  }
  function fmtTime(t) {
    return new Date(t).toTimeString().slice(0, 8);
  }
  function cookieName(v) {
    const m = String(v).match(/^\s*([^=;]+)=/);
    return m ? m[1].trim() : '(unknown)';
  }
  function groupBy(arr, keyFn) {
    const map = new Map();
    for (const item of arr) {
      const k = keyFn(item);
      const prev = map.get(k);
      if (prev) { prev.count++; prev.latest = item; }
      else map.set(k, { groupKey: k, count: 1, latest: item });
    }
    return [...map.values()].sort((a, b) => b.latest.t - a.latest.t);
  }

  function verdict() {
    const lastClick = state.clicks[state.clicks.length - 1];
    if (!lastClick) return { tag: 'IDLE', msg: '버튼을 눌러 테스트하세요 (예: "도움됐어요")' };
    const windowMs = 2500;
    const inWindow = (arr) => arr.filter(x => x.t >= lastClick.t && x.t <= lastClick.t + windowMs);
    const writes = inWindow(state.storageWrites);
    const cookies = inWindow(state.cookieWrites);
    const net = inWindow(state.networkCalls);
    if ((writes.length || cookies.length) && net.length === 0) {
      return { tag: 'FAKE', msg: '로컬 저장만 발생, 서버 전송 없음 → 가짜 사회적 증거' };
    }
    if (net.length && !writes.length && !cookies.length) {
      return { tag: 'REAL', msg: '서버 요청 발생 → 실제 서버 집계 가능성 높음' };
    }
    if (net.length && (writes.length || cookies.length)) {
      return { tag: 'MIXED', msg: '서버 + 로컬 캐시 혼합 — 서버 집계 가능성 있음' };
    }
    return { tag: 'UNKNOWN', msg: '저장/네트워크 변화 없음 — 대상 버튼이 맞는지 확인' };
  }

  const S = {
    head: 'display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #2b313a;flex-shrink:0;background:#161b22',
    title: 'font:600 13px/1 -apple-system,BlinkMacSystemFont,"Inter",sans-serif;color:#f0ebe1;display:flex;align-items:center;gap:7px',
    actions: 'display:flex;gap:6px',
    btn: 'appearance:none;font:500 11px/1 -apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer;padding:5px 10px;border-radius:5px;background:#21262d;color:#c9d1d9;border:1px solid #30363d',
    body: 'overflow-y:auto;overflow-x:hidden;flex:1;padding:12px 14px',
    vcard: (c) => `padding:10px 12px;border-radius:8px;background:#161b22;border-left:3px solid ${c};margin-bottom:12px`,
    vtag: (c) => `color:${c};font:700 12px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.06em`,
    vmsg: 'color:#c9d1d9;font:12px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;margin-top:3px',
    stats: 'display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:12px',
    stat: (on) => `background:${on?'#1c2430':'#161b22'};border:1px solid ${on?'#3a4552':'#2b313a'};border-radius:6px;padding:7px 6px;text-align:center`,
    slabel: (on) => `color:${on?'#8b949e':'#6b7280'};font:10px/1.2 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.04em`,
    sval: (on) => `color:${on?'#f0ebe1':'#4b5563'};font:600 16px/1.2 -apple-system,BlinkMacSystemFont,sans-serif;margin-top:2px`,
    clickCard: 'padding:8px 10px;background:#161b22;border:1px solid #2b313a;border-radius:6px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:baseline;gap:8px',
    clabel: 'color:#f0ebe1;font:500 12px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1',
    ctime: 'color:#7d8590;font:10px/1.4 ui-monospace,monospace;flex-shrink:0',
    section: 'margin-bottom:10px',
    shead: 'display:flex;justify-content:space-between;align-items:baseline;color:#7d8590;font:600 10px/1.2 -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.06em;margin-bottom:6px;padding:0 2px',
    stitle: 'text-transform:uppercase',
    scount: 'color:#6b7280;font-weight:500',
    empty: 'color:#6b7280;font:11px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;font-style:italic;padding:4px 2px',
    row: 'display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:5px;background:#161b22;margin-bottom:3px',
    rkey: 'color:#e6edf3;font:500 11px/1.4 ui-monospace,monospace;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0',
    rbadge: 'color:#d29922;font:600 10px/1.4 ui-monospace,monospace;background:#2b2311;padding:1px 6px;border-radius:3px;flex-shrink:0',
    rval: 'color:#8b949e;font:11px/1.4 ui-monospace,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0',
    rmeth: 'color:#7ee787;font:600 10px/1.4 ui-monospace,monospace;flex-shrink:0;min-width:40px',
    details: 'margin-top:10px',
    summary: 'cursor:pointer;color:#7d8590;font:11px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;user-select:none;padding:4px 0',
    pre: 'white-space:pre-wrap;word-break:break-all;color:#8b949e;font:10px/1.5 ui-monospace,monospace;background:#161b22;padding:8px 10px;border-radius:6px;margin:6px 0 0;max-height:200px;overflow:auto;border:1px solid #2b313a',
  };

  function statBox(label, n) {
    const on = n > 0;
    return `<div style="${S.stat(on)}"><div style="${S.slabel(on)}">${label}</div><div style="${S.sval(on)}">${n}</div></div>`;
  }
  function sectionBlock(title, total, uniq, rows) {
    const count = total ? `${uniq}${uniq !== total ? ` · ${total}회` : ''}` : '';
    return `<div style="${S.section}"><div style="${S.shead}"><span style="${S.stitle}">${title}</span>${count ? `<span style="${S.scount}">${count}</span>` : ''}</div>` +
      (rows.length ? rows.join('') : `<div style="${S.empty}">없음</div>`) + `</div>`;
  }
  function storageRow(g) {
    const { latest, count } = g;
    return `<div style="${S.row}" title="${esc(latest.value)}">` +
      `<span style="${S.rkey}">${esc(latest.store)}.${esc(latest.key)}</span>` +
      (count > 1 ? `<span style="${S.rbadge}">×${count}</span>` : '') +
      `<span style="${S.rval}">${esc(trunc(latest.value, 60))}</span></div>`;
  }
  function cookieRow(g) {
    const { latest, count } = g;
    return `<div style="${S.row}" title="${esc(latest.value)}">` +
      `<span style="${S.rkey}">${esc(cookieName(latest.value))}</span>` +
      (count > 1 ? `<span style="${S.rbadge}">×${count}</span>` : '') +
      `<span style="${S.rval}">${esc(trunc(latest.value, 60))}</span></div>`;
  }
  function networkRow(g) {
    const { latest, count } = g;
    const method = latest.method || latest.type.toUpperCase();
    return `<div style="${S.row}" title="${esc(latest.url)}">` +
      `<span style="${S.rmeth}">${esc(method)}</span>` +
      (count > 1 ? `<span style="${S.rbadge}">×${count}</span>` : '') +
      `<span style="${S.rval}">${esc(trunc(latest.url, 60))}</span></div>`;
  }

  function render() {
    const v = verdict();
    const colors = { FAKE: '#f85149', REAL: '#3fb950', MIXED: '#d29922', UNKNOWN: '#8b949e', IDLE: '#58a6ff' };
    const color = colors[v.tag];
    const storage = groupBy(state.storageWrites, w => w.store + ':' + w.key);
    const cookies = groupBy(state.cookieWrites, c => cookieName(c.value));
    const network = groupBy(state.networkCalls, n => n.type + ' ' + n.url);
    const lastClick = state.clicks[state.clicks.length - 1];

    const prevBody = panel.querySelector('[data-mc-body]');
    const scrollTop = prevBody ? prevBody.scrollTop : 0;

    panel.innerHTML =
      `<div style="${S.head}"><div style="${S.title}"><span style="font-size:14px">🪞</span>Mirror Check</div>` +
      `<div style="${S.actions}">` +
        `<button data-mc-reset style="${S.btn}">초기화</button>` +
        `<button data-mc-close style="${S.btn}">닫기</button>` +
      `</div></div>` +
      `<div data-mc-body style="${S.body}">` +
        `<div style="${S.vcard(color)}"><div style="${S.vtag(color)}">${v.tag}</div><div style="${S.vmsg}">${esc(v.msg)}</div></div>` +
        `<div style="${S.stats}">` +
          statBox('클릭', state.clicks.length) +
          statBox('로컬', state.storageWrites.length) +
          statBox('쿠키', state.cookieWrites.length) +
          statBox('요청', state.networkCalls.length) +
        `</div>` +
        (lastClick ? `<div style="${S.clickCard}" title="${esc(lastClick.label)}">` +
          `<div style="${S.clabel}">↳ "${esc(lastClick.label || '(빈 라벨)')}"</div>` +
          `<div style="${S.ctime}">${fmtTime(lastClick.t)}</div></div>` : '') +
        sectionBlock('로컬/세션 저장', state.storageWrites.length, storage.length, storage.map(storageRow)) +
        sectionBlock('쿠키', state.cookieWrites.length, cookies.length, cookies.map(cookieRow)) +
        sectionBlock('네트워크', state.networkCalls.length, network.length, network.map(networkRow)) +
        `<details style="${S.details}"><summary style="${S.summary}">초기 스냅샷 보기</summary>` +
          `<pre style="${S.pre}">${esc(JSON.stringify(snapshot, null, 2))}</pre></details>` +
      `</div>`;

    const newBody = panel.querySelector('[data-mc-body]');
    if (newBody) newBody.scrollTop = scrollTop;

    const closeBtn = panel.querySelector('[data-mc-close]');
    if (closeBtn) closeBtn.onclick = () => { panel.remove(); delete window.__mirrorCheck; };
    const resetBtn = panel.querySelector('[data-mc-reset]');
    if (resetBtn) resetBtn.onclick = () => {
      state.storageWrites.length = 0;
      state.cookieWrites.length = 0;
      state.networkCalls.length = 0;
      state.clicks.length = 0;
      render();
    };
  }

  render();
})();
