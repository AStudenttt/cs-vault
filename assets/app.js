(() => {
  "use strict";

  // ===== constants =====
  const $ = (s, el = document) => el.querySelector(s);
  const app = $("#app");
  const CAT_ORDER = ["匕首", "手套", "步枪", "手枪", "微型冲锋枪", "重型武器", "装备"];
  const CAT_EN = { "匕首": "KNIVES", "手套": "GLOVES", "步枪": "RIFLES", "手枪": "PISTOLS", "微型冲锋枪": "SMGS", "重型武器": "HEAVY", "装备": "EQUIPMENT" };
  // colour buckets computed from each skin's image at build time (scripts/build_data.py)
  const COLORS = [
    ["red", "红", "#c8382f"], ["orange", "橙", "#e07f2a"], ["yellow", "黄", "#e2bb36"], ["green", "绿", "#4f9a4f"],
    ["cyan", "青", "#2ea9a3"], ["blue", "蓝", "#3a6fcf"], ["purple", "紫", "#8455c9"], ["pink", "粉", "#de76ad"],
    ["brown", "棕", "#7e5532"], ["black", "黑", "#1c1f22"], ["gray", "灰", "#8a9096"], ["white", "白", "#eceee9"],
  ];
  const colorById = Object.fromEntries(COLORS.map((c) => [c[0], c]));
  let hasColors = false;
  const TAB_SHORT = { "微型冲锋枪": "冲锋枪", "重型武器": "重武器" };
  const CN_NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  const WEARS = [
    ["崭新出厂", "Factory New", 0, 0.07], ["略有磨损", "Minimal Wear", 0.07, 0.15],
    ["久经沙场", "Field-Tested", 0.15, 0.38], ["破损不堪", "Well-Worn", 0.38, 0.45],
    ["战痕累累", "Battle-Scarred", 0.45, 1],
  ];
  const WEAR_SHORT = ["崭新", "略磨", "久经", "破损", "战痕"];
  const STAMPS = { 1: "普通", 2: "普通", 3: "限制", 4: "限制", 5: "机密", 6: "绝密", 7: "绝密", 8: "违禁", 9: "违禁" };
  const PER_PAGE = 12;        // photos per page on an index sheet
  const ROWS_PER_PAGE = 13;   // rows per page on a list (cases, collections)
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wideQuery = matchMedia("(min-width: 1000px) and (min-aspect-ratio: 1/1)");

  // ===== data =====
  let skins = [], byId = new Map(), crates = [], crateById = new Map(), meta = null;
  let rarityRank = {}, rarityById = {};
  let cats = [];
  const weaponById = new Map();

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const img = (url, size) => (url ? `${url}/${size}fx${size}f` : "");
  const rc = (s) => (rarityById[s.rarity] || {}).color || "#8c949c";
  const shortName = (s) => (s.name.split("|")[1] || s.name).trim();
  const byRarity = (a, b) => (rarityRank[b.rarity] - rarityRank[a.rarity]) || a.name.localeCompare(b.name, "zh");
  const pad2 = (n) => String(n).padStart(2, "0");
  const chapterNo = (i) => CN_NUM[i] || String(i + 1);
  const enc = encodeURIComponent;

  async function boot() {
    try {
      const [a, b, c] = await Promise.all(["skins", "crates", "meta"].map((n) => fetch(`data/${n}.json`).then((r) => { if (!r.ok) throw new Error(n); return r.json(); })));
      skins = a; crates = b; meta = c;
    } catch (e) {
      app.innerHTML = `<p class="bk-fail">图鉴没有载入成功，请刷新页面重试。</p>`;
      return;
    }
    meta.rarities.forEach((r, i) => { rarityRank[r.id] = i; rarityById[r.id] = r; });
    skins.forEach((s) => byId.set(s.id, s));
    hasColors = skins.some((s) => s.colors && s.colors.length);
    crates.forEach((c) => crateById.set(c.id, c));
    const catMap = new Map();
    skins.forEach((s) => {
      if (!catMap.has(s.catName)) catMap.set(s.catName, new Map());
      const wm = catMap.get(s.catName);
      if (!wm.has(s.weapon)) wm.set(s.weapon, { id: s.weapon, name: s.weaponName, en: s.weaponEn, cat: s.catName, list: [] });
      wm.get(s.weapon).list.push(s);
    });
    cats = [...catMap.entries()]
      .sort((a, b) => ((CAT_ORDER.indexOf(a[0]) + 99) % 99) - ((CAT_ORDER.indexOf(b[0]) + 99) % 99))
      .map(([name, wm]) => {
        const weapons = [...wm.values()].sort((a, b) => b.list.length - a.list.length);
        weapons.forEach((w) => { w.list.sort(byRarity); weaponById.set(w.id, w); });
        return { name, en: CAT_EN[name] || "", weapons, count: weapons.reduce((n, w) => n + w.list.length, 0) };
      });
    shell();
    addEventListener("hashchange", () => route(false));
    if (wideQuery.addEventListener) wideQuery.addEventListener("change", () => route(true));
    route(true);
  }

  // ===== page pieces =====
  function best(list) { return list.slice().sort((a, b) => (rarityRank[b.rarity] - rarityRank[a.rarity]) || (a.phase ? 1 : 0) - (b.phase ? 1 : 0))[0]; }
  const run = (l, r) => `<div class="bk-run"><span>${l}</span><span>${r}</span></div>`;
  const folio = (n) => `<div class="bk-folio">— ${n} —</div>`;
  const photoCell = (s) => `<a class="bk-cell" href="#/skin/${enc(s.id)}" style="--rc:${rc(s)}">
      <span class="bk-cell-photo">${s.img ? `<img loading="lazy" alt="" src="${esc(img(s.img, 256))}">` : ""}</span>
      <span class="bk-cell-cap"><i></i><span>${esc(shortName(s))}</span>${s.phase ? `<small>${esc(s.phase)}</small>` : ""}</span></a>`;

  function hashOf(str) { let h = 2166136261; for (const c of str) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; }
  const pick = (list, seed) => list[seed % list.length];
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

  const swatch = (id, href, on, attrs = "") => { const c = colorById[id]; return c ? `<a class="bk-sw${on ? " on" : ""}" href="${href}" style="--sw:${c[2]}" title="${c[1]}" aria-label="${c[1]}色"${on ? ' aria-current="true"' : ""} ${attrs}><span>${c[1]}</span></a>` : ""; };

  // ===== spreads =====
  function coverFace() {
    return `<button class="bk-cover-face" data-open aria-label="翻开图鉴">
      <span class="bk-cover-in">
        <span class="bk-cover-top">机密 · 限内部传阅</span>
        <b>军械图鉴</b>
        <span class="bk-cover-sub">COUNTER-STRIKE 2 · 饰品档案</span>
        <span class="bk-cover-stats">收录 ${skins.length.toLocaleString()} 件 · ${weaponById.size} 种武器 · ${crates.length} 个武器箱</span>
      </span>
      <span class="bk-cover-open">翻开 ▸</span>
    </button>`;
  }

  function tocSpread() {
    const left = `${run("卷首", "军械图鉴")}
      <div class="bk-front">
        <h2 class="bk-h">卷首说明</h2>
        <p class="bk-p">本册收录 Counter-Strike 2 全部武器、刀具与手套涂装共 ${skins.length.toLocaleString()} 件，按武器类别分为 ${cats.length} 章；武器箱与收藏品另列于附录。每件展品附图版一幅、档案一页。</p>
        <h3 class="bk-h3">查阅方法</h3>
        <ul class="bk-ul"><li>点目录中的章节进入，逐级查到单件展品</li><li>点书角或左右滑动翻页，书签和顶部路径可直接跳转</li><li>知道名字的，直接在下方检索</li></ul>
        <form class="bk-search" data-search role="search"><label for="bk-q">检索</label><input id="bk-q" name="q" type="search" placeholder="皮肤、武器或英文名，如 AK 火神" autocomplete="off"><button type="submit">查</button></form>
        ${hasColors ? `<div class="bk-colors"><span class="bk-colors-h">按颜色检索</span><div class="bk-sws">${COLORS.map((c) => swatch(c[0], `#/color/${c[0]}/all/0`, false)).join("")}</div><p class="bk-colors-tip">先选主色，结果页里可再加一色或限定类别。</p></div>` : ""}
        <div class="bk-imprint"><b>出版说明</b>数据取自 ByMykel/CSGO-API，图片来自 Steam，每周更新。本册与 Valve 无关，Counter-Strike 及相关素材版权归 Valve Corporation 所有。</div>
      </div>${folio("i")}`;
    const rows = cats.map((c, i) => `<a class="bk-toc-row" href="#/c/${enc(c.name)}"><span class="no">第${chapterNo(i)}章</span><span class="t">${esc(c.name)}<small>${c.en}</small></span><span class="dots"></span><span class="n">${c.count}</span></a>`).join("");
    const right = `${run("目录", "CONTENTS")}
      <h2 class="bk-h bk-toc-h">目　录</h2>
      <nav class="bk-toc" aria-label="目录">${rows}
        <div class="bk-toc-gap"></div>
        <a class="bk-toc-row" href="#/cases"><span class="no">附录甲</span><span class="t">武器箱<small>CASES</small></span><span class="dots"></span><span class="n">${crates.length}</span></a>
        <a class="bk-toc-row" href="#/colls"><span class="no">附录乙</span><span class="t">收藏品<small>COLLECTIONS</small></span><span class="dots"></span><span class="n">${Object.keys(meta.collections).length}</span></a>
      </nav>${folio("ii")}`;
    return { left, right };
  }

  function chapterSpread(ci) {
    const c = cats[ci];
    const hero = best(c.weapons.flatMap((w) => w.list));
    const left = `${run(`第${chapterNo(ci)}章`, c.en)}
      <div class="bk-chapter">
        <span class="bk-ch-no">第${chapterNo(ci)}章</span>
        <h2 class="bk-ch-title">${esc(c.name)}</h2>
        <span class="bk-ch-en">${c.en}</span>
        <figure class="bk-ch-plate"><span class="tape t1" aria-hidden="true"></span><span class="bk-photo" style="--rc:${rc(hero)}">${hero.img ? `<img alt="" src="${esc(img(hero.img, 512))}">` : ""}</span><figcaption>卷首图　${esc(hero.name)}</figcaption></figure>
        <p class="bk-ch-meta">本章收录 ${c.weapons.length} 种${esc(c.name)}，共 ${c.count} 件涂装。</p>
      </div>${folio(`${chapterNo(ci)}·1`)}`;
    const right = `${run(esc(c.name), "武器索引")}
      <h2 class="bk-h">武器索引</h2>
      <nav class="bk-index">${c.weapons.map((w) => { const b = best(w.list); return `<a class="bk-idx-row" href="#/w/${enc(w.id)}"><span class="th" style="--rc:${rc(b)}">${b.img ? `<img loading="lazy" alt="" src="${esc(img(b.img, 128))}">` : ""}</span><span class="t">${esc(w.name)}${w.en && w.en !== w.name ? `<small>${esc(w.en)}</small>` : ""}</span><span class="dots"></span><span class="n">${w.list.length}</span></a>`; }).join("")}</nav>
      ${folio(`${chapterNo(ci)}·2`)}`;
    return { left, right };
  }

  function sheetSpread({ title, sub, list, base, page, runLabel, extra }) {
    const per = PER_PAGE * 2;
    const pages = Math.max(1, Math.ceil(list.length / per));
    const p = Math.min(page, pages - 1);
    const from = p * per;
    const a = list.slice(from, from + PER_PAGE), b = list.slice(from + PER_PAGE, from + per);
    const range = list.length ? `第 ${from + 1}–${Math.min(list.length, from + per)} 件 / 共 ${list.length}` : "无结果";
    const left = `${run(esc(runLabel || title), "图版索引")}
      <div class="bk-sheet-head"><h2 class="bk-h">${esc(title)}</h2>${sub ? `<span>${esc(sub)}</span>` : ""}</div>
      ${extra || ""}
      ${list.length ? `<div class="bk-grid">${a.map(photoCell).join("")}</div>` : `<p class="bk-empty">没有查到。可以试试武器名、皮肤名或英文名，比如“AK 火神”或“Doppler”。</p>`}
      ${folio(p * 2 + 1)}`;
    const right = `${run(range, pages > 1 ? `${p + 1} / ${pages} 页` : "")}
      <div class="bk-grid">${b.map(photoCell).join("")}</div>
      ${!b.length && list.length ? `<p class="bk-end">— 本节完 —</p>` : ""}
      ${folio(p * 2 + 2)}`;
    return { left, right, rightEmpty: !b.length, page: p, prev: p > 0 ? `${base}/${p - 1}` : null, next: p < pages - 1 ? `${base}/${p + 1}` : null, pos: pages > 1 ? `${p + 1} / ${pages}` : "" };
  }

  function listSpread({ title, en, rows, base, page }) {
    const per = ROWS_PER_PAGE * 2;
    const pages = Math.max(1, Math.ceil(rows.length / per));
    const p = Math.min(page, pages - 1);
    const from = p * per;
    const a = rows.slice(from, from + ROWS_PER_PAGE), b = rows.slice(from + ROWS_PER_PAGE, from + per);
    const left = `${run(title, en)}<div class="bk-sheet-head"><h2 class="bk-h">${title}</h2><span>共 ${rows.length}</span></div><nav class="bk-index">${a.join("")}</nav>${folio(`附·${p * 2 + 1}`)}`;
    const right = `${run(`第 ${from + 1}–${Math.min(rows.length, from + per)} 项`, pages > 1 ? `${p + 1} / ${pages} 页` : "")}<nav class="bk-index">${b.join("")}</nav>${folio(`附·${p * 2 + 2}`)}`;
    return { left, right, rightEmpty: !b.length, page: p, prev: p > 0 ? `${base}/${p - 1}` : null, next: p < pages - 1 ? `${base}/${p + 1}` : null, pos: pages > 1 ? `${p + 1} / ${pages}` : "" };
  }
  const caseRow = (c) => `<a class="bk-idx-row" href="#/case/${enc(c.id)}"><span class="th">${c.img ? `<img loading="lazy" alt="" src="${esc(img(c.img, 128))}">` : ""}</span><span class="t">${esc(c.name)}<small>${esc(c.date || "")}</small></span><span class="dots"></span><span class="n">${c.items.length}</span></a>`;
  // a collection is shown by its rarest skin; the set's own icon is the fallback
  const collRow = (c, n) => {
    const top = best(skins.filter((s) => s.coll.includes(c.id)));
    const pic = top && top.img ? img(top.img, 128) : c.img;
    return `<a class="bk-idx-row" href="#/coll/${enc(c.id)}"><span class="th"${top ? ` style="--rc:${rc(top)}"` : ""}>${pic ? `<img loading="lazy" alt="" src="${esc(pic)}">` : ""}</span><span class="t">${esc(c.name)}</span><span class="dots"></span><span class="n">${n}</span></a>`;
  };

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
    return [label, pool.slice(0, 8)];
  }
  const fileCode = (s) => `FM-${s.weapon.replace(/^weapon_(knife_)?/, "").replace(/_/g, "").toUpperCase().slice(0, 6)}-${String(skins.indexOf(s) + 1).padStart(4, "0")}`;

  function itemSpread(s, list) {
    const idx = list.indexOf(s);
    const variants = skins.filter((x) => x.name === s.name);
    const cratesOf = s.crates.map((id) => crateById.get(id)).filter(Boolean);
    const colls = s.coll.map((id) => meta.collections[id]).filter(Boolean);
    const min = s.min ?? 0, max = s.max ?? 1;
    const avail = WEARS.map((w) => w[3] > min && w[2] < max);
    const r = rarityById[s.rarity] || { name: "", color: "#6b6f5e" };
    const rank = (rarityRank[s.rarity] ?? 0) + 1;
    const [sibLabel, sibs] = siblings(s);
    const n = skins.indexOf(s) + 1;
    const left = `${run(`${esc(s.catName)} · ${esc(s.weaponName)}`, `图版 ${pad2(idx + 1)}`)}
      <figure class="bk-plate">
        <span class="tape t1" aria-hidden="true"></span><span class="tape t2" aria-hidden="true"></span>
        <div class="bk-photo" style="--rc:${r.color}">${s.img ? `<img alt="${esc(s.name)}" src="${esc(img(s.img, 512))}">` : `<span class="bk-noimg">图版缺失</span>`}</div>
        <figcaption><b>图 ${pad2(idx + 1)}</b> ${esc(s.name)}${s.phase ? `（${esc(s.phase)}）` : ""}</figcaption>
      </figure>
      ${variants.length > 1 ? `<div class="bk-strip" aria-label="同款其他版本">${variants.map((v) => `<a href="#/skin/${enc(v.id)}" data-replace aria-current="${v.id === s.id}"><img alt="" loading="lazy" src="${esc(img(v.img, 128))}"><span>${esc(v.phase || "默认")}</span></a>`).join("")}</div>` : ""}
      <div class="bk-note"><span class="bk-note-h">军需官备注</span><p>${esc(dealerLine(s, avail))}</p></div>
      ${folio(n * 2)}`;
    const right = `${run(fileCode(s), esc(r.name))}
      <div class="bk-stamp" aria-hidden="true">${STAMPS[rank] || "机密"}</div>
      <div class="bk-kicker">${esc(s.weaponName)}${s.weaponEn && s.weaponEn !== s.weaponName ? ` ／ ${esc(s.weaponEn)}` : ""}</div>
      <h2 class="bk-item-h">${esc(shortName(s))}</h2>
      <div class="bk-en">${esc((s.en.split("|")[1] || s.en).trim())}</div>
      <table class="bk-form">
        <tr><th>等级</th><td><span class="bk-rank" style="--rc:${r.color}">${"■".repeat(rank)}${"□".repeat(Math.max(0, 7 - rank))}</span> ${esc(r.name)}</td></tr>
        <tr><th>磨损区间</th><td>${min.toFixed(2)} — ${max.toFixed(2)}</td></tr>
        <tr><th>可出外观</th><td class="bk-checks">${WEARS.map((w, i) => `<span class="${avail[i] ? "on" : ""}">${avail[i] ? "☒" : "☐"} ${WEAR_SHORT[i]}</span>`).join("")}</td></tr>
        ${s.colors && s.colors.length ? `<tr><th>主色</th><td class="bk-sws inline">${s.colors.map((c) => swatch(c, `#/color/${c}/${enc(s.catName)}/0`, false)).join("")}<a class="bk-same" href="#/color/${s.colors.join("+")}/${enc(s.catName)}/0">同色系${esc(s.catName)} ›</a></td></tr>` : ""}
        <tr><th>附加</th><td>${[s.st && "StatTrak™", s.sv && "纪念品", s.phase].filter(Boolean).map(esc).join("　") || "—"}</td></tr>
        ${s.pattern ? `<tr><th>涂装</th><td>${esc(s.pattern)}</td></tr>` : ""}
      </table>
      ${s.desc ? `<p class="bk-desc">${esc(s.desc)}</p>` : ""}
      ${s.lore ? `<p class="bk-lore">“${esc(s.lore)}”</p>` : ""}
      <div class="bk-sec"><h3>来源</h3><p class="bk-src">${colls.map((c) => `<a href="#/coll/${enc(c.id)}">${esc(c.name)}</a>`).join("、")}${colls.length && cratesOf.length ? "；" : ""}${cratesOf.slice(0, 5).map((c) => `<a href="#/case/${enc(c.id)}">${esc(c.name)}</a>`).join("、")}${cratesOf.length > 5 ? ` 等 ${cratesOf.length} 处` : ""}${!colls.length && !cratesOf.length ? "不详" : ""}</p></div>
      ${sibs.length ? `<div class="bk-sec"><h3>参见 · ${esc(sibLabel)}</h3><div class="bk-strip">${sibs.map((x) => `<a href="#/skin/${enc(x.id)}" style="--rc:${rc(x)}" class="see"><img alt="" loading="lazy" src="${esc(img(x.img, 128))}"><span>${esc(shortName(x))}</span></a>`).join("")}</div></div>` : ""}
      ${s.en ? `<div class="bk-links">${WEARS.filter((w, i) => avail[i]).map((w) => `<a target="_blank" rel="noopener" href="https://steamcommunity.com/market/listings/730/${enc(`${s.en} (${w[1]})`)}">Steam·${w[0]}</a>`).join("")}<a target="_blank" rel="noopener" href="https://buff.163.com/market/csgo#game=csgo&page_num=1&search=${enc(s.name.replace("（★）", ""))}">BUFF</a></div>` : ""}
      ${folio(n * 2 + 1)}`;
    return { left, right, idx,
      prev: idx > 0 ? `#/skin/${enc(list[idx - 1].id)}` : null,
      next: idx >= 0 && idx < list.length - 1 ? `#/skin/${enc(list[idx + 1].id)}` : null,
      pos: `${idx + 1} / ${list.length}` };
  }

  function search(q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return skins.filter((s) => {
      const hay = `${s.name} ${s.en} ${s.weaponName} ${s.weaponEn} ${s.pattern} ${s.phase}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    }).sort(byRarity);
  }

  // ===== routing =====
  // Each view carries an `order` so the book can tell whether to turn forward or back.
  let fromList = null;   // { list, crumbs, key } of the last index sheet, used to page through items
  let state = null;

  function sheetView(order, tab, list, base, page, title, sub, runLabel, crumbs, extra) {
    const sp = sheetSpread({ title, sub, list, base, page, runLabel, extra });
    const here = `${base}/${sp.page}`;
    return { kind: "sheet", order: [...order, sp.page], tab, list, crumbs, back: here, key: base, ...sp };
  }

  function resolve(hash) {
    const parts = hash.replace(/^#\/?/, "").split("/").map((x) => { try { return decodeURIComponent(x); } catch (e) { return x; } });
    const [kind, arg, arg2] = parts;
    const page = (v) => Math.max(0, parseInt(v || "0", 10) || 0);
    const chapterCrumb = (ci) => [cats[ci].name, `#/c/${enc(cats[ci].name)}`];

    if (!kind) return { kind: "cover", order: [0] };
    if (kind === "toc" || kind === "all") return { kind: "toc", order: [1], crumbs: [], ...tocSpread() };
    if (kind === "c") {
      const ci = cats.findIndex((c) => c.name === arg);
      if (ci < 0) return resolve("#/toc");
      return { kind: "chapter", order: [2, ci], tab: ci, crumbs: [[cats[ci].name, null]], ...chapterSpread(ci) };
    }
    if (kind === "w") {
      const w = weaponById.get(arg);
      if (!w) return resolve("#/toc");
      const ci = cats.findIndex((c) => c.name === w.cat);
      return sheetView([3, ci, w.id], ci, w.list, `#/w/${enc(w.id)}`, page(arg2), w.name, `${w.list.length} 件`, `${cats[ci].name} · ${w.name}`, [chapterCrumb(ci), [w.name, null]]);
    }
    if (kind === "search") {
      const q = arg || "";
      const list = search(q);
      return sheetView([3, 99, q], null, list, `#/search/${enc(q)}`, page(arg2), `检索：${q}`, `${list.length} 件`, "检索结果", [[`检索：${q}`, null]]);
    }
    if (kind === "color") {
      const ids = (arg || "").split("+").filter((c) => colorById[c]).slice(0, 3);
      if (!ids.length || !hasColors) return resolve("#/toc");
      const cat = arg2 && arg2 !== "all" && cats.some((c) => c.name === arg2) ? arg2 : "all";
      const list = skins.filter((s) => s.colors && ids.every((c) => s.colors.includes(c)) && (cat === "all" || s.catName === cat))
        .sort((a, b) => ((a.colors[0] === ids[0] ? 0 : 1) - (b.colors[0] === ids[0] ? 0 : 1)) || byRarity(a, b));
      const name = ids.map((c) => colorById[c][1]).join(" + ");
      const href = (cs, ct) => `#/color/${cs.join("+")}/${enc(ct)}/0`;
      const toggle = (c) => (ids.includes(c) ? ids.filter((x) => x !== c) : [...ids, c].slice(-3));
      const extra = `<div class="bk-filter">
          <div class="bk-sws">${COLORS.map((c) => { const t = toggle(c[0]); return t.length ? swatch(c[0], href(t, cat), ids.includes(c[0]), "data-replace") : swatch(c[0], href(ids, cat), true, "data-replace"); }).join("")}</div>
          <div class="bk-chips"><a data-replace href="${href(ids, "all")}"${cat === "all" ? ' aria-current="true"' : ""}>全部</a>${cats.map((c) => `<a data-replace href="${href(ids, c.name)}"${cat === c.name ? ' aria-current="true"' : ""}>${esc(TAB_SHORT[c.name] || c.name)}</a>`).join("")}</div>
        </div>`;
      return sheetView([3, 98, ids.join("+"), cat], null, list, `#/color/${ids.join("+")}/${enc(cat)}`, page(parts[3]), `${name}色系`, `${list.length} 件${cat !== "all" ? ` · ${cat}` : ""}`, "按颜色检索", [["按颜色", null], [`${name}色系`, null]], extra);
    }
    if (kind === "cases") {
      const sp = listSpread({ title: "附录甲 · 武器箱", en: "CASES", rows: crates.map(caseRow), base: "#/cases", page: page(arg) });
      return { kind: "list", order: [2, 90, sp.page], tab: "cases", crumbs: [["附录甲 · 武器箱", null]], ...sp };
    }
    if (kind === "colls") {
      const counts = {};
      skins.forEach((s) => s.coll.forEach((c) => { counts[c] = (counts[c] || 0) + 1; }));
      const rows = Object.values(meta.collections).sort((a, b) => a.name.localeCompare(b.name, "zh")).map((c) => collRow(c, counts[c.id] || 0));
      const sp = listSpread({ title: "附录乙 · 收藏品", en: "COLLECTIONS", rows, base: "#/colls", page: page(arg) });
      return { kind: "list", order: [2, 91, sp.page], tab: "colls", crumbs: [["附录乙 · 收藏品", null]], ...sp };
    }
    if (kind === "case") {
      const c = crateById.get(arg);
      if (!c) return resolve("#/cases");
      const items = c.items.map((id) => byId.get(id)).filter(Boolean).sort(byRarity);
      const rare = c.rare.map((id) => byId.get(id)).filter(Boolean).sort(byRarity);
      return sheetView([3, 90, c.id], "cases", items.concat(rare), `#/case/${enc(c.id)}`, page(arg2), c.name, `${c.date || ""} · ${items.length} 件${rare.length ? ` + ★ ${rare.length}` : ""}`, c.name, [["武器箱", "#/cases"], [c.name, null]]);
    }
    if (kind === "coll") {
      const c = meta.collections[arg];
      if (!c) return resolve("#/colls");
      const list = skins.filter((s) => s.coll.includes(arg)).sort(byRarity);
      return sheetView([3, 91, arg], "colls", list, `#/coll/${enc(arg)}`, page(arg2), c.name, `${list.length} 件`, c.name, [["收藏品", "#/colls"], [c.name, null]]);
    }
    if (kind === "skin") {
      const s = byId.get(arg);
      if (!s) return resolve("#/toc");
      const ci = cats.findIndex((c) => c.name === s.catName);
      let src = fromList && fromList.list.includes(s) ? fromList : null;
      if (!src) {
        const w = weaponById.get(s.weapon);
        src = { list: w.list, key: `#/w/${enc(w.id)}`, crumbs: [chapterCrumb(ci), [w.name, `#/w/${enc(w.id)}/0`]] };
      }
      const sp = itemSpread(s, src.list);
      return { kind: "skin", order: [4, src.key, sp.idx], tab: ci, crumbs: [...src.crumbs, [shortName(s), null]], ...sp };
    }
    return resolve("#/toc");
  }

  function compareOrder(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i], y = b[i];
      if (x === y) continue;
      if (x === undefined) return -1;
      if (y === undefined) return 1;
      if (typeof x === "number" && typeof y === "number") return x < y ? -1 : 1;
      return 1; // a different section at the same depth: turn forward
    }
    return 0;
  }

  function route(instant, forcedDir) {
    const next = resolve(location.hash || "#/");
    const prev = state;
    if (next.kind === "sheet") {
      // remember where the reader came from, with the last crumb pointing back to this page of the sheet
      fromList = { list: next.list, key: next.key, crumbs: next.crumbs.map(([t, h], i, arr) => [t, i === arr.length - 1 ? next.back : h]) };
    }
    let dir = 0;
    if (!instant && prev) dir = forcedDir ?? (compareOrder(next.order, prev.order) || 0);
    state = next;
    paint(prev, next, dir);
  }

  // ===== rendering =====
  let flipping = false;

  function shell() {
    app.innerHTML = `
      <div class="bk-desk">
        <header class="bk-top">
          <nav class="bk-crumbs" aria-label="位置"></nav>
          <span class="bk-pos"></span>
          <form class="bk-qtop" data-search role="search"><input id="bk-qtop" name="q" type="search" placeholder="检索" aria-label="检索图鉴" autocomplete="off"></form>
        </header>
        <div class="bk-stage">
          <div class="bk-book">
            <div class="bk-spread">
              <section class="bk-page bk-left"></section>
              <section class="bk-page bk-right"></section>
            </div>
            <nav class="bk-tabs" aria-label="书签"></nav>
            <a class="bk-corner prev" role="button" aria-label="上一页"><span>‹</span></a>
            <a class="bk-corner next" role="button" aria-label="下一页"><span>›</span></a>
          </div>
        </div>
      </div>`;
    $(".bk-tabs", app).innerHTML = cats.map((c, i) => `<a href="#/c/${enc(c.name)}" data-tab="${i}" title="${esc(c.name)}">${esc(TAB_SHORT[c.name] || c.name)}</a>`).join("")
      + `<a href="#/cases" data-tab="cases">武器箱</a><a href="#/colls" data-tab="colls">收藏品</a>`;

    app.addEventListener("submit", (e) => {
      const f = e.target.closest("[data-search]");
      if (!f) return;
      e.preventDefault();
      const q = f.q.value.trim();
      if (q) { location.hash = "#/search/" + enc(q); f.q.blur(); }
    });
    app.addEventListener("click", (e) => {
      if (e.target.closest("[data-open]")) { location.hash = "#/toc"; return; }
      const a = e.target.closest("a[data-replace]");
      if (a) { e.preventDefault(); history.replaceState(null, "", a.getAttribute("href")); route(false, 0); return; }
      const c = e.target.closest(".bk-corner");
      if (c) { e.preventDefault(); turn(c.classList.contains("next") ? 1 : -1); }
    });
    addEventListener("keydown", (e) => {
      if (e.target.closest && e.target.closest("input")) return;
      if (e.key === "ArrowRight") turn(1);
      else if (e.key === "ArrowLeft") turn(-1);
      else if (e.key === "Escape" && state) {
        if (state.kind === "toc") { location.hash = "#/"; return; }
        const up = [...(state.crumbs || [])].reverse().find(([, h]) => h);
        location.hash = up ? up[1] : "#/toc";
      }
    });
    bindSwipe($(".bk-book", app));
  }

  // On a phone the book is read one page at a time: turning first moves between the left and
  // right page of the current spread, then on to the neighbouring spread.
  let side = 0, pendingSide = null;
  const prevOf = (st) => (st.kind === "toc" ? "#/" : st.prev);
  const nextOf = (st) => (st.kind === "cover" ? "#/toc" : st.next);
  const single = () => !wideQuery.matches;

  function turn(d) {
    if (!state || flipping) return;
    if (state.kind === "cover") { if (d > 0) location.hash = "#/toc"; return; }
    if (single()) {
      if (d > 0 && side === 0 && !state.rightEmpty) { setSide(1, 1); return; }
      if (d < 0 && side === 1) { setSide(0, -1); return; }
    }
    const h = d > 0 ? nextOf(state) : prevOf(state);
    if (!h) return;
    pendingSide = d < 0 && single() ? 1 : 0;
    if (h === "#/") { location.hash = h; return; }
    history.replaceState(null, "", h);
    route(false, d);
  }

  function setSide(v, dir) {
    side = v;
    const sp = $(".bk-spread", app);
    sp.dataset.side = String(v);
    sp.querySelectorAll(".bk-page").forEach((pg) => { pg.scrollTop = 0; });
    if (dir && !reduceMotion) { sp.classList.remove("slide-f", "slide-b"); void sp.offsetWidth; sp.classList.add(dir > 0 ? "slide-f" : "slide-b"); }
    updateCorners();
  }

  function updateCorners() {
    const st = state;
    const one = single() && st.kind !== "cover";
    const canPrev = (one && side === 1) || !!prevOf(st);
    const canNext = (one && side === 0 && !st.rightEmpty) || !!nextOf(st);
    $(".bk-corner.prev", app).toggleAttribute("hidden", !canPrev);
    $(".bk-corner.next", app).toggleAttribute("hidden", !canNext);
  }

  function bindSwipe(el) {
    let sx = 0, sy = 0, t0 = 0, down = false, swiped = false;
    el.addEventListener("pointerdown", (e) => { if (e.target.closest("input, .bk-tabs")) return; down = true; swiped = false; sx = e.clientX; sy = e.clientY; t0 = Date.now(); });
    el.addEventListener("pointerup", (e) => {
      if (!down) return; down = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - t0 < 600) { swiped = true; turn(dx < 0 ? 1 : -1); }
    });
    el.addEventListener("pointercancel", () => { down = false; });
    el.addEventListener("click", (e) => { if (swiped) { e.preventDefault(); e.stopPropagation(); swiped = false; } }, true);
  }

  function paint(prev, next, dir) {
    const book = $(".bk-book", app), L = $(".bk-left", app), R = $(".bk-right", app);
    const wide = wideQuery.matches;
    const oldL = L.innerHTML, oldR = R.innerHTML;
    $(".bk-leaf", book)?.remove();
    flipping = false;

    // top bar: path back up the book
    const crumbs = [["目录", next.kind === "toc" ? null : "#/toc"], ...(next.crumbs || [])];
    $(".bk-crumbs", app).innerHTML = next.kind === "cover"
      ? `<span class="bk-brand">CS 饰品馆</span>`
      : `<a class="bk-brand" href="#/">封面</a>` + crumbs.map(([t, h]) => `<span class="sep">›</span>` + (h ? `<a href="${h}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`)).join("");
    $(".bk-pos", app).textContent = next.pos || "";
    app.dataset.view = next.kind;
    app.querySelectorAll("[data-tab]").forEach((t) => t.setAttribute("aria-current", String(String(t.dataset.tab) === String(next.tab))));

    side = pendingSide ?? 0; pendingSide = null;
    if (side === 1 && next.rightEmpty) side = 0;
    $(".bk-spread", app).dataset.side = next.kind === "cover" ? "1" : String(side);
    updateCorners();

    if (next.kind === "cover") {
      book.classList.remove("shutting");
      if (prev && prev.kind !== "cover" && wide && !reduceMotion) { closeCover(book, oldL, L, R); return; }
      book.classList.add("closed");
      L.innerHTML = ""; R.innerHTML = coverFace();
      if (prev && !reduceMotion) { book.classList.remove("closing"); void book.offsetWidth; book.classList.add("closing"); }
      return;
    }
    book.classList.remove("closed", "closing", "shutting");
    $(".bk-cover-leaf.closing-leaf", book)?.remove();
    L.innerHTML = next.left; R.innerHTML = next.right;
    L.scrollTop = 0; R.scrollTop = 0; $(".bk-spread", app).scrollTop = 0;

    if (prev && prev.kind === "cover") { if (!reduceMotion) openCover(book, L); return; }
    if (!dir || reduceMotion) return;
    if (!wide) {
      const sp = $(".bk-spread", app);
      sp.classList.remove("slide-f", "slide-b"); void sp.offsetWidth;
      sp.classList.add(dir > 0 ? "slide-f" : "slide-b");
      return;
    }
    flip(book, dir, oldL, oldR, L, R);
  }

  // A leaf turns over: its front is the old page and its back the new one.
  // The page it lands on keeps the old content until the leaf has landed.
  function flip(book, dir, oldL, oldR, L, R) {
    flipping = true;
    const leaf = document.createElement("div");
    leaf.className = "bk-leaf " + (dir > 0 ? "fwd" : "back");
    leaf.innerHTML = dir > 0
      ? `<div class="face front bk-page bk-right">${oldR}</div><div class="face backside bk-page bk-left">${L.innerHTML}</div>`
      : `<div class="face front bk-page bk-left">${oldL}</div><div class="face backside bk-page bk-right">${R.innerHTML}</div>`;
    const under = dir > 0 ? L : R;
    const fresh = under.innerHTML;
    under.innerHTML = dir > 0 ? oldL : oldR;
    book.appendChild(leaf);
    const done = () => { if (!leaf.isConnected) return; under.innerHTML = fresh; leaf.remove(); flipping = false; };
    leaf.addEventListener("animationend", done, { once: true });
    setTimeout(done, 1200);
  }

  // Opening: the cover turns over on the spine while the book slides from centred-closed to open.
  // The inside of the cover carries the first left page, so nothing jumps when the leaf is removed.
  function openCover(book, L) {
    if (!wideQuery.matches) { book.classList.remove("rise"); void book.offsetWidth; book.classList.add("rise"); return; }
    $(".bk-cover-leaf", book)?.remove();
    const cover = document.createElement("div");
    cover.className = "bk-cover-leaf opening";
    cover.innerHTML = `<div class="face front">${coverFace()}</div><div class="face backside bk-page bk-left">${L.innerHTML}</div>`;
    book.appendChild(cover);
    const done = () => cover.remove();
    cover.addEventListener("animationend", done, { once: true });
    setTimeout(done, 1600);
  }

  // Closing: the reverse. The left page swings back over as the cover and the book slides back to centre.
  function closeCover(book, oldL, L, R) {
    $(".bk-cover-leaf", book)?.remove();
    const cover = document.createElement("div");
    cover.className = "bk-cover-leaf closing-leaf";
    cover.innerHTML = `<div class="face front">${coverFace()}</div><div class="face backside bk-page bk-left">${oldL}</div>`;
    book.appendChild(cover);
    book.classList.add("closed", "shutting");
    const done = () => { if (!cover.isConnected) return; L.innerHTML = ""; R.innerHTML = coverFace(); book.classList.remove("shutting"); cover.remove(); };
    cover.addEventListener("animationend", done, { once: true });
    setTimeout(done, 1600);
  }

  boot();
})();
