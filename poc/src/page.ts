// PoC 확인용 단일 페이지. 실제 앱 화면이 아니다.
export function renderPage(): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>TasteGuru PoC</title>
<style>
  :root { --bg:#fff8f0; --card:#ffffff; --ink:#2b2a33; --muted:#6b6875; --line:#2b2a33; --accent:#ffd6e0; --ok:#c8f2dc; --bad:#ffd1d1; }
  @media (prefers-color-scheme: dark) { :root { --bg:#1d1c26; --card:#272634; --ink:#f3f1f8; --muted:#b7b3c4; --line:#f3f1f8; --accent:#5b4466; --ok:#2f5240; --bad:#5a3036; } }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; background:var(--bg); color:var(--ink); }
  main { max-width: 760px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 1.5rem; } h2 { font-size: 1.1rem; margin: 0 0 8px; }
  section { background:var(--card); border:2px solid var(--line); border-radius:14px; box-shadow:4px 4px 0 var(--line); padding:14px; margin:16px 0; }
  input, button { font: inherit; padding:8px 10px; border:2px solid var(--line); border-radius:10px; background:var(--card); color:var(--ink); }
  button { background:var(--accent); cursor:pointer; }
  input { width:100%; margin:6px 0; }
  pre { white-space: pre-wrap; word-break: break-all; font-size: .8rem; background: var(--bg); padding: 8px; border-radius: 8px; max-height: 360px; overflow: auto; }
  .row { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
  .items { display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap:10px; }
  .item { border:2px solid var(--line); border-radius:10px; padding:6px; font-size:.8rem; }
  .item img { width:100%; aspect-ratio:1; object-fit:cover; border-radius:6px; }
  .muted { color: var(--muted); font-size: .85rem; }
</style>
</head>
<body>
<main>
  <h1>🍙 TasteGuru PoC</h1>
  <p class="muted">개발 0단계 기술 검증용 페이지입니다.</p>

  <section>
    <h2>1. 상태</h2>
    <pre id="status">불러오는 중…</pre>
  </section>

  <section>
    <h2>2. 구글 로그인 + 초대 링크</h2>
    <div id="me" class="muted">확인 중…</div>
    <div class="row" style="margin-top:8px">
      <button id="login">구글로 로그인</button>
      <button id="logout">로그아웃</button>
      <button id="invite">초대 링크 만들기(관리자)</button>
    </div>
    <pre id="authOut"></pre>
  </section>

  <section>
    <h2>3. PoC 키</h2>
    <p class="muted">로그인 전에는 PoC 키로 아래 테스트를 호출합니다.</p>
    <input id="key" type="password" placeholder="PoC 키" autocomplete="off" />
  </section>

  <section>
    <h2>4. 네이버 쇼핑 검색</h2>
    <div class="row"><input id="q" value="비비고 왕교자" style="flex:1" /><button id="naver">검색</button></div>
    <div id="naverItems" class="items"></div>
    <pre id="naverOut"></pre>
  </section>

  <section>
    <h2>5. 상품 URL 메타 추출</h2>
    <input id="url" value="https://www.coupang.com/vp/products/206820279" />
    <div class="row">
      <button data-url="https://www.coupang.com/vp/products/206820279">쿠팡 예시</button>
      <button data-url="https://www.kurly.com/goods/5082274">컬리 예시</button>
      <button id="og">추출</button>
    </div>
    <pre id="ogOut"></pre>
  </section>
</main>
<script>
  const $ = (id) => document.getElementById(id);
  const keyInput = $('key');
  try { keyInput.value = localStorage.getItem('pocKey') || ''; } catch {}
  keyInput.addEventListener('change', () => { try { localStorage.setItem('pocKey', keyInput.value); } catch {} });
  const api = async (path, init = {}) => {
    const res = await fetch(path, { ...init, headers: { 'x-poc-key': keyInput.value, 'content-type': 'application/json', ...(init.headers || {}) } });
    return res.json();
  };
  const show = (id, data) => { $(id).textContent = JSON.stringify(data, null, 2); };

  const params = new URLSearchParams(location.search);
  if (params.get('auth_error') || params.get('error')) show('authOut', Object.fromEntries(params));
  if (params.get('invite')) show('authOut', { invite: params.get('invite') });

  api('/api/poc/status').then((d) => show('status', d));
  api('/api/me').then((d) => { $('me').textContent = d.user ? d.user.name + ' (' + d.user.email + ') · ' + d.role : '로그인 안 됨'; });

  $('login').onclick = async () => {
    const d = await api('/api/auth/sign-in/social', { method: 'POST', body: JSON.stringify({ provider: 'google', callbackURL: '/' }) });
    if (d.url) location.href = d.url; else show('authOut', d);
  };
  $('logout').onclick = async () => { await api('/api/auth/sign-out', { method: 'POST', body: '{}' }); location.reload(); };
  $('invite').onclick = async () => show('authOut', await api('/api/invites', { method: 'POST', body: '{}' }));

  $('naver').onclick = async () => {
    const d = await api('/api/poc/naver?q=' + encodeURIComponent($('q').value));
    show('naverOut', d);
    $('naverItems').innerHTML = '';
    for (const it of d.items || []) {
      const el = document.createElement('div');
      el.className = 'item';
      const img = document.createElement('img'); img.src = it.image; img.alt = ''; img.referrerPolicy = 'no-referrer';
      const t = document.createElement('div'); t.textContent = it.title + ' · ' + (it.lprice ?? '-') + '원';
      el.append(img, t); $('naverItems').append(el);
    }
  };
  document.querySelectorAll('[data-url]').forEach((b) => b.onclick = () => { $('url').value = b.dataset.url; });
  $('og').onclick = async () => { $('ogOut').textContent = '요청 중…'; show('ogOut', await api('/api/poc/og?url=' + encodeURIComponent($('url').value))); };
</script>
</body>
</html>`
}
