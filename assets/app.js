(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const view = $("#view");
  const sheet = $("#sheet");
  const sheetCard = $(".sheet-card", sheet);
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
    view.innerHTML = `<div class="wrap">
      <nav class="crumb"><a href="#/cases">武器箱</a></nav>
      <div class="head"><div><h1>${esc(c.name)}</h1><div class="en">${esc(c.en)}</div></div><span class="n">${esc(c.date || "")}</span></div>
      ${tiers.map(([r, l]) => `<div class="tier" style="--rc:${r.color}"><i></i>${esc(r.name)}<span>${l.length}</span></div><div class="grid">${l.map(card).join("")}</div>`).join("")}
      ${rare.length ? `<div class="tier" style="--rc:#e4ae39"><i></i>★ 稀有特殊物品<span>${rare.length}</span></div><div class="grid">${rare.map(card).join("")}</div>` : ""}
    </div>`;
  }

  // ---------- detail sheet ----------
  function marketName(s, wear) {
    let n = s.en || "";
    if (s.st && wear) n = n.startsWith("★ ") ? n.replace("★ ", "★ StatTrak™ ") : "StatTrak™ " + n;
    return wear ? `${n} (${wear})` : n;
  }

  function openSheet(s) {
    const variants = skins.filter((x) => x.name === s.name);
    const cratesOf = s.crates.map((id) => crateById.get(id)).filter(Boolean);
    const colls = s.coll.map((id) => meta.collections[id]).filter(Boolean);
    const min = s.min ?? 0, max = s.max ?? 1;
    const avail = WEARS.map((w) => w[3] > min && w[2] < max);
    const r = rarityById[s.rarity] || { name: "", color: "#888" };

    sheetCard.style.setProperty("--rc", r.color);
    sheetCard.innerHTML = `
      <button class="close" data-close aria-label="关闭">×</button>
      <div class="stage">${s.img ? `<img alt="${esc(s.name)}" src="${esc(img(s.img, 512))}">` : `<span class="noimg">暂无图片</span>`}</div>
      <div class="info">
        <div><h2 id="sheet-title">${esc(s.name)}</h2><div class="en">${esc(s.en)}</div></div>
        <div class="rline"><span class="rpill"><i></i>${esc(r.name)}</span>${s.st ? `<span class="badge st">StatTrak™</span>` : ""}${s.sv ? `<span class="badge sv">纪念品</span>` : ""}${s.phase ? `<span class="badge">${esc(s.phase)}</span>` : ""}</div>
        ${variants.length > 1 ? `<div class="variants" aria-label="同款其他版本">${variants.map((v) => `<button data-go="${esc(v.id)}" aria-current="${v.id === s.id}"><img alt="" src="${esc(img(v.img, 128))}">${esc(v.phase || "默认")}</button>`).join("")}</div>` : ""}
        ${s.desc ? `<p>${esc(s.desc)}</p>` : ""}
        ${s.lore ? `<p class="lore">${esc(s.lore)}</p>` : ""}
        <div class="wear">
          <div class="wear-bar" aria-label="可出外观">${WEAR_SHORT.map((w, i) => `<span class="${avail[i] ? "on" : ""}">${w}</span>`).join("")}</div>
          <div class="range">磨损区间 ${min.toFixed(2)} – ${max.toFixed(2)}</div>
        </div>
        <dl class="kv">
          <dt>武器</dt><dd><a href="#/w/${encodeURIComponent(s.weapon)}">${esc(s.weaponName)}</a></dd>
          ${colls.length ? `<dt>收藏品</dt><dd>${colls.map((c) => `<a href="#/coll/${encodeURIComponent(c.id)}">${esc(c.name)}</a>`).join("、")}</dd>` : ""}
          ${cratesOf.length ? `<dt>出自</dt><dd>${cratesOf.slice(0, 6).map((c) => `<a href="#/case/${encodeURIComponent(c.id)}">${esc(c.name)}</a>`).join("、")}${cratesOf.length > 6 ? ` 等 ${cratesOf.length} 个` : ""}</dd>` : ""}
          ${s.pattern ? `<dt>涂装</dt><dd>${esc(s.pattern)}</dd>` : ""}
        </dl>
        ${s.en ? `<div class="links">${WEARS.filter((w, i) => avail[i]).map((w) => `<a target="_blank" rel="noopener" href="https://steamcommunity.com/market/listings/730/${encodeURIComponent(marketName({ ...s, st: false }, w[1]))}">Steam · ${w[0]}</a>`).join("")}
          <a target="_blank" rel="noopener" href="https://buff.163.com/market/csgo#game=csgo&page_num=1&search=${encodeURIComponent(s.name.replace("（★）", ""))}">BUFF 搜索</a></div>` : ""}
      </div>`;
    sheet.hidden = false;
    document.body.style.overflow = "hidden";
    sheetCard.scrollTop = 0;
    $(".close", sheetCard).focus({ preventScroll: true });
  }

  function closeSheet(fromRoute) {
    if (sheet.hidden) return;
    sheet.hidden = true;
    document.body.style.overflow = "";
    if (!fromRoute) location.hash = lastListHash;
  }

  sheet.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) { history.replaceState(null, "", "#/skin/" + encodeURIComponent(go.dataset.go)); openSheet(byId.get(go.dataset.go)); return; }
    if (e.target.closest("[data-close]")) closeSheet();
    else if (e.target.closest(".kv a")) { sheet.hidden = true; document.body.style.overflow = ""; }
  });
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

  boot();
})();
