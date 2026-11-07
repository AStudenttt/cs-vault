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

  // ---------- the book (军械图鉴) ----------
  const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];
  const STAMPS = { 0: "普通", 1: "普通", 2: "限制", 3: "限制", 4: "机密", 5: "绝密", 6: "绝密", 7: "违禁", 8: "违禁" };
  let flipping = false;

  function pageNo(s) { return skins.indexOf(s) + 1; }
  function fileCode(s) {
    const w = s.weapon.replace(/^weapon_(knife_)?/, "").replace(/_/g, "").toUpperCase().slice(0, 6);
    return `FM-${w}-${String(pageNo(s)).padStart(4, "0")}`;
  }

  function leftPage(s, ctx) {
    const { variants, list, idx, r } = ctx;
    return `
      <div class="bk-run"><span>${esc(s.catName)} · ${esc(s.weaponName)}</span><span>图版 ${String(idx + 1).padStart(2, "0")}</span></div>
      <figure class="bk-plate">
        <span class="tape t1" aria-hidden="true"></span><span class="tape t2" aria-hidden="true"></span>
        <div class="bk-photo" style="--rc:${r.color}">
          ${s.img ? `<img alt="${esc(s.name)}" src="${esc(img(s.img, 512))}">` : `<span class="bk-noimg">图版缺失</span>`}
        </div>
        <figcaption><b>图 ${String(idx + 1).padStart(2, "0")}</b> ${esc(s.name)}${s.phase ? `（${esc(s.phase)}）` : ""}</figcaption>
      </figure>
      ${variants.length > 1 ? `<div class="bk-strip" aria-label="同款其他版本">${variants.map((v) => `<button data-go="${esc(v.id)}" aria-current="${v.id === s.id}"><img alt="" loading="lazy" src="${esc(img(v.img, 128))}"><span>${esc(v.phase || "默认")}</span></button>`).join("")}</div>` : ""}
      <div class="bk-note"><span class="bk-note-h">军需官备注</span><p>${esc(dealerLine(s, ctx.avail))}</p></div>
      <div class="bk-folio">— ${pageNo(s) * 2} —</div>`;
  }

  function rightPage(s, ctx) {
    const { cratesOf, colls, min, max, avail, r, sibs, sibLabel, rank } = ctx;
    const stamp = STAMPS[rank] || "机密";
    return `
      <div class="bk-run"><span>${fileCode(s)}</span><span>${esc(r.name)}</span></div>
      <div class="bk-stamp" style="--sc:${r.color}" aria-hidden="true">${stamp}</div>
      <div class="bk-kicker">${esc(s.weaponName)}${s.weaponEn && s.weaponEn !== s.weaponName ? ` ／ ${esc(s.weaponEn)}` : ""}</div>
      <h2 id="sheet-title">${esc(shortName(s))}</h2>
      <div class="bk-en">${esc((s.en.split("|")[1] || s.en).trim())}</div>

      <table class="bk-form">
        <tr><th>等级</th><td><span class="bk-rank" style="--rc:${r.color}">${"■".repeat(rank)}${"□".repeat(Math.max(0, 7 - rank))}</span> ${esc(r.name)}</td></tr>
        <tr><th>磨损区间</th><td>${min.toFixed(2)} — ${max.toFixed(2)}</td></tr>
        <tr><th>可出外观</th><td class="bk-checks">${WEARS.map((w, i) => `<span class="${avail[i] ? "on" : ""}">${avail[i] ? "☒" : "☐"} ${WEAR_SHORT[i]}</span>`).join("")}</td></tr>
        <tr><th>附加</th><td>${[s.st && "StatTrak™", s.sv && "纪念品", s.phase].filter(Boolean).map(esc).join("　") || "—"}</td></tr>
        ${s.pattern ? `<tr><th>涂装</th><td>${esc(s.pattern)}</td></tr>` : ""}
      </table>

      ${s.desc ? `<p class="bk-desc">${esc(s.desc)}</p>` : ""}
      ${s.lore ? `<p class="bk-lore">“${esc(s.lore)}”</p>` : ""}

      <div class="bk-sec"><h3>来源</h3><p class="bk-src">
        ${colls.map((c) => `<a href="#/coll/${encodeURIComponent(c.id)}">${esc(c.name)}</a>`).join("、")}${colls.length && cratesOf.length ? "；" : ""}${cratesOf.slice(0, 5).map((c) => `<a href="#/case/${encodeURIComponent(c.id)}">${esc(c.name)}</a>`).join("、")}${cratesOf.length > 5 ? ` 等 ${cratesOf.length} 处` : ""}${!colls.length && !cratesOf.length ? "不详" : ""}
      </p></div>

      ${sibs.length ? `<div class="bk-sec"><h3>参见 · ${esc(sibLabel)}</h3><div class="bk-see">${sibs.slice(0, 8).map((x) => `<button data-go="${esc(x.id)}" style="--rc:${rc(x)}"><img alt="" loading="lazy" src="${esc(img(x.img, 128))}"><span>${esc(shortName(x))}</span></button>`).join("")}</div></div>` : ""}

      ${s.en ? `<div class="bk-links">${WEARS.filter((w, i) => avail[i]).map((w) => `<a target="_blank" rel="noopener" href="https://steamcommunity.com/market/listings/730/${encodeURIComponent(marketName(s, w[1]))}">Steam·${w[0]}</a>`).join("")}<a target="_blank" rel="noopener" href="https://buff.163.com/market/csgo#game=csgo&page_num=1&search=${encodeURIComponent(s.name.replace("（★）", ""))}">BUFF</a></div>` : ""}
      <div class="bk-folio">— ${pageNo(s) * 2 + 1} —</div>`;
  }

  function context(s) {
    const list = listFor(s);
    const min = s.min ?? 0, max = s.max ?? 1;
    const r = rarityById[s.rarity] || { name: "", color: "#6b6f5e" };
    const [sibLabel, sibs] = siblings(s);
    return {
      list, idx: list.findIndex((x) => x.id === s.id),
      variants: skins.filter((x) => x.name === s.name),
      cratesOf: s.crates.map((id) => crateById.get(id)).filter(Boolean),
      colls: s.coll.map((id) => meta.collections[id]).filter(Boolean),
      min, max, avail: WEARS.map((w) => w[3] > min && w[2] < max), r,
      rank: (rarityRank[s.rarity] ?? 0) + 1, sibLabel, sibs,
    };
  }

  const wide = () => matchMedia("(min-width: 1000px) and (min-aspect-ratio: 1/1)").matches;

  function openSheet(s, dir) {
    const firstOpen = sheet.hidden;
    const prevLeft = $(".bk-left", sheetCard), prevRight = $(".bk-right", sheetCard);
    const oldL = prevLeft ? prevLeft.innerHTML : "", oldR = prevRight ? prevRight.innerHTML : "";
    current = s;
    const ctx = context(s);
    const { list, idx } = ctx;

    sheetCard.innerHTML = `
      <div class="bk-desk">
        <div class="bk-top">
          <button class="bk-btn" data-close aria-label="合上书，返回列表">✕ 合上</button>
          <span class="bk-title">CS 饰品馆 · 军械图鉴</span>
          <span class="bk-pos">${idx + 1} / ${list.length}</span>
        </div>
        <div class="bk-book">
          <div class="bk-spread">
            <section class="bk-page bk-left" aria-label="图版">${leftPage(s, ctx)}</section>
            <section class="bk-page bk-right" aria-label="档案">${rightPage(s, ctx)}</section>
          </div>
          <button class="bk-corner prev" data-step="-1" aria-label="上一页"${idx <= 0 ? " disabled" : ""}><span>‹</span></button>
          <button class="bk-corner next" data-step="1" aria-label="下一页"${idx >= list.length - 1 ? " disabled" : ""}><span>›</span></button>
        </div>
        <p class="bk-hint">左右滑动或点书角翻页</p>
      </div>`;

    sheet.hidden = false;
    document.body.style.overflow = "hidden";
    $(".bk-right", sheetCard).scrollTop = 0;
    bindStage();
    if (firstOpen) {
      if (!reduceMotion) openCover();
      $("[data-close]", sheetCard).focus({ preventScroll: true });
    } else if (dir && !reduceMotion) {
      flip(dir, oldL, oldR);
    }
  }

  // a page leaf turns over: front is the old page, back is the new one
  function flip(dir, oldL, oldR) {
    const book = $(".bk-book", sheetCard), spread = $(".bk-spread", sheetCard);
    const L = $(".bk-left", sheetCard), R = $(".bk-right", sheetCard);
    if (!wide()) {
      spread.classList.add(dir > 0 ? "slide-f" : "slide-b");
      return;
    }
    flipping = true;
    const leaf = document.createElement("div");
    leaf.className = "bk-leaf " + (dir > 0 ? "fwd" : "back");
    leaf.innerHTML = dir > 0
      ? `<div class="face front bk-page bk-right">${oldR}</div><div class="face backside bk-page bk-left">${L.innerHTML}</div>`
      : `<div class="face front bk-page bk-left">${oldL}</div><div class="face backside bk-page bk-right">${R.innerHTML}</div>`;
    const under = dir > 0 ? L : R;          // the page the leaf lands on stays hidden until it lands
    const keep = dir > 0 ? oldL : oldR;     // and shows the old content meanwhile
    const fresh = under.innerHTML;
    under.innerHTML = keep;
    book.appendChild(leaf);
    leaf.addEventListener("animationend", () => { under.innerHTML = fresh; leaf.remove(); flipping = false; }, { once: true });
  }

  function openCover() {
    const book = $(".bk-book", sheetCard);
    if (!wide()) { book.classList.add("rise"); return; }
    const cover = document.createElement("div");
    cover.className = "bk-cover";
    cover.innerHTML = `<div class="face front"><div class="bk-cover-in"><span class="bk-cover-top">机密 · 限内部传阅</span><b>军械图鉴</b><span class="bk-cover-sub">COUNTER-STRIKE 2 · 饰品档案</span><span class="bk-cover-no">卷 ${ROMAN[Math.min(9, (rarityRank[current.rarity] ?? 0) + 1)] || "I"}</span></div></div><div class="face backside"></div>`;
    book.appendChild(cover);
    cover.addEventListener("animationend", () => cover.remove(), { once: true });
  }

  function step(d) {
    if (!current || flipping) return;
    const list = listFor(current);
    const i = list.findIndex((x) => x.id === current.id) + d;
    if (i < 0 || i >= list.length) return;
    go(list[i], d);
  }
  function go(s, dir) {
    history.replaceState(null, "", "#/skin/" + encodeURIComponent(s.id));
    openSheet(s, dir || 0);
  }

  let dustStop = null;
  function bindStage() {
    const book = $(".bk-book", sheetCard);
    if (!book) return;
    let sx = 0, sy = 0, t0 = 0, down = false;
    book.addEventListener("pointerdown", (e) => { if (e.target.closest("button, a")) return; down = true; sx = e.clientX; sy = e.clientY; t0 = Date.now(); });
    book.addEventListener("pointerup", (e) => {
      if (!down) return; down = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - t0 < 600) step(dx < 0 ? 1 : -1);
    });
    book.addEventListener("pointercancel", () => { down = false; });
  }

  function closeSheet(fromRoute) {
    if (sheet.hidden) return;
    sheet.hidden = true;
    current = null;
    flipping = false;
    document.body.style.overflow = "";
    if (!fromRoute) location.hash = lastListHash;
  }

  sheet.addEventListener("click", (e) => {
    const g = e.target.closest("[data-go]");
    if (g) { go(byId.get(g.dataset.go), 1); return; }
    const st = e.target.closest("[data-step]");
    if (st) { step(+st.dataset.step); return; }
    if (e.target.closest("[data-close]")) closeSheet();
    else if (e.target.closest(".bk-src a")) { sheet.hidden = true; current = null; document.body.style.overflow = ""; }
  });
  addEventListener("keydown", (e) => {
    if (sheet.hidden) return;
    if (e.key === "Escape") closeSheet();
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
  });

  boot();
})();
