# 🪞 Mirror Check

> **"도움됐어요" 버튼, 진짜 누구에게 닿았나요?**
>
> 웹페이지의 "좋아요", "도움됐어요", "인기 급상승" 버튼이 **실제 서버 집계**인지
> 내 브라우저만 보는 **거울 속 숫자**인지 — 클릭 한 번으로 판정하는 북마클릿.

<p align="center">
  <a href="https://devcsb.github.io/mirror-check/"><b>→ 사이트에서 바로 써보기</b></a>
</p>

<p align="center">
  <img alt="MIT" src="https://img.shields.io/badge/license-MIT-black?style=flat-square" />
  <img alt="no deps" src="https://img.shields.io/badge/dependencies-0-success?style=flat-square" />
  <img alt="size" src="https://img.shields.io/badge/size-~6KB-informational?style=flat-square" />
  <img alt="install" src="https://img.shields.io/badge/install-drag%20%26%20drop-orange?style=flat-square" />
</p>

---

## 🤔 왜 필요한가요

당신이 어떤 블로그에서 **"도움됐어요 126"** 을 보고 글을 신뢰합니다.
그런데 그 숫자, 알고 보면 —

- 🪞 **당신 브라우저에서만** 올라가고
- 서버에는 아무것도 안 보내고
- 시크릿 창으로 다시 열면 **0** 에서 시작합니다.

이걸 **가짜 사회적 증거 (fake social proof)** 라고 합니다.
Mirror Check는 그걸 3초 만에 잡아냅니다.

---

## ⚡ 30초 사용법

1. **[사이트](https://devcsb.github.io/mirror-check/)** 에서 `🪞 Mirror Check` 버튼을 북마크바로 드래그
2. 의심 페이지로 이동 → 북마크 클릭
3. 검사할 버튼(예: "도움됐어요")을 누름
4. 우하단 패널에서 판정 확인

설치도, 가입도, 확장 프로그램 권한도 필요 없습니다.

---

## 🎯 세 가지 판정

| | 이름 | 의미 |
|---|---|---|
| 🔴 | **FAKE** | 로컬 저장만 바뀌고 서버엔 아무것도 안 감 → **가짜** |
| 🟢 | **REAL** | 서버 요청 발생, 로컬 저장 없음 → **진짜 집계** |
| 🟡 | **MIXED** | 서버 + 로컬 둘 다 → 서버 집계 + 중복 방지 캐시 |

판정 규칙:

```
로컬 쓰기 有  &  네트워크 無   →  FAKE
로컬 쓰기 無  &  네트워크 有   →  REAL
로컬 쓰기 有  &  네트워크 有   →  MIXED
```

---

## 🔬 작동 원리

거창한 AI는 없습니다. 세 줄 규칙으로 끝납니다.

1. **로컬 쓰기 감지** — `Storage.prototype.setItem`과 `document.cookie` setter를 monkey-patch
2. **네트워크 후킹** — `fetch` / `XMLHttpRequest.open` / `navigator.sendBeacon` 래핑
3. **2.5초 윈도우 비교** — 클릭 직후 수집된 시그널로 판정

전체 소스는 약 100줄, [`bookmarklet.js`](./bookmarklet.js) 에서 직접 읽어볼 수 있습니다.

---

## 📸 이렇게 보입니다

패널은 최근 이벤트를 **키 단위로 묶어서** 보여줍니다.
같은 키에 8번 쓰여도 한 줄 + `×8` 배지로 축약되니, 진짜 찾아야 할 시그널이 묻히지 않습니다.

```
┌─ 🪞 Mirror Check ──────────────── [초기화] [닫기] ┐
│                                                    │
│  ▌ FAKE                                            │
│  ▌ 로컬 저장만 발생, 서버 전송 없음 → 가짜 사회적 증거 │
│                                                    │
│  [클릭 1] [로컬 8] [쿠키 0] [요청 0]                │
│                                                    │
│  ↳ "도움됐어요"                         01:35:17   │
│                                                    │
│  로컬/세션 저장 · 2                                 │
│  ┌────────────────────────────────────────────┐   │
│  │ local.ig_likes       ×7   {"dob-007":100… │   │
│  │ local.ig_favorites        ["etc-001","pa… │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
│  네트워크                                  없음     │
└────────────────────────────────────────────────────┘
```

---

## ⚠️ 한계

만능은 아닙니다. 다음 경우에는 잘못 판정할 수 있으니 맹신하지 마세요.

- **Service Worker / WebSocket 전송** — `fetch`·`XHR` 훅을 우회해 `REAL`인데 `FAKE`로 오판 가능
- **디바운스 배치 전송** — 수 초 뒤 한꺼번에 보내는 사이트는 2.5초 윈도우를 놓칠 수 있음 (`bookmarklet.js`의 `windowMs` 값을 늘려서 사용)
- **엄격한 CSP** — `Content-Security-Policy`가 걸린 페이지는 북마클릿 실행 자체가 차단됨

---

## 🛠 직접 수정하고 싶다면

```bash
git clone https://github.com/devcsb/mirror-check.git
cd mirror-check
python3 -m http.server 8000
# → http://localhost:8000
```

빌드 스텝 없음. `bookmarklet.js` 수정 → 새로고침 → 북마크 다시 드래그.

---

## 📦 원리가 더 궁금하다면

- [사이트의 "작동 원리" 섹션](https://devcsb.github.io/mirror-check/#how) — 시각화된 판정 규칙
- [`bookmarklet.js`](./bookmarklet.js) — 전체 소스 (약 100줄)
- 이슈/PR 환영합니다

---

## 📄 라이선스

MIT © [devcsb](https://github.com/devcsb)

거울에 비친 숫자에 속지 마세요. 🪞
