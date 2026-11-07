(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const view = $("#view");
  const sheet = $("#sheet");
  const sheetCard = $(".vt", sheet);
  const qInput = $("#q");

  const CAT_ORDER = ["匕首", "手套", "步枪", "手枪", "微型冲锋枪", "重型武器", "装备"];
  const COLORS = [
    ["red", "红", "#d8403a"], ["orange", "橙", "#ea8a2e"], ["yellow", "黄", "#e9c43a"],
    ["green", "绿", "#4daa57"], ["cyan", "青", "#2fb8b2"], ["blue", "蓝", "#3e78de"],
    ["purple", "紫", "#8a58d6"], ["pink", "粉", "#e47bb3"], ["brown", "棕", "#8a5a33"],
    ["black", "黑", "#1e2228"], ["gray", "灰", "#8c949c"], ["white", "白", "#eef0f2"],
  ];
  const WEARS = [
    ["崭新出厂", "Factory New", 0, 0.07], ["略有磨损", "Minimal Wear", 0.07, 0.15],
    ["久经沙场", "Field-Tested", 0.15, 0.38], ["破损不堪", "Well-Worn", 0.38, 0.45],
    ["战痕累累", "Battle-Scarred", 0.45, 1],
  ];
  const WEAR_SHORT = ["崭新", "略磨", "久经", "破损", "战痕"];

  let skins = [], byId = new Map(), crates = [], crateById = new Map(), meta = null;
  let rarityRank = {}, rarityById = {}, hasColors = false;
  let lastListHash = "#/";
  let listAbort = null;
  let currentList = [];
  const filterState = { key: "", rar: new Set(), col: new Set(), st: false, sort: "rarity" };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const img = (url, size) => (url ? `${url}/${size}fx${size}f` : "");
  const rc = (s) => (rarityById[s.rarity] || {}).color || "#8c949c";
  const shortName = (s) => (s.name.split("|")[1] || s.name).trim();

  async function boot() {
    try {
      const [a, b, c] = await Promise.all(["skins", "crates", "meta"].map((n) => fetch(`data/${n}.json`).then((r) => { if (!r.ok) throw new Error(n); return r.json(); })));
      skins = a; crates = b; meta = c;
    } catch (e) {
      view.innerHTML = `<p class="empty">数据没有载入成功，请刷新页面重试。</p>`;
      return;
    }
    meta.rarities.forEach((r, i) => { rarityRank[r.id] = i; rarityById[r.id] = r; });
    skins.forEach((s) => byId.set(s.id, s));
    crates.forEach((c) => crateById.set(c.id, c));
    hasColors = skins.some((s) => s.colors && s.colors.length);
    measureTop();
    addEventListener("resize", measureTop);
    addEventListener("hashchange", route);
    route();
  }

  function measureTop() {
    document.documentElement.style.setProperty("--topbar", $(".top").offsetHeight + "px");
  }

  // ---------- routing ----------
  function route() {
    const h = location.hash || "#/";
    const parts = h.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    const [kind, arg] = parts;
    document.querySelectorAll("[data-nav]").forEach((a) => a.removeAttribute("aria-current"));

    if (kind === "skin") {
      const s = byId.get(arg);
      if (!s) { location.hash = "#/"; return; }
      if (!view.dataset.ready) { lastListHash = "#/w/" + encodeURIComponent(s.weapon); renderListRoute(lastListHash); view.dataset.ready = "1"; }
      openSheet(s);
      return;
    }
    closeSheet(true);
    lastListHash = h;
    renderListRoute(h);
    view.dataset.ready = "1";
  }

  function renderListRoute(h) {
    const parts = h.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    const [kind, arg] = parts;
    const nav = (n) => { const a = $(`[data-nav="${n}"]`); if (a) a.setAttribute("aria-current", "page"); };
    if (kind !== "search") qInput.value = "";

    if (!kind) { nav("home"); renderHome(); }
    else if (kind === "w") {
      const list = skins.filter((s) => s.weapon === arg);
      if (!list.length) return renderHome();
      nav("home");
      renderList({ key: h, title: list[0].weaponName, en: list[0].weaponEn, items: list,
        crumb: [["#/", "武器"], [null, list[0].catName]] });
    }
    else if (kind === "all") {
      nav("all");
      const list = arg ? skins.filter((s) => s.catName === arg) : skins;
      renderList({ key: h, title: arg || "全部皮肤", en: arg ? "" : "All skins", items: list, crumb: arg ? [["#/all", "全部"]] : null, showCats: !arg });
    }
    else if (kind === "search") {
      nav("all");
      qInput.value = arg || "";
      renderList({ key: h, title: `“${arg}”`, en: "搜索结果", items: search(arg || "") });
    }
    else if (kind === "cases") { nav("cases"); renderCases(); }
    else if (kind === "case") { nav("cases"); renderCase(crateById.get(arg)); }
    else if (kind === "coll") {
      const c = meta.collections[arg];
      const list = skins.filter((s) => s.coll.includes(arg));
      renderList({ key: h, title: c ? c.name : "收藏品", en: "Collection", items: list, crumb: [["#/", "首页"]] });
    }
    else renderHome();
    view.focus({ preventScroll: true });
  }

  function search(q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return skins.filter((s) => {
      const hay = `${s.name} ${s.en} ${s.weaponName} ${s.weaponEn} ${s.pattern} ${s.phase}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }

  let qTimer;
  qInput.addEventListener("input", () => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      const q = qInput.value.trim();
      if (q) location.hash = "#/search/" + encodeURIComponent(q);
      else if (location.hash.startsWith("#/search")) location.hash = "#/all";
    }, 220);
  });

  // ---------- home ----------
  function best(list) {
    return list.slice().sort((a, b) => (rarityRank[b.rarity] - rarityRank[a.rarity]) || (a.phase ? 1 : 0) - (b.phase ? 1 : 0))[0];
  }

  function renderHome() {
    currentList = [];
    const cats = new Map();
    skins.forEach((s) => {
      if (!cats.has(s.catName)) cats.set(s.catName, new Map());
      const w = cats.get(s.catName);
      if (!w.has(s.weapon)) w.set(s.weapon, []);
      w.get(s.weapon).push(s);
    });
    const order = [...cats.keys()].sort((a, b) => (CAT_ORDER.indexOf(a) + 99) % 99 - (CAT_ORDER.indexOf(b) + 99) % 99);
    const latest = crates.filter((c) => c.type === "Case" || /武器箱/.test(c.name)).slice(0, 6);

    let html = `<div class="wrap">`;
    html += `<div class="head"><h1>按武器找皮肤</h1><span class="n">${skins.length.toLocaleString()} 款皮肤 · ${countWeapons()} 种武器</span></div>`;
    for (const cat of order) {
      const weapons = [...cats.get(cat).values()].sort((a, b) => b.length - a.length);
      const n = weapons.reduce((x, w) => x + w.length, 0);
      html += `<section class="section"><div class="section-title"><h2>${esc(cat)}</h2><span>${n}</span><a href="#/all/${encodeURIComponent(cat)}">看这类全部 →</a></div><div class="weapons">`;
      for (const list of weapons) {
        const b = best(list);
        html += `<a class="wtile" href="#/w/${encodeURIComponent(b.weapon)}"><div class="pic"><img loading="lazy" alt="" src="${esc(img(b.img, 256))}"></div><div class="cap"><b>${esc(b.weaponName)}</b><small>${list.length}</small></div></a>`;
      }
      html += `</div></section>`;
    }
    if (latest.length) {
      html += `<section class="section"><div class="section-title"><h2>最新武器箱</h2><a href="#/cases">全部武器箱 →</a></div><div class="cases">${latest.map(caseTile).join("")}</div></section>`;
    }
    html += `</div>`;
    view.innerHTML = html;
  }
  const countWeapons = () => new Set(skins.map((s) => s.weapon)).size;

  // ---------- lists with filters ----------
  function renderList({ key, title, en, items, crumb, showCats }) {
    if (filterState.key !== key) { filterState.key = key; filterState.rar.clear(); filterState.col.clear(); filterState.st = false; }
    const presentRar = meta.rarities.filter((r) => items.some((s) => s.rarity === r.id));
    const presentCol = hasColors ? COLORS.filter(([id]) => items.some((s) => (s.colors || []).includes(id))) : [];

    view.innerHTML = `<div class="wrap">
      ${crumb ? `<nav class="crumb">${crumb.map(([h, t]) => (h ? `<a href="${h}">${esc(t)}</a>` : `<span>${esc(t)}</span>`)).join("<span>/</span>")}</nav>` : ""}
      <div class="head"><div><h1>${esc(title)}</h1>${en ? `<div class="en">${esc(en)}</div>` : ""}</div><span class="n" id="n"></span></div>
      ${items.length ? `<div class="filters" id="filters">
        ${showCats ? `<div class="frow"><span class="lab">类别</span>${CAT_ORDER.filter((c) => skins.some((s) => s.catName === c)).map((c) => `<a class="chip" href="#/all/${encodeURIComponent(c)}">${esc(c)}</a>`).join("")}</div>` : ""}
        <div class="frow"><span class="lab">稀有度</span>${presentRar.map((r) => `<button class="chip" data-rar="${r.id}" aria-pressed="false"><i style="background:${r.color}"></i>${esc(r.name)}</button>`).join("")}</div>
        ${presentCol.length ? `<div class="frow"><span class="lab">颜色</span>${presentCol.map(([id, nm, hex]) => `<button class="swatch" data-col="${id}" aria-pressed="false" title="${nm}" aria-label="${nm}色" style="background:${hex}"></button>`).join("")}</div>` : ""}
        <div class="frow"><span class="lab">其他</span>
          <button class="chip" data-st aria-pressed="false">可 StatTrak™</button>
          <select class="sel" id="sort" aria-label="排序"><option value="rarity">稀有度从高到低</option><option value="rarity-asc">稀有度从低到高</option><option value="name">按名称</option></select>
          <button class="clear" id="clear" hidden>清除筛选</button>
        </div>
      </div>` : ""}
      <div class="grid" id="grid"></div>
    </div>`;

    const grid = $("#grid"), n = $("#n");
    $("#sort") && ($("#sort").value = filterState.sort);
    syncPressed();

    function syncPressed() {
      view.querySelectorAll("[data-rar]").forEach((b) => b.setAttribute("aria-pressed", filterState.rar.has(b.dataset.rar)));
      view.querySelectorAll("[data-col]").forEach((b) => b.setAttribute("aria-pressed", filterState.col.has(b.dataset.col)));
      const st = $("[data-st]", view); if (st) st.setAttribute("aria-pressed", filterState.st);
      const cl = $("#clear"); if (cl) cl.hidden = !(filterState.rar.size || filterState.col.size || filterState.st);
    }

    function paint() {
      let list = items.filter((s) =>
        (!filterState.rar.size || filterState.rar.has(s.rarity)) &&
        (!filterState.col.size || (s.colors || []).some((c) => filterState.col.has(c))) &&
        (!filterState.st || s.st));
      const sort = filterState.sort;
      list = list.slice().sort((a, b) =>
        sort === "name" ? a.name.localeCompare(b.name, "zh") :
        sort === "rarity-asc" ? (rarityRank[a.rarity] - rarityRank[b.rarity]) || a.name.localeCompare(b.name, "zh") :
        (rarityRank[b.rarity] - rarityRank[a.rarity]) || a.name.localeCompare(b.name, "zh"));
      currentList = list;
      n.textContent = list.length === items.length ? `${items.length} 款` : `${list.length} / ${items.length} 款`;
      grid.innerHTML = list.length ? list.map(card).join("") : `<p class="empty">${items.length ? "没有符合筛选的皮肤，试试清除几个条件。" : "没有找到。可以试试武器名、皮肤名或英文名，比如 “AK 火神” 或 “Doppler”。"}</p>`;
    }

    if (listAbort) listAbort.abort();
    listAbort = new AbortController();
    view.addEventListener("click", (e) => {
      const r = e.target.closest("[data-rar]"), c = e.target.closest("[data-col]");
      if (r) toggle(filterState.rar, r.dataset.rar);
      else if (c) toggle(filterState.col, c.dataset.col);
      else if (e.target.closest("[data-st]")) filterState.st = !filterState.st;
      else if (e.target.closest("#clear")) { filterState.rar.clear(); filterState.col.clear(); filterState.st = false; }
      else return;
      syncPressed(); paint();
    }, { signal: listAbort.signal });
    $("#sort") && $("#sort").addEventListener("change", (e) => { filterState.sort = e.target.value; paint(); });
    paint();
  }
  const toggle = (set, v) => (set.has(v) ? set.delete(v) : set.add(v));

  function card(s) {
    const badges = s.phase ? `<span class="badge">${esc(s.phase)}</span>` : "";
    return `<a class="item" href="#/skin/${encodeURIComponent(s.id)}" style="--rc:${rc(s)}">
      <div class="pic">${s.img ? `<img loading="lazy" alt="${esc(s.name)}" src="${esc(img(s.img, 360))}">` : `<span class="noimg">暂无图片</span>`}${badges ? `<div class="badges">${badges}</div>` : ""}</div>
      <div class="bar"></div>
      <div class="txt"><span class="w">${esc(s.weaponName)}</span><span class="p">${esc(shortName(s))}</span></div></a>`;
  }

  // ---------- cases ----------
  function caseTile(c) {
    return `<a class="case" href="#/case/${encodeURIComponent(c.id)}"><img loading="lazy" alt="" src="${esc(img(c.img, 256))}"><b>${esc(c.name)}</b><small>${esc(c.date || "")} · ${c.items.length} 款</small></a>`;
  }

  function renderCases() {
    const groups = [["武器箱", crates.filter((c) => c.type === "Case" || (/武器箱/.test(c.name) && c.type !== "Souvenir"))]];
    const rest = crates.filter((c) => !groups[0][1].includes(c));
    if (rest.length) groups.push(["纪念包与其他", rest]);
    view.innerHTML = `<div class="wrap"><div class="head"><h1>按武器箱找皮肤</h1><span class="n">${crates.length} 个</span></div>
      ${groups.map(([t, list]) => `<section class="section"><div class="section-title"><h2>${t}</h2><span>${list.length}</span></div><div class="cases">${list.map(caseTile).join("")}</div></section>`).join("")}</div>`;
  }

  function renderCase(c) {
    if (!c) return renderCases();
    const items = c.items.map((id) => byId.get(id)).filter(Boolean);
    const rare = c.rare.map((id) => byId.get(id)).filter(Boolean);
    const tiers = meta.rarities.slice().reverse().map((r) => [r, items.filter((s) => s.rarity === r.id)]).filter(([, l]) => l.length);
    currentList = tiers.flatMap(([, l]) => l).concat(rare);
    view.innerHTML = `<div class="wrap">
      <nav class="crumb"><a href="#/cases">武器箱</a></nav>
      <div class="head"><div><h1>${esc(c.name)}</h1><div class="en">${esc(c.en)}</div></div><span class="n">${esc(c.date || "")}</span></div>
      ${tiers.map(([r, l]) => `<div class="tier" style="--rc:${r.color}"><i></i>${esc(r.name)}<span>${l.length}</span></div><div class="grid">${l.map(card).join("")}</div>`).join("")}
      ${rare.length ? `<div class="tier" style="--rc:#e4ae39"><i></i>★ 稀有特殊物品<span>${rare.length}</span></div><div class="grid">${rare.map(card).join("")}</div>` : ""}
    </div>`;
  }


  // ---------- showcase (展柜) ----------
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let current = null;

  function marketName(s, wear) {
    const n = s.en || "";
    return wear ? `${n} (${wear})` : n;
  }

  function listFor(s) {
    if (currentList.length && currentList.some((x) => x.id === s.id)) return currentList;
    return skins.filter((x) => x.weapon === s.weapon).sort((a, b) => (rarityRank[b.rarity] - rarityRank[a.rarity]) || a.name.localeCompare(b.name, "zh"));
  }

  function siblings(s) {
    const key = s.coll[0];
    let pool = key ? skins.filter((x) => x.coll.includes(key)) : [];
    let label = key && meta.collections[key] ? meta.collections[key].name : "";
    if (pool.length < 2 && s.crates[0]) {
      const c = crateById.get(s.crates[0]);
      if (c) { pool = c.items.concat(c.rare).map((id) => byId.get(id)).filter(Boolean); label = c.name; }
    }
    const seen = new Set();
    pool = pool.filter((x) => x.id !== s.id && x.name !== s.name && !seen.has(x.name) && seen.add(x.name));
    pool.sort((a, b) => rarityRank[b.rarity] - rarityRank[a.rarity]);
    return [label, pool.slice(0, 12)];
  }

  // dealer's voice: a few fixed lines picked by the item, so each page reads the same every visit
  function hashOf(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; }
  function pick(list, seed) { return list[seed % list.length]; }
  function dealerLine(s, avail) {
    const h = hashOf(s.id);
    const rank = rarityRank[s.rarity] ?? 0;
    const star = s.catName === "匕首" || s.catName === "手套";
    const lines = [];
    if (/违禁/.test((rarityById[s.rarity] || {}).name || "")) lines.push(pick(["这东西不在任何官方清单上。你没见过它，我也没卖过。", "违禁品。全世界就这一批，看完记得把门带上。"], h));
    else if (star) lines.push(pick(["★ 级的货，箱子里百里挑一。别说是从我这拿的。", "这种东西我一般只给熟客看。", "刀和手套从来不愁卖，今天算你运气好。"], h));
    else if (rank >= 5) lines.push(pick(["压箱底的货，识货的人不多。", "隐秘级。这把我本来不打算拿出来。", "要的人排着队，你先看。"], h));
    else if (rank >= 3) lines.push(pick(["成色不错，价格好商量。", "这把在场上很显眼，想低调的别选。", "行家都会多看两眼的一把。"], h));
    else lines.push(pick(["入门货，但耐看。", "便宜、结实，打完一整个赛季也不心疼。", "别小看它，老玩家都收过一把。"], h));
    if (s.phase) lines.push(`${s.phase}，这一批的颜色最正。`);
    const n = avail.filter(Boolean).length;
    if (n === 5) lines.push("从崭新到战痕都有，挑个合眼的。");
    else if (n <= 2) lines.push(`只出${WEARS.filter((w, i) => avail[i]).map((w) => w[0]).join("和")}，别处不好找。`);
    return lines.join(" ");
  }

  function bar(value, total = 12) {
    const n = Math.round(value * total);
    return "█".repeat(n) + "░".repeat(total - n);
  }

  function openSheet(s, dir) {
    current = s;
    const list = listFor(s);
    const idx = list.findIndex((x) => x.id === s.id);
    const variants = skins.filter((x) => x.name === s.name);
    const cratesOf = s.crates.map((id) => crateById.get(id)).filter(Boolean);
    const colls = s.coll.map((id) => meta.collections[id]).filter(Boolean);
    const min = s.min ?? 0, max = s.max ?? 1;
    const avail = WEARS.map((w) => w[3] > min && w[2] < max);
    const r = rarityById[s.rarity] || { name: "", color: "#8c949c" };
    const rank = (rarityRank[s.rarity] ?? 0) + 1;
    const [sibLabel, sibs] = siblings(s);
    const no = String(skins.indexOf(s) + 1).padStart(4, "0");
    const pattern = shortName(s);
    const pad = (n) => String(n).padStart(2, "0");
    const firstOpen = sheet.hidden;

    sheetCard.style.setProperty("--rc", r.color);
    const tm = themeFor(s);
    sheet.dataset.tm = tm;
    sheetCard.innerHTML = `
      <div class="tm-bezel">
        <div class="tm-plate"><span>${TERMINALS[tm]}</span><button class="tm-swap" data-tm-swap aria-label="切换到${TERMINALS[tm === "genesis" ? "deadhand" : "genesis"]}">⇄ ${TERMINALS[tm === "genesis" ? "deadhand" : "genesis"]}</button></div>
        <div class="tm-screen">
          <header class="tm-bar">
            <button class="tm-key" data-close aria-label="断开并返回列表">[ 断开 ]</button>
            <span class="tm-path">UPLINK://军火商 ▸ ${esc(s.catName)} ▸ ${esc(s.weaponName)}</span>
            <span class="tm-led" aria-hidden="true"></span>
          </header>

          <div class="tm-page ${dir ? "turn-" + (dir > 0 ? "f" : "b") : ""}">
            <section class="tm-left" aria-label="展品扫描图">
              <div class="tm-offer">报价 <b>${pad(idx + 1)}</b><span>/ ${pad(list.length)}</span></div>
              <div class="tm-scan">
                <span class="cr tl"></span><span class="cr tr"></span><span class="cr bl"></span><span class="cr br"></span>
                <span class="tm-grid" aria-hidden="true"></span>
                ${s.img ? `<img class="tm-img" alt="${esc(s.name)}" src="${esc(img(s.img, 512))}">` : `<span class="tm-noimg">无图像信号</span>`}
                <span class="tm-sweep" aria-hidden="true"></span>
                <span class="tm-tagno">FILE ${no}</span>
              </div>
              ${variants.length > 1 ? `<div class="tm-variants" aria-label="同款其他版本">${variants.map((v) => `<button data-go="${esc(v.id)}" aria-current="${v.id === s.id}"><img alt="" loading="lazy" src="${esc(img(v.img, 128))}"><span>${esc(v.phase || "默认")}</span></button>`).join("")}</div>` : ""}
              <div class="tm-dealer"><span class="tm-who">军火商</span><p class="tm-say" data-say="${esc(dealerLine(s, avail))}"></p></div>
            </section>

            <section class="tm-right" aria-labelledby="sheet-title">
              <div class="tm-kicker">${esc(s.weaponName)}</div>
              <h2 id="sheet-title">${esc(pattern)}</h2>
              <div class="tm-en">${esc((s.en.split("|")[1] || s.en).trim())}</div>

              <dl class="tm-read">
                <dt>稀有度</dt><dd><span class="tm-meter" style="color:${r.color}">${bar(rank / meta.rarities.length, 8)}</span> ${esc(r.name)}</dd>
                <dt>磨损</dt><dd><span class="tm-meter">${"░".repeat(Math.round(min * 20))}${"▓".repeat(Math.max(1, Math.round((max - min) * 20)))}${"░".repeat(Math.max(0, 20 - Math.round(min * 20) - Math.max(1, Math.round((max - min) * 20))))}</span> ${min.toFixed(2)}–${max.toFixed(2)}</dd>
                <dt>可选外观</dt><dd class="tm-wears">${WEARS.map((w, i) => `<span class="${avail[i] ? "on" : ""}">${WEAR_SHORT[i]}</span>`).join("")}</dd>
                <dt>附加</dt><dd>${[s.st && "StatTrak™ 计数器", s.sv && "纪念品版本", s.phase && s.phase].filter(Boolean).map(esc).join(" · ") || "—"}</dd>
                ${s.pattern ? `<dt>涂装</dt><dd>${esc(s.pattern)}</dd>` : ""}
              </dl>

              ${s.desc ? `<p class="tm-desc">${esc(s.desc)}</p>` : ""}
              ${s.lore ? `<p class="tm-lore">// ${esc(s.lore)}</p>` : ""}

              <div class="tm-block"><h3>&gt; 货源</h3>
                <ul class="tm-list">
                  ${colls.map((c) => `<li><a href="#/coll/${encodeURIComponent(c.id)}">${esc(c.name)}</a></li>`).join("")}
                  ${cratesOf.slice(0, 6).map((c) => `<li><a href="#/case/${encodeURIComponent(c.id)}">${esc(c.name)}</a></li>`).join("")}
                  ${cratesOf.length > 6 ? `<li class="dim">另有 ${cratesOf.length - 6} 个武器箱</li>` : ""}
                  ${!colls.length && !cratesOf.length ? `<li class="dim">来源不明</li>` : ""}
                </ul>
              </div>

              ${sibs.length ? `<div class="tm-block"><h3>&gt; 同批货 · ${esc(sibLabel)}</h3><div class="tm-sibs">${sibs.map((x) => `<button data-go="${esc(x.id)}" style="--rc:${rc(x)}" title="${esc(x.name)}"><img alt="" loading="lazy" src="${esc(img(x.img, 128))}"><span>${esc(shortName(x))}</span></button>`).join("")}</div></div>` : ""}

              ${s.en ? `<div class="tm-block"><h3>&gt; 外部行情</h3><div class="tm-links">${WEARS.filter((w, i) => avail[i]).map((w) => `<a target="_blank" rel="noopener" href="https://steamcommunity.com/market/listings/730/${encodeURIComponent(marketName(s, w[1]))}">Steam·${w[0]}</a>`).join("")}<a target="_blank" rel="noopener" href="https://buff.163.com/market/csgo#game=csgo&page_num=1&search=${encodeURIComponent(s.name.replace("（★）", ""))}">BUFF</a></div></div>` : ""}
            </section>
          </div>

          <footer class="tm-foot">
            <button class="tm-key" data-step="-1"${idx <= 0 ? " disabled" : ""}>[ ◂ 上一份 ]</button>
            <span class="tm-hint">左右滑动翻页</span>
            <button class="tm-key primary" data-step="1"${idx >= list.length - 1 ? " disabled" : ""}>[ 下一份 ▸ ]</button>
          </footer>

          ${firstOpen && !reduceMotion ? `<div class="tm-boot" aria-hidden="true"><pre></pre></div>` : ""}
        </div>
      </div>`;

    sheet.hidden = false;
    document.body.style.overflow = "hidden";
    $(".tm-right", sheetCard).scrollTop = 0;
    sheetCard.scrollTop = 0;
    bindStage();
    if (firstOpen && !reduceMotion) boot_seq(s).then(() => typeLine());
    else typeLine();
    if (firstOpen) $("[data-close]", sheetCard).focus({ preventScroll: true });
  }

  let typeTimer = 0;
  function typeLine() {
    const el = $(".tm-say", sheetCard);
    if (!el) return;
    const text = el.dataset.say;
    clearInterval(typeTimer);
    if (reduceMotion) { el.textContent = text; return; }
    let i = 0;
    el.textContent = "";
    el.classList.add("typing");
    typeTimer = setInterval(() => {
      i += 1;
      el.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(typeTimer); el.classList.remove("typing"); }
    }, 32);
  }

  function boot_seq(s) {
    const box = $(".tm-boot", sheetCard);
    if (!box) return Promise.resolve();
    const pre = $("pre", box);
    const lines = ["> 建立上行链路 ........ OK", "> 校验军火商凭证 ...... OK", `> 调取档案 ${s.weapon.replace("weapon_", "").toUpperCase()} ... OK`, "> 连接成功。"];
    return new Promise((done) => {
      let i = 0;
      const finish = () => { clearInterval(t); box.classList.add("off"); setTimeout(() => { box.remove(); done(); }, 380); };
      const t = setInterval(() => { pre.textContent += (i ? "\n" : "") + lines[i]; i += 1; if (i >= lines.length) { clearInterval(t); setTimeout(finish, 260); } }, 170);
      box.addEventListener("click", finish, { once: true });
    });
  }

  function step(d) {
    if (!current) return;
    const list = listFor(current);
    const i = list.findIndex((x) => x.id === current.id) + d;
    if (i < 0 || i >= list.length) return;
    go(list[i], d);
  }
  function go(s, dir) {
    history.replaceState(null, "", "#/skin/" + encodeURIComponent(s.id));
    openSheet(s, dir || 0);
  }

  // swipe between offers
  let dustStop = null;
  function bindStage() {
    const page = $(".tm-page", sheetCard);
    if (!page) return;
    let sx = 0, sy = 0, t0 = 0, down = false;
    page.addEventListener("pointerdown", (e) => { if (e.target.closest("button, a")) return; down = true; sx = e.clientX; sy = e.clientY; t0 = Date.now(); });
    page.addEventListener("pointerup", (e) => {
      if (!down) return; down = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - t0 < 600) step(dx < 0 ? 1 : -1);
    });
    page.addEventListener("pointercancel", () => { down = false; });
  }

  // two terminal skins: 创世 (Genesis) and 毁灭之手 (Dead Hand)
  const TERMINALS = { genesis: "创世终端机", deadhand: "毁灭之手终端机" };
  let tmPref = "genesis";
  try { tmPref = localStorage.getItem("cs-vault-terminal") || "genesis"; } catch (e) {}
  let forced = null;
  function openSheetForced(s, tm) { forced = { id: s.id, tm }; openSheet(s, 0); }
  function themeFor(s) {
    if (forced && forced.id === s.id) return forced.tm;
    forced = null;
    if (s.coll.includes("collection-set-community-37")) return "deadhand";
    if (s.coll.includes("collection-set-community-36")) return "genesis";
    return tmPref;
  }

  function closeSheet(fromRoute) {
    if (sheet.hidden) return;
    sheet.hidden = true;
    sheet.classList.remove("lit");
    current = null;
    if (dustStop) dustStop();
    document.body.style.overflow = "";
    if (!fromRoute) location.hash = lastListHash;
  }

  sheet.addEventListener("click", (e) => {
    const g = e.target.closest("[data-go]");
    if (g) { go(byId.get(g.dataset.go)); return; }
    if (e.target.closest("[data-tm-swap]")) {
      tmPref = sheet.dataset.tm === "genesis" ? "deadhand" : "genesis";
      try { localStorage.setItem("cs-vault-terminal", tmPref); } catch (err) {}
      const keep = current; current = null; sheet.dataset.tm = tmPref;
      // re-render the same page in the other terminal without the boot sequence
      openSheetForced(keep, tmPref); return;
    }
    const st = e.target.closest("[data-step]");
    if (st) { step(+st.dataset.step); return; }
    if (e.target.closest("[data-close]")) closeSheet();
    else if (e.target.closest(".tm-list a")) { sheet.hidden = true; sheet.classList.remove("lit"); if (dustStop) dustStop(); document.body.style.overflow = ""; }
  });
  addEventListener("keydown", (e) => {
    if (sheet.hidden) return;
    if (e.key === "Escape") closeSheet();
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
  });

  boot();
})();
