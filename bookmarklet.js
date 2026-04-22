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

  const origSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    state.storageWrites.push({
      store: this === window.localStorage ? 'local' : 'session',
      key,
      value: String(value).slice(0, 120),
      t: Date.now(),
    });
    render();
    return origSetItem.apply(this, arguments);
  };

  const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  if (cookieDesc && cookieDesc.set) {
    Object.defineProperty(document, 'cookie', {
      get: cookieDesc.get.bind(document),
      set: function (v) {
        state.cookieWrites.push({ value: String(v).slice(0, 120), t: Date.now() });
        render();
        return cookieDesc.set.call(document, v);
      },
      configurable: true,
    });
  }

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    state.networkCalls.push({ type: 'fetch', url, t: Date.now() });
    render();
    return origFetch.apply(this, arguments);
  };

  const origXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    state.networkCalls.push({ type: 'xhr', method, url: String(url), t: Date.now() });
    render();
    return origXhrOpen.apply(this, arguments);
  };

  if (navigator.sendBeacon) {
    const origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      state.networkCalls.push({ type: 'beacon', url: String(url), t: Date.now() });
      render();
      return origBeacon(url, data);
    };
  }

  document.addEventListener(
    'click',
    function (e) {
      const target = e.target;
      const label = (target.innerText || target.value || target.getAttribute('aria-label') || target.tagName || '').trim().slice(0, 40);
      state.clicks.push({ label, t: Date.now() });
      render();
    },
    true
  );

  const snapshot = {
    localStorage: { ...localStorage },
    sessionStorage: { ...sessionStorage },
    cookies: document.cookie,
  };

  const panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;right:16px;bottom:16px;width:360px;max-height:70vh;overflow:auto;' +
    'background:#0b0f14;color:#e6edf3;font:12px/1.5 ui-monospace,Menlo,monospace;' +
    'border:1px solid #30363d;border-radius:10px;padding:12px 14px;z-index:2147483647;' +
    'box-shadow:0 10px 30px rgba(0,0,0,.35)';
  document.documentElement.appendChild(panel);

  window.__mirrorCheck = { state, panel, snapshot };

  function verdict() {
    const lastClick = state.clicks[state.clicks.length - 1];
    if (!lastClick) return { tag: 'IDLE', msg: '버튼을 눌러 테스트하세요 (예: 도움됐어요)' };

    const windowMs = 2500;
    const after = (arr) => arr.filter((x) => x.t >= lastClick.t && x.t <= lastClick.t + windowMs);
    const writes = after(state.storageWrites);
    const cookies = after(state.cookieWrites);
    const net = after(state.networkCalls);

    if ((writes.length || cookies.length) && net.length === 0) {
      return { tag: 'FAKE', msg: '로컬 저장만 발생, 서버 전송 없음 → 가짜 사회적 증거' };
    }
    if (net.length && !writes.length && !cookies.length) {
      return { tag: 'REAL', msg: '서버 요청 발생 → 실제 서버 집계 가능성 높음' };
    }
    if (net.length && (writes.length || cookies.length)) {
      return { tag: 'MIXED', msg: '서버+로컬 캐시 혼합 — 서버 집계 가능성 있음' };
    }
    return { tag: 'UNKNOWN', msg: '저장/네트워크 변화 없음 — 대상 버튼이 맞는지 확인' };
  }

  function esc(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  function section(title, rows, empty) {
    if (!rows.length) return `<div style="color:#7d8590;margin:4px 0">${title}: ${empty}</div>`;
    const lines = rows
      .slice(-5)
      .map((r) => `<div style="white-space:pre-wrap;word-break:break-all">• ${esc(JSON.stringify(r))}</div>`)
      .join('');
    return `<div style="margin:6px 0"><div style="color:#7d8590">${title} (${rows.length})</div>${lines}</div>`;
  }

  function render() {
    const v = verdict();
    const colors = { FAKE: '#f85149', REAL: '#3fb950', MIXED: '#d29922', UNKNOWN: '#7d8590', IDLE: '#58a6ff' };
    panel.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">` +
      `<strong style="font-size:13px">🪞 Mirror Check</strong>` +
      `<button id="__fd_close" style="background:#21262d;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:2px 8px;cursor:pointer">닫기</button>` +
      `</div>` +
      `<div style="padding:8px 10px;border-radius:8px;background:#161b22;border-left:3px solid ${colors[v.tag]};margin-bottom:8px">` +
      `<div style="color:${colors[v.tag]};font-weight:600">${v.tag}</div>` +
      `<div>${esc(v.msg)}</div>` +
      `</div>` +
      section('클릭', state.clicks, '없음') +
      section('localStorage/sessionStorage 쓰기', state.storageWrites, '없음') +
      section('cookie 쓰기', state.cookieWrites, '없음') +
      section('네트워크 요청', state.networkCalls, '없음') +
      `<details style="margin-top:8px"><summary style="cursor:pointer;color:#7d8590">초기 스냅샷 보기</summary>` +
      `<pre style="white-space:pre-wrap;word-break:break-all;color:#8b949e">${esc(JSON.stringify(snapshot, null, 2))}</pre>` +
      `</details>`;
    const btn = panel.querySelector('#__fd_close');
    if (btn) btn.onclick = () => { panel.remove(); delete window.__mirrorCheck; };
  }

  render();
})();
