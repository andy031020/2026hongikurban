/* 홍익대학교 도시공학과 2026 졸업전시 · 응원 우체통 */
(function () {
  "use strict";

  const C = window.CONFIG;
  const TEAMS = C.TEAMS, RELS = C.RELS, STICKERS = C.STICKERS;
  const configured = !/YOUR-/.test(C.SUPABASE_URL + C.SUPABASE_ANON_KEY);
  const sb = configured ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;

  const state = {
    rel: null, sticker: null, teamOpen: null,
    floats: [], idx: 0, timer: null, pulse: null, poll: null,
    box: null, list: [], guests: [], photos: [null, null, null],
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const teamOf = (id) => TEAMS.find((t) => t.id === id);
  const fmt = (t) => { const d = new Date(t); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
  const short = (s) => (s.length > 60 ? s.slice(0, 58) + "…" : s);
  const CHECK = `<div class="check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>`;

  /* ================= 서버 호출 ================= */
  async function rpc(name, args) {
    if (!sb) throw new Error("not_configured");
    const { data, error } = await sb.rpc(name, args || {});
    if (error) throw error;
    return data;
  }
  const api = {
    send: (d) => rpc("send_letter", d),
    floats: () => rpc("public_floats"),
    check: (code) => rpc("check_reply", { p_code: code }),
    letters: (team, code) => rpc("team_letters", { p_team: team, p_code: code }),
    update: (team, code, id, patch) => rpc("team_update_letter", { p_team: team, p_code: code, p_id: id, p_reply: patch.reply ?? null, p_hidden: patch.hidden ?? null }),
    guestbook: (team, code) => rpc("team_guestbook", { p_team: team, p_code: code }),
    addGuest: (d) => rpc("add_guestbook", d),
    async upload(team, file) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${team}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from("guestbook").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      return path;
    },
  };

  /* ================= 화면 ================= */
  const HILLS = `<svg viewBox="0 0 1600 400" preserveAspectRatio="none"><defs><linearGradient id="hf" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><path d="M0 120 C200 60 380 70 560 110 S900 150 1080 100 S1420 50 1600 80 V400 H0Z" fill="#dfe3f0" opacity=".75"/><path d="M0 230 C260 200 520 190 800 215 S1340 240 1600 205 V400 H0Z" fill="#e9eaf3"/><rect x="0" y="180" width="1600" height="220" fill="url(#hf)"/></svg>`;

  function viewHome() {
    return `<section class="stage" id="stage">
      <div class="scene" aria-hidden="true"></div>
      <div class="glow a" aria-hidden="true"></div><div class="glow b" aria-hidden="true"></div>
      <p class="urban" aria-hidden="true">${[..."URBAN"].map((c, i) => `<span style="--i:${i}">${c}</span>`).join("")}</p>
      <div class="hero-txt"><h1 class="title">DESIGN &amp; PLANNING<small>2026 GRADUATE EXHIBITION</small></h1></div>
      <div class="sunglow" aria-hidden="true"></div>
      <div class="mist" aria-hidden="true"></div><div class="mist m2" aria-hidden="true"></div>
      <div class="motes" id="motes" aria-hidden="true"></div>
      <div class="sparks" id="sparks" aria-hidden="true"></div>
      <div class="sky" id="sky"></div>
    </section>
    ${configured ? "" : `<div class="preview"><span>Supabase 연결 전 · config.js 를 채워 주세요</span></div>`}`;
  }

  // 판넬 제목이 있으면: 작은 글씨 팀명 + 큰 제목 / 없으면: 작은 글씨 분야 + 큰 팀명
  const teamHead = (t, sub = "") => {
    const tail = sub ? " · " + sub : "";
    return t.title
      ? `<div class="head"><p class="kicker">${esc(t.name)}${tail}</p><h2>${esc(t.title)}</h2></div>`
      : `<div class="head"><p class="kicker">${esc(t.group || "")}${tail}</p><h2>${esc(t.name)}</h2></div>`;
  };

  function viewTeam(t) {
    return viewGuest(t); // 모든 팀 설계 1팀 형식으로 통일
    state.rel = null; state.sticker = null;
    return `<main class="wrap">
    ${teamHead(t)}
    <form class="panel" id="f" novalidate>
      <div class="field"><span class="lab" id="lr">보내는 사람</span>
        <div class="chips" role="group" aria-labelledby="lr">${RELS.map((r) => `<button type="button" class="chip" data-rel="${esc(r)}" aria-pressed="false">${esc(r)}</button>`).join("")}</div></div>
      <div class="field"><label for="nick">이름 <span class="opt">선택</span></label><input type="text" id="nick" maxlength="20"></div>
      <div class="field"><label for="text">메시지</label><textarea id="text" maxlength="300"></textarea><p class="count"><span id="cnt">0</span> / 300</p></div>
      <div class="field"><span class="lab" id="ls">스티커 <span class="opt">선택</span></span>
        <div class="chips" role="group" aria-labelledby="ls">${STICKERS.map((s) => `<button type="button" class="chip stk" data-stk="${s}" aria-pressed="false">${s}</button>`).join("")}</div></div>
      <label class="toggle" for="pub">홈 화면에도 띄우기<input type="checkbox" class="switch" id="pub" checked></label>
      <p class="err" id="err" hidden></p>
      <button class="btn block" id="send" type="submit">보내기</button>
    </form></main>`;
  }

  const PHOTO_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-9 9"/></svg>`;
  function photoSlot(i) {
    const f = state.photos[i];
    return f
      ? `<div class="ph has"><img src="${f.url}" alt="첨부한 사진 ${i + 1}"><button type="button" class="x" data-rm="${i}" aria-label="사진 ${i + 1} 빼기">×</button></div>`
      : `<label class="ph">${PHOTO_ICON}<span>사진 ${i + 1}</span><input type="file" accept="image/*" data-ph="${i}" aria-label="사진 ${i + 1} 선택"></label>`;
  }
  function viewGuest(t) {
    state.photos = [null, null, null];
    return `<main class="wrap">
    ${teamHead(t)}
    <form class="panel" id="gf" novalidate>
      <div class="field"><label for="gname">이름<span class="req">*</span></label><input type="text" id="gname" maxlength="20" autocomplete="name"></div>
      <div class="field"><label for="gphone">전화번호<span class="req">*</span></label><input type="tel" id="gphone" maxlength="13" inputmode="numeric" autocomplete="tel" placeholder="010-1234-5678"></div>
      <div class="field"><label for="gtext">한 마디<span class="req">*</span></label><textarea id="gtext" maxlength="500"></textarea><p class="count"><span id="gcnt">0</span> / 500</p></div>
      <div class="field"><span class="lab">사진 <span class="opt">선택 · 최대 3장</span></span><div class="photos" id="photos">${[0, 1, 2].map(photoSlot).join("")}</div></div>
      <div class="field">
        <label class="agree"><input type="checkbox" id="gagree"><span>개인정보 수집·이용에 동의합니다.<span class="req">*</span></span></label>
        <details class="terms"><summary>자세히 보기</summary><p>수집 항목: 이름, 전화번호, 첨부 사진<br>이용 목적: 졸업전시 방명록 운영 및 감사 연락<br>보유 기간: 전시 종료 후 1개월 이내 파기<br>동의하지 않으실 수 있으나, 이 경우 방명록 작성이 어렵습니다.</p></details>
      </div>
      <p class="err" id="gerr" hidden></p>
      <label class="toggle" for="gpub">홈 화면에도 띄우기<input type="checkbox" class="switch" id="gpub" checked></label>
      <button class="btn block" id="gsend" type="submit">보내기</button>
    </form></main>`;
  }
  const viewGuestDone = () => `<main class="wrap"><section class="done">${CHECK}<h2>감사합니다.</h2></section></main>`;
  const viewSent = () => `<main class="wrap"><section class="done">${CHECK}<h2>전달되었습니다.</h2></section></main>`;

  function viewCheck() {
    return `<main class="wrap"><div class="head"><h2>답장 확인</h2></div>
    <form class="panel" id="cf" novalidate>
      <div class="field"><label for="ccode">편지 번호</label><input type="text" id="ccode" maxlength="4" autocomplete="off" style="text-transform:uppercase;letter-spacing:.2em;font-size:1.3rem;text-align:center"></div>
      <button class="btn block" type="submit">확인</button><div id="cres"></div>
    </form></main>`;
  }
  function viewInbox() {
    return `<main class="wrap"><div class="head"><h2>팀 우체통</h2></div>
    <form class="panel" id="lf" novalidate>
      <div class="field"><span class="lab" id="lt">팀</span>
        <div class="tgroups" role="group" aria-labelledby="lt">${(C.GROUPS || [""]).map((g) => {
          const list = TEAMS.filter((t) => !g || t.group === g);
          return `<div class="tgroup">${g ? `<span class="opt">${esc(g)}</span>` : ""}<div class="chips">${list.map((t) => `<button type="button" class="chip" data-team="${esc(t.id)}" aria-pressed="false">${esc(g ? t.name.replace(g, "").trim() : t.name)}</button>`).join("")}</div></div>`;
        }).join("")}</div></div>
      <div class="field"><label for="lcode">코드</label><input type="password" id="lcode" maxlength="20" autocomplete="off" style="font:inherit;font-size:1.05rem;border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:var(--card);color:var(--ink);width:100%;box-sizing:border-box"></div>
      <p class="err" id="lerr" hidden></p>
      <button class="btn block" id="lsend" type="submit">열기</button>
    </form></main>`;
  }
  function viewMailbox(t) {
    return `<main class="wrap"><div class="head"><p class="kicker">${esc(t.name)}</p><h2>받은 편지</h2><a class="tlink" href="#home" id="close">닫기</a></div>
    <div id="box"><p class="muted" style="text-align:center">불러오는 중…</p></div></main>`;
  }

  /* ================= 우체통 ================= */
  async function loadBox() {
    const b = state.box; if (!b) return;
    try {
      if (true) { state.guests = await api.guestbook(b.team.id, b.code) || []; renderGuests(); }
      else { state.list = await api.letters(b.team.id, b.code) || []; renderBox(); }
    } catch (e) {
      const box = $("#box"); if (box) box.innerHTML = `<p class="err" style="text-align:center">불러오지 못했어요. 새로고침 후 다시 열어 주세요.</p>`;
    }
  }
  function renderBox() {
    const box = $("#box"); if (!box) return;
    const list = state.list, shown = list.filter((x) => !x.hidden), hid = list.filter((x) => x.hidden);
    if (!list.length) { box.innerHTML = `<p class="muted" style="text-align:center">아직 도착한 편지가 없어요.</p>`; return; }
    const open = new Set([...document.querySelectorAll(".rbox:not([hidden])")].map((n) => n.dataset.for));
    if (open.size) return; // 답장 작성 중에는 새로 그리지 않음
    box.innerHTML = `<div class="list">${shown.map((m) => `
      <article class="msg">
        <div class="meta"><span><span class="who">${m.sticker ? esc(m.sticker) + " " : ""}${esc(m.rel)}</span>${m.nick ? " · " + esc(m.nick) : ""}</span><span>${fmt(m.created_at)}</span></div>
        <p class="body">${esc(m.text)}</p>
        <div class="acts" data-id="${m.id}">
          <button class="linkbtn mute" data-act="hide">숨기기</button>
        </div>
        <div class="rbox" data-for="${m.id}" hidden></div>
      </article>`).join("")}</div>
      ${hid.length ? `<p class="small muted" style="text-align:center;margin-top:16px">숨긴 편지 ${hid.length}통 · <button class="linkbtn" id="unhide">다시 보이기</button></p>` : ""}`;
  }
  function renderGuests() {
    const box = $("#box"); if (!box) return;
    const g = state.guests;
    if (!g.length) { box.innerHTML = `<p class="muted" style="text-align:center">아직 남겨진 방명록이 없어요.</p>`; return; }
    box.innerHTML = `<div class="list">${g.map((m) => `
      <article class="msg">
        <div class="meta"><span><span class="who">${esc(m.name)}</span> · ${esc(m.phone)}</span><span>${fmt(m.created_at)}</span></div>
        <p class="body">${esc(m.text)}</p>
        <div class="acts"><button class="linkbtn mute" data-ghide="${m.id}" data-v="${m.hidden ? 0 : 1}">${m.hidden ? "다시 보이기" : "홈에서 숨기기"}</button></div>
        ${m.photos && m.photos.length ? `<p class="small muted">사진 ${m.photos.length}장 · Supabase 저장소 guestbook 폴더에서 확인</p>` : ""}
      </article>`).join("")}</div>`;
  }

  /* ================= 떠다니는 메시지 ================= */
  function spawn(m) {
    const sky = $("#sky"), st = $("#stage"); if (!sky || !st) return;
    if (sky.childElementCount >= Math.max(12, Math.round(st.clientWidth / 120))) return;
    const b = document.createElement("div"); b.className = "bubble";
    const w = st.clientWidth, h = st.clientHeight;
    b.style.left = Math.max(8, Math.random() * (w - 260)) + "px";
    b.style.setProperty("--h", h + 200 + "px");
    b.style.setProperty("--dur", (13 + Math.random() * 7).toFixed(1) + "s");
    b.innerHTML = `<span class="sway">${m.sticker ? `<i>${esc(m.sticker)}</i>` : ""}${esc(short(m.text))}</span>`;
    b.firstChild.style.animationDelay = (-Math.random() * 5).toFixed(1) + "s";
    b.addEventListener("animationend", (e) => { if (e.target === b) b.remove(); });
    sky.appendChild(b);
  }
  function tick() {
    if (!$("#sky")) return stopHome();
    if (state.floats.length) spawn(state.floats[state.idx++ % state.floats.length]);
  }
  async function refreshFloats() {
    if (!sb) return;
    try {
      const list = (await api.floats()) || [];
      const fresh = list.filter((m) => !state.floats.some((o) => o.id === m.id));
      const first = !state.floats.length;
      state.floats = list;
      if (reduced) return drawStill();
      if (!first) fresh.slice(0, 3).forEach(spawn);
      else for (let i = 0; i < Math.min(4, list.length); i++) setTimeout(tick, i * 700);
    } catch (_) { /* 다음 주기에 다시 시도 */ }
  }
  function drawStill() {
    const sky = $("#sky"); if (!sky) return;
    sky.className = "still";
    sky.innerHTML = state.floats.slice(0, 10).map((m) => `<div class="bubble">${m.sticker ? `<i>${esc(m.sticker)}</i>` : ""}${esc(short(m.text))}</div>`).join("");
  }
  function makeMotes() {
    const m = $("#motes"); if (!m || reduced) return;
    m.innerHTML = Array.from({ length: 22 }, () => {
      const sz = (3 + Math.random() * 6).toFixed(1);
      return `<span class="mote" style="left:${(Math.random() * 100).toFixed(1)}%;width:${sz}px;height:${sz}px;--d:${(14 + Math.random() * 16).toFixed(1)}s;--delay:${(-Math.random() * 25).toFixed(1)}s;--x:${(Math.random() * 80 - 40).toFixed(0)}px;--rise:${(50 + Math.random() * 40).toFixed(0)}vh;--o:${(.35 + Math.random() * .5).toFixed(2)}"></span>`;
    }).join("");
  }
  function spark() {
    const box = $("#sparks"), st = $("#stage"); if (!box || !st) return;
    if (box.childElementCount > 14) return;
    const s = document.createElement("span"); s.className = "spark";
    const w = st.clientWidth, h = st.clientHeight, sz = 8 + Math.random() * 16;
    // 건물이 있는 화면 가운데 아래쪽 주변에 반짝임
    s.style.left = (w * (0.5 + (Math.random() - 0.5) * Math.min(0.75, 900 / w))) + "px";
    s.style.top = (h * (0.45 + Math.random() * 0.42)) + "px";
    s.style.setProperty("--s", sz.toFixed(0) + "px");
    s.style.setProperty("--d", (1.4 + Math.random() * 1.4).toFixed(2) + "s");
    s.addEventListener("animationend", () => s.remove());
    box.appendChild(s);
  }
  function startHome() {
    makeMotes();
    if (!reduced) state.sparkT = setInterval(spark, 450);
    state.floats = []; state.idx = 0;
    refreshFloats();
    state.poll = setInterval(refreshFloats, 15000);
    if (reduced) return;
    state.timer = setInterval(tick, innerWidth >= 1400 ? 1300 : 2200);
    state.pulse = setInterval(() => {
      const st = $("#stage"); if (!st) return;
      st.classList.remove("pulse"); void st.offsetWidth; st.classList.add("pulse");
      setTimeout(() => st.classList.remove("pulse"), 3200);
    }, 10000);
  }
  function stopHome() { clearInterval(state.sparkT); clearInterval(state.timer); clearInterval(state.pulse); clearInterval(state.poll); state.timer = state.pulse = state.poll = null; }

  /* ================= 라우팅 ================= */
  function route() {
    const h = (location.hash || "#home").slice(1);
    stopHome();
    const app = $("#app");
    state.box = null;
    const bx = h.match(/^box-([a-z0-9]+)-(.+)$/);
    if (h.startsWith("team-") && teamOf(h.slice(5))) app.innerHTML = viewTeam(teamOf(h.slice(5)));
    else if (bx && teamOf(bx[1])) {
      // 팀 전용 우체통 링크: #box-<팀id>-<코드> (코드는 서버가 확인)
      state.box = { team: teamOf(bx[1]), code: decodeURIComponent(bx[2]) };
      app.innerHTML = viewMailbox(state.box.team); loadBox(); state.poll = setInterval(loadBox, 20000);
    }
    else { app.innerHTML = viewHome(); startHome(); }
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  /* ================= 입력 처리 ================= */
  const fail = (el, msg) => { el.textContent = msg; el.hidden = false; };
  const notReady = (el) => fail(el, "사이트 설정이 끝나지 않았어요. 운영진에게 알려 주세요.");

  document.addEventListener("click", async (e) => {
    const c = e.target.closest("[data-rel],[data-stk],[data-team]");
    if (c) {
      const grp = c.parentElement, was = c.getAttribute("aria-pressed") === "true";
      grp.querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", "false"));
      if (c.dataset.rel) { c.setAttribute("aria-pressed", "true"); state.rel = c.dataset.rel; }
      if (c.dataset.stk) { if (!was) { c.setAttribute("aria-pressed", "true"); state.sticker = c.dataset.stk; } else state.sticker = null; }
      if (c.dataset.team) { document.querySelectorAll("[data-team]").forEach((b) => b.setAttribute("aria-pressed", "false")); c.setAttribute("aria-pressed", "true"); state.teamOpen = c.dataset.team; }
      return;
    }
    const gh = e.target.closest("[data-ghide]");
    if (gh && state.box) { gh.disabled = true; await rpc("team_hide_guest", { p_team: state.box.team.id, p_code: state.box.code, p_id: gh.dataset.ghide, p_hidden: gh.dataset.v === "1" }); loadBox(); return; }
    const rm = e.target.closest("[data-rm]");
    if (rm) { const i = +rm.dataset.rm; if (state.photos[i]) URL.revokeObjectURL(state.photos[i].url); state.photos[i] = null; drawPhotos(); return; }

    const a = e.target.closest("[data-act]");
    if (a && state.box) {
      const id = a.parentElement.dataset.id, m = state.list.find((x) => x.id === id);
      if (a.dataset.act === "hide") { await api.update(state.box.team.id, state.box.code, id, { hidden: true }); loadBox(); }
      if (a.dataset.act === "reply") {
        const rb = a.closest(".msg").querySelector(".rbox"); rb.hidden = false;
        rb.innerHTML = `<div class="field"><label for="r-${id}">답장</label><textarea id="r-${id}" maxlength="200" style="min-height:90px">${esc(m.reply || "")}</textarea></div><button class="btn" data-save="${id}" style="margin-top:10px">남기기</button>`;
      }
      return;
    }
    const s = e.target.closest("[data-save]");
    if (s && state.box) {
      const id = s.dataset.save; s.disabled = true;
      await api.update(state.box.team.id, state.box.code, id, { reply: $("#r-" + id).value.trim() });
      s.closest(".rbox").hidden = true; loadBox(); return;
    }
    if (e.target.id === "unhide" && state.box) {
      for (const m of state.list.filter((x) => x.hidden)) await api.update(state.box.team.id, state.box.code, m.id, { hidden: false });
      loadBox();
    }
  });

  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "text") $("#cnt").textContent = t.value.length;
    if (t.id === "gtext") $("#gcnt").textContent = t.value.length;
    if (t.id === "gphone") { const d = t.value.replace(/\D/g, "").slice(0, 11); t.value = d.length < 4 ? d : d.length < 8 ? d.slice(0, 3) + "-" + d.slice(3) : d.slice(0, 3) + "-" + d.slice(3, d.length - 4) + "-" + d.slice(-4); }
  });

  const drawPhotos = () => { const b = $("#photos"); if (b) b.innerHTML = [0, 1, 2].map(photoSlot).join(""); };
  document.addEventListener("change", (e) => {
    const i = e.target.dataset && e.target.dataset.ph; if (i === undefined) return;
    const file = e.target.files[0]; if (!file) return;
    const er = $("#gerr");
    if (!file.type.startsWith("image/")) return fail(er, "사진 파일만 첨부할 수 있어요.");
    if (file.size > 10 * 1024 * 1024) return fail(er, "사진 한 장은 10MB 이하로 올려 주세요.");
    state.photos[+i] = { file, url: URL.createObjectURL(file) }; drawPhotos();
  });

  document.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = e.target.id;

    if (id === "f") {
      const team = location.hash.slice(6), text = $("#text").value.trim(), err = $("#err");
      if (!state.rel) return fail(err, "보내는 사람을 선택해 주세요.");
      if (text.length < 2) return fail(err, "메시지를 입력해 주세요.");
      if (!sb) return notReady(err);
      const btn = $("#send"); btn.disabled = true; btn.textContent = "보내는 중…";
      try {
        await api.send({ p_team: team, p_rel: state.rel, p_nick: $("#nick").value.trim(), p_text: text, p_sticker: state.sticker || "", p_pub: $("#pub").checked });
        $("#app").innerHTML = viewSent(); window.scrollTo(0, 0);
      } catch (x) { fail(err, "전송하지 못했어요. 연결을 확인하고 다시 눌러 주세요."); btn.disabled = false; btn.textContent = "다시 보내기"; }
    }

    if (id === "gf") {
      const t = teamOf(location.hash.slice(6)), err = $("#gerr");
      const name = $("#gname").value.trim(), phone = $("#gphone").value.trim(), text = $("#gtext").value.trim();
      if (!name) return fail(err, "이름을 입력해 주세요.");
      if (!/^01\d-?\d{3,4}-?\d{4}$/.test(phone)) return fail(err, "전화번호를 010-1234-5678 형식으로 입력해 주세요.");
      if (text.length < 2) return fail(err, "한 마디를 입력해 주세요.");
      if (!$("#gagree").checked) return fail(err, "개인정보 수집·이용에 동의해 주세요.");
      if (!sb) return notReady(err);
      err.hidden = true;
      const btn = $("#gsend"); btn.disabled = true; btn.textContent = "보내는 중…";
      try {
        const paths = [];
        for (const p of state.photos.filter(Boolean)) paths.push(await api.upload(t.id, p.file));
        await api.addGuest({ p_team: t.id, p_name: name, p_phone: phone, p_text: text, p_photos: paths, p_pub: $("#gpub").checked });
        state.photos.forEach((p) => p && URL.revokeObjectURL(p.url)); state.photos = [null, null, null];
        $("#app").innerHTML = viewGuestDone(); window.scrollTo(0, 0);
      } catch (x) { fail(err, "저장하지 못했어요. 연결을 확인하고 다시 눌러 주세요."); btn.disabled = false; btn.textContent = "다시 남기기"; }
    }

    if (id === "cf") {
      const code = $("#ccode").value.trim().toUpperCase(), out = $("#cres");
      if (!sb) { out.innerHTML = `<p class="err">사이트 설정이 끝나지 않았어요.</p>`; return; }
      let m = null;
      try { if (code.length === 4) m = ((await api.check(code)) || [])[0] || null; } catch (_) {}
      out.innerHTML = !m ? `<p class="err">편지를 찾지 못했어요.</p>`
        : `<div class="msg" style="background:var(--card)"><p class="body">${esc(m.text)}</p>
           ${m.reply ? `<p class="reply" style="background:var(--bg2)"><span class="rl">답장</span>${esc(m.reply)}</p>` : `<p class="small muted">아직 답장이 없어요.</p>`}</div>`;
    }

    if (id === "lf") {
      const t = teamOf(state.teamOpen), err = $("#lerr"), code = $("#lcode").value.trim();
      if (!t) return fail(err, "팀을 선택해 주세요.");
      if (!code) return fail(err, "코드를 입력해 주세요.");
      if (!sb) return notReady(err);
      const btn = $("#lsend"); btn.disabled = true;
      try {
        if (t.guestbook) await api.guestbook(t.id, code); else await api.letters(t.id, code);
        state.box = { team: t, code };
        location.hash = "mailbox";
      } catch (x) { fail(err, "코드가 맞지 않아요."); btn.disabled = false; }
    }
  });

  route();
})();
