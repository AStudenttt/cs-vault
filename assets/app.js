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
    const [sibLabel, sibs] = siblings(s);
    const no = String(skins.indexOf(s) + 1).padStart(4, "0");
    const pattern = shortName(s);

    sheetCard.style.setProperty("--rc", r.color);
    sheetCard.innerHTML = `
      <div class="vt-top">
        <button class="vt-btn" data-close aria-label="返回列表"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5L7 10l5.5 5.5"/></svg><span>返回</span></button>
        <span class="vt-no">展品 No.${no}</span>
        <span class="vt-pager">
          <span class="vt-count">${idx + 1} / ${list.length}</span>
          <button class="vt-btn" data-step="-1" aria-label="上一件"${idx <= 0 ? " disabled" : ""}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5L7 10l5.5 5.5"/></svg></button>
          <button class="vt-btn" data-step="1" aria-label="下一件"${idx >= list.length - 1 ? " disabled" : ""}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5L13 10l-5.5 5.5"/></svg></button>
        </span>
      </div>
      <section class="vt-stage" aria-label="展品图像">
        <div class="beam" aria-hidden="true"></div>
        <canvas class="dust" aria-hidden="true"></canvas>
        <div class="plinth" aria-hidden="true"></div>
        <div class="obj ${dir ? "enter-" + (dir > 0 ? "r" : "l") : "enter"}">
          <div class="tilt">
            ${s.img ? `<img class="main" alt="${esc(s.name)}" src="${esc(img(s.img, 512))}"><span class="sheen" aria-hidden="true" style="--m:url('${esc(img(s.img, 512))}')"></span>` : `<span class="noimg">暂无图片</span>`}
          </div>
          ${s.img ? `<img class="refl" alt="" aria-hidden="true" src="${esc(img(s.img, 512))}">` : ""}
        </div>
        <p class="vt-hint" aria-hidden="true">拖动或移动指针旋转 · 左右滑动换展品</p>
      </section>
      <aside class="vt-label">
        <div class="eyebrow">${esc(s.catName)} <i></i> ${esc(s.weaponName)}</div>
        <h2 id="sheet-title">${esc(pattern)}</h2>
        <div class="vt-en">${esc((s.en.split("|")[1] || s.en).trim())}</div>
        <div class="vt-rar"><span class="dot"></span>${esc(r.name)}${s.phase ? `<span class="tag">${esc(s.phase)}</span>` : ""}${s.st ? `<span class="tag st">StatTrak™</span>` : ""}${s.sv ? `<span class="tag sv">纪念品</span>` : ""}</div>

        ${variants.length > 1 ? `<div class="vt-sec"><h3>版本</h3><div class="vt-variants">${variants.map((v) => `<button data-go="${esc(v.id)}" aria-current="${v.id === s.id}"><img alt="" loading="lazy" src="${esc(img(v.img, 128))}"><span>${esc(v.phase || "默认")}</span></button>`).join("")}</div></div>` : ""}

        ${s.desc || s.lore ? `<div class="vt-sec">${s.desc ? `<p class="vt-desc">${esc(s.desc)}</p>` : ""}${s.lore ? `<blockquote class="vt-lore">${esc(s.lore)}</blockquote>` : ""}</div>` : ""}

        <div class="vt-sec"><h3>外观</h3>
          <div class="spectrum" aria-label="磨损区间 ${min.toFixed(2)} 至 ${max.toFixed(2)}">
            <div class="spec-bar"><b style="left:${min * 100}%;width:${(max - min) * 100}%"></b></div>
            <div class="spec-ticks">${WEARS.map((w, i) => `<span class="${avail[i] ? "on" : ""}" style="left:${((w[2] + w[3]) / 2) * 100}%">${WEAR_SHORT[i]}</span>`).join("")}</div>
          </div>
          <div class="spec-range"><span>磨损 ${min.toFixed(2)}</span><span>${max.toFixed(2)}</span></div>
        </div>

        <div class="vt-sec"><h3>来源</h3>
          <dl class="vt-kv">
            <dt>武器</dt><dd><a href="#/w/${encodeURIComponent(s.weapon)}">${esc(s.weaponName)}</a></dd>
            ${colls.length ? `<dt>收藏品</dt><dd>${colls.map((c) => `<a href="#/coll/${encodeURIComponent(c.id)}">${esc(c.name)}</a>`).join("、")}</dd>` : ""}
            ${s.pattern ? `<dt>涂装</dt><dd>${esc(s.pattern)}</dd>` : ""}
          </dl>
          ${cratesOf.length ? `<div class="vt-crates">${cratesOf.slice(0, 8).map((c) => `<a href="#/case/${encodeURIComponent(c.id)}"><img alt="" loading="lazy" src="${esc(img(c.img, 128))}"><span>${esc(c.name)}</span></a>`).join("")}</div>${cratesOf.length > 8 ? `<p class="vt-more">另有 ${cratesOf.length - 8} 个武器箱</p>` : ""}` : ""}
        </div>

        ${sibs.length ? `<div class="vt-sec"><h3>同展区 · ${esc(sibLabel)}</h3><div class="vt-sibs">${sibs.map((x) => `<button data-go="${esc(x.id)}" style="--rc:${rc(x)}" title="${esc(x.name)}"><img alt="" loading="lazy" src="${esc(img(x.img, 128))}"><span>${esc(shortName(x))}</span></button>`).join("")}</div></div>` : ""}

        ${s.en ? `<div class="vt-links">${WEARS.filter((w, i) => avail[i]).map((w) => `<a target="_blank" rel="noopener" href="https://steamcommunity.com/market/listings/730/${encodeURIComponent(marketName(s, w[1]))}">Steam · ${w[0]}</a>`).join("")}<a target="_blank" rel="noopener" href="https://buff.163.com/market/csgo#game=csgo&page_num=1&search=${encodeURIComponent(s.name.replace("（★）", ""))}">BUFF 搜索</a></div>` : ""}
      </aside>`;

    const wasHidden = sheet.hidden;
    sheet.hidden = false;
    document.body.style.overflow = "hidden";
    if (wasHidden) { sheet.classList.remove("lit"); requestAnimationFrame(() => requestAnimationFrame(() => sheet.classList.add("lit"))); }
    $(".vt-label", sheetCard).scrollTop = 0;
    sheetCard.scrollTop = 0;
    bindStage();
    if (wasHidden) $("[data-close]", sheetCard).focus({ preventScroll: true });
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

  // pointer tilt, swipe, and drifting dust in the light beam
  let dustStop = null;
  function bindStage() {
    const stage = $(".vt-stage", sheetCard);
    const tilt = $(".tilt", sheetCard);
    if (!stage || !tilt) return;
    let sx = 0, sy = 0, t0 = 0, dragging = false;
    const setTilt = (x, y) => {
      tilt.style.setProperty("--ry", (x * 22).toFixed(2) + "deg");
      tilt.style.setProperty("--rx", (-y * 12).toFixed(2) + "deg");
      tilt.style.setProperty("--sx", (50 + x * 60).toFixed(1) + "%");
    };
    const rel = (e) => { const b = stage.getBoundingClientRect(); return [((e.clientX - b.left) / b.width - 0.5) * 2, ((e.clientY - b.top) / b.height - 0.5) * 2]; };
    stage.addEventListener("pointermove", (e) => {
      if (reduceMotion) return;
      if (e.pointerType === "mouse" || dragging) { const [x, y] = rel(e); setTilt(Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))); }
    });
    stage.addEventListener("pointerleave", () => setTilt(0, 0));
    stage.addEventListener("pointerdown", (e) => { dragging = true; sx = e.clientX; sy = e.clientY; t0 = Date.now(); });
    const end = (e) => {
      if (!dragging) return; dragging = false; setTilt(0, 0);
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - t0 < 600) step(dx < 0 ? 1 : -1);
    };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", () => { dragging = false; setTilt(0, 0); });
    startDust($(".dust", sheetCard));
  }

  function startDust(cv) {
    if (dustStop) dustStop();
    if (!cv || reduceMotion) return;
    const ctx = cv.getContext("2d");
    let w = 0, h = 0, raf = 0, alive = true;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const size = () => { const b = cv.getBoundingClientRect(); w = b.width; h = b.height; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    const motes = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), r: 0.4 + Math.random() * 1.4, v: 0.00008 + Math.random() * 0.00022, p: Math.random() * 6.28 }));
    let last = performance.now();
    const frame = (now) => {
      if (!alive) return;
      const dt = Math.min(50, now - last); last = now;
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y -= m.v * dt; m.p += dt * 0.0012;
        if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
        const px = (0.5 + (m.x - 0.5) * (0.25 + (1 - m.y) * 0.5)) * w + Math.sin(m.p) * 6;
        const inBeam = 1 - Math.abs(m.x - 0.5) * 2;
        ctx.globalAlpha = 0.08 + 0.32 * inBeam * (0.5 + 0.5 * Math.sin(m.p * 1.7));
        ctx.fillStyle = "#fff4e0";
        ctx.beginPath(); ctx.arc(px, m.y * h, m.r, 0, 6.283); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    addEventListener("resize", size);
    dustStop = () => { alive = false; cancelAnimationFrame(raf); removeEventListener("resize", size); dustStop = null; };
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
    const st = e.target.closest("[data-step]");
    if (st) { step(+st.dataset.step); return; }
    if (e.target.closest("[data-close]")) closeSheet();
    else if (e.target.closest(".vt-kv a, .vt-crates a")) { sheet.hidden = true; sheet.classList.remove("lit"); if (dustStop) dustStop(); document.body.style.overflow = ""; }
  });
  addEventListener("keydown", (e) => {
    if (sheet.hidden) return;
    if (e.key === "Escape") closeSheet();
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
  });

  boot();
})();
