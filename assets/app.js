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
  const TAB_CHAR = { "匕首": "匕", "手套": "套", "步枪": "步", "手枪": "手", "微型冲锋枪": "冲", "重型武器": "重", "装备": "装",
    "贴纸": "贴", "挂件": "挂", "探员": "探", "音乐盒": "音", "布章": "布", "勋章": "勋", "涂鸦": "涂", "武器箱": "箱", "收藏品": "藏", "审美测试": "审" };
  // in-game Finish Style (the inspect box), from items_game.txt
  const FS = [null, "纯色", "水转印", "喷漆", "电镀", "多色电镀", "电镀喷绘", "自定义涂装", "古铜", "枪匠", "表面淬火"];
  const FS_EN = [null, "Solid Color", "Hydrographic", "Spray-Paint", "Anodized", "Anodized Multicolored", "Anodized Airbrushed", "Custom Paint Job", "Patina", "Gunsmith", "Case Hardening"];
  const FS_ORDER = [1, 4, 5, 6, 2, 3, 8, 10, 9, 7];
  // container types, in the order the appendix lists them
  const CTYPES = [
    ["case", "武器箱", (c) => c.type === "Case"],
    ["sticker", "印花胶囊", (c) => c.type === "Sticker Capsule"],
    ["autograph", "签名胶囊", (c) => c.type === "Autograph Capsule"],
    ["souvenir", "纪念包", (c) => c.type === "Souvenir" || c.type === "Souvenir Highlight"],
    ["music", "音乐盒集", (c) => c.type === "Music Kit Box"],
    ["patch", "布章包", (c) => c.type === "Patch Capsule"],
    ["pin", "胸章胶囊", (c) => c.type === "Pins"],
    ["graffiti", "涂鸦箱", (c) => c.type === "Graffiti"],
    ["other", "终端机与其他", (c) => !c.type],
  ];
  const ctypeOf = (c) => CTYPES.find((t) => t[2](c)) || CTYPES[CTYPES.length - 1];
  const fsTag = (n, href, on, attrs = "") => `<a class="bk-fs${on ? " on" : ""}" href="${href}"${on ? ' aria-current="true"' : ""} ${attrs}><span class="fs-${n}">${FS[n]}</span></a>`;
  const FX = { Gold: "金色", Holo: "全息", Foil: "闪亮", Glitter: "闪耀", Embroidered: "刺绣", Lenticular: "透镜" };
  const X_STAMP = ["普通", "普通", "限制", "机密", "绝密", "绝密", "违禁"];
  // slots of a colour kit, in the order they are laid out
  const SNIPERS = ["weapon_awp", "weapon_ssg08", "weapon_scar20", "weapon_g3sg1"];
  const KIT_SLOTS = [
    { key: "knife", name: "刀", test: (s) => s.catName === "匕首" },
    { key: "gloves", name: "手套", test: (s) => s.catName === "手套" },
    { key: "rifle", name: "步枪", test: (s) => s.catName === "步枪" && !SNIPERS.includes(s.weapon) },
    { key: "sniper", name: "狙击枪", test: (s) => SNIPERS.includes(s.weapon) },
    { key: "pistol", name: "手枪", test: (s) => s.catName === "手枪" },
  ];
  const CN_NUM = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  const WEARS = [
    ["崭新出厂", "Factory New", 0, 0.07], ["略有磨损", "Minimal Wear", 0.07, 0.15],
    ["久经沙场", "Field-Tested", 0.15, 0.38], ["破损不堪", "Well-Worn", 0.38, 0.45],
    ["战痕累累", "Battle-Scarred", 0.45, 1],
  ];
  const WEAR_SHORT = ["崭新", "略磨", "久经", "破损", "战痕"];
  const STAMPS = { 1: "普通", 2: "普通", 3: "限制", 4: "限制", 5: "机密", 6: "绝密", 7: "绝密", 8: "违禁", 9: "违禁" };
  const ROWS_PER_PAGE = 13;   // rows per page on a list (cases, collections)
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wideQuery = matchMedia("(min-width: 1000px) and (min-aspect-ratio: 1/1)");

  // ===== data =====
  let skins = [], byId = new Map(), crates = [], crateById = new Map(), meta = null;
  let rarityRank = {}, rarityById = {};
  let cats = [];
  const weaponById = new Map();
  const skinsByColl = new Map();
  const skinsByName = new Map(), skinsByFinish = new Map();
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  let xch = [], xr = {};                 // other item chapters (stickers, agents …) and their rarities
  const xById = new Map();
  const loading = new Map();

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Steam economy images take a size suffix; plain icon URLs are used as they are
  const img = (url, size) => (!url ? "" : url.includes("/economy/image/") ? `${url}/${size}fx${size}f` : url);
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
      try {
        const x = await fetch("data/extras.json").then((r) => (r.ok ? r.json() : null));
        if (x) { xch = x.chapters; xr = x.rarities; }
      } catch (e) { /* the weapon chapters still work without these */ }
    } catch (e) {
      app.innerHTML = `<p class="bk-fail">图鉴没有载入成功，请刷新页面重试。</p>`;
      return;
    }
    meta.rarities.forEach((r, i) => { rarityRank[r.id] = i; rarityById[r.id] = r; });
    skins.forEach((s, i) => { byId.set(s.id, s); s._n = i + 1; push(skinsByName, s.name, s); push(skinsByFinish, finish(s), s); (s.coll || []).forEach((c) => { if (!skinsByColl.has(c)) skinsByColl.set(c, []); skinsByColl.get(c).push(s); }); });
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
    xch.forEach((ch) => ch.sections.forEach((sec) => { if (sec.items) register(ch, sec, sec.items); }));
    shell();
    addEventListener("hashchange", () => route(false));
    if (wideQuery.addEventListener) wideQuery.addEventListener("change", () => route(true));
    let shapeKey = "", rt = 0;
    addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        const k = JSON.stringify([gridShape(false), gridShape(true)]);
        if (k !== shapeKey) { shapeKey = k; if (state && state.kind === "sheet") route(true); }
      }, 250);
    });
    route(true);
  }

  // ===== page pieces =====
  function best(list) { return list.slice().sort((a, b) => (rarityRank[b.rarity] - rarityRank[a.rarity]) || (a.phase ? 1 : 0) - (b.phase ? 1 : 0))[0]; }
  const run = (l, r) => `<div class="bk-run"><span>${l}</span><span>${r}</span></div>`;
  const folio = (n) => `<div class="bk-folio">— ${n} —</div>`;
  const photoCell = (s) => `<a class="bk-cell" href="#/skin/${enc(s.id)}" style="--rc:${rc(s)}">
      <span class="bk-cell-photo">${s.img ? `<img loading="lazy" decoding="async" alt="" src="${esc(img(s.img, 256))}">` : ""}</span>
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

  // ----- other item chapters -----
  function register(ch, sec, items) {
    sec.items = items;
    items.forEach((it) => { it._ch = ch.key; it._sec = sec.id; xById.set(it.id, it); });
  }
  const xChapter = (key) => xch.find((c) => c.key === key);
  const xRar = (it) => xr[it.r] || { name: "", color: "#8c949c", rank: 0 };
  const xHref = (it) => `#/x/${it._ch}/${enc(it._sec)}/${enc(it.id)}`;
  const xFull = (it) => it.full || (it._ch === "stickers" ? `印花 | ${it.n}` : it.n);
  function xTag(it) {
    if (FX[it.fx]) return FX[it.fx];
    if (it.side) return it.side;
    if (it.tints > 1) return `${it.tints} 色`;
    if (it.st) return "ST";
    return "";
  }
  const xCell = (it) => `<a class="bk-cell" href="${xHref(it)}" style="--rc:${xRar(it).color}">
      <span class="bk-cell-photo">${it.img ? `<img loading="lazy" decoding="async" alt="" src="${esc(img(it.img, 256))}">` : ""}</span>
      <span class="bk-cell-cap"><i></i><span>${esc(it.n)}</span>${xTag(it) ? `<small>${esc(xTag(it))}</small>` : ""}</span></a>`;
  const cellOf = (it) => (it.weapon ? photoCell(it) : xCell(it));

  // Sticker sections are loaded the first time they are opened.
  function ensureSection(ch, sec) {
    if (sec.items) return true;
    if (!loading.has(sec.id)) {
      const want = location.hash;
      loading.set(sec.id, fetch(`data/${ch.file}/${sec.id}.json`).then((r) => r.json()).then((items) => {
        register(ch, sec, items);
        if (location.hash === want) route(true);
      }).catch(() => loading.delete(sec.id)));
    }
    return false;
  }
  function loadingSpread(label) {
    return { left: `${run(esc(label), "调档中")}<p class="bk-empty">正在从档案室调取“${esc(label)}”…</p>`, right: `${run("", "")}`, rightEmpty: true };
  }

  const swatch = (id, href, on, attrs = "") => { const c = colorById[id]; return c ? `<a class="bk-sw${on ? " on" : ""}" href="${href}" style="--sw:${c[2]}" title="${c[1]}" aria-label="${c[1]}色"${on ? ' aria-current="true"' : ""} ${attrs}><span>${c[1]}</span></a>` : ""; };

  // ===== spreads =====
  function coverFace() {
    return `<button class="bk-cover-face" data-open aria-label="翻开图鉴">
      <span class="bk-cover-in">
        <span class="bk-cover-top">机密 · 限内部传阅</span>
        <b>军械图鉴</b>
        <span class="bk-cover-sub">COUNTER-STRIKE 2 · 饰品档案</span>
        <span class="bk-cover-stats">涂装 ${skins.length.toLocaleString()} 件 · 饰品 ${xTotal().toLocaleString()} 件 · ${crates.length} 个箱子与胶囊</span>
      </span>
      <span class="bk-cover-open">翻开 ▸</span>
    </button>`;
  }

  const xTotal = () => xch.reduce((n, ch) => n + ch.sections.reduce((m, sec) => m + (sec.count ?? sec.items.length), 0), 0);
  const xCount = (ch) => ch.sections.reduce((m, sec) => m + (sec.count ?? sec.items.length), 0);

  function tocSpread() {
    const left = `${run("卷首", "军械图鉴")}
      <div class="bk-front">
        <h2 class="bk-h">卷首说明</h2>
        <p class="bk-p">本册上编收录 Counter-Strike 2 全部武器、刀具与手套涂装 ${skins.length.toLocaleString()} 件，分 ${cats.length} 章；下编收录贴纸、挂件、探员等饰品 ${xTotal().toLocaleString()} 件，分 ${xch.length} 章；武器箱与收藏品另列于附录。</p>
        <h3 class="bk-h3">查阅方法</h3>
        <ul class="bk-ul"><li>点目录中的章节进入，逐级查到单件展品</li><li>点书角或左右滑动翻页，书签和顶部路径可直接跳转</li><li>知道名字的，直接在下方检索</li></ul>
        <form class="bk-search" data-search role="search"><label for="bk-q">检索</label><input id="bk-q" name="q" type="search" placeholder="皮肤、武器或英文名，如 AK 火神" autocomplete="off"><button type="submit">查</button></form>
        ${hasColors ? `<div class="bk-colors"><span class="bk-colors-h">按颜色检索</span><div class="bk-sws">${COLORS.map((c) => swatch(c[0], `#/color/${c[0]}/all/0`, false)).join("")}</div><p class="bk-colors-tip">先选主色，结果页里可再加一色或限定类别。<a class="bk-same" href="#/kit/mono.red">配一套 ›</a></p></div>` : ""}
        ${skins.some((s) => s.fs) ? `<div class="bk-colors"><span class="bk-colors-h">按涂装风格检索</span><div class="bk-chips fs-list">${FS_ORDER.map((n) => fsTag(n, `#/style/${n}/all/0`, false)).join("")}</div></div>` : ""}
        <div class="bk-imprint"><b>出版说明</b>数据取自 ByMykel/CSGO-API，图片来自 Steam，每周更新。本册与 Valve 无关，Counter-Strike 及相关素材版权归 Valve Corporation 所有。</div>
      </div>${folio("i")}`;
    const row = (i, name, en, n) => `<a class="bk-toc-row" href="#/c/${enc(name)}"><span class="no">第${chapterNo(i)}章</span><span class="t">${esc(name)}<small>${en}</small></span><span class="dots"></span><span class="n">${n}</span></a>`;
    const rows = cats.map((c, i) => row(i, c.name, c.en, c.count)).join("");
    const xrows = xch.map((c, i) => row(cats.length + i, c.name, c.en, xCount(c))).join("");
    const right = `${run("目录", "CONTENTS")}
      <h2 class="bk-h bk-toc-h">目　录</h2>
      <nav class="bk-toc" aria-label="目录"><div class="bk-toc-part">上编 · 武器涂装</div>${rows}
        ${xrows ? `<div class="bk-toc-part">下编 · 饰品与收藏</div>${xrows}` : ""}
        ${hasColors ? `<div class="bk-toc-part">特　辑</div>
        <a class="bk-toc-row" href="#/duel"><span class="no">特辑</span><span class="t">审美测试<small>TASTE TEST</small></span><span class="dots"></span><span class="n">${taste.likes.length ? "♥ " + taste.likes.length : "左滑右滑"}</span></a>` : ""}
        <div class="bk-toc-part">附　录</div>
        <a class="bk-toc-row" href="#/cases"><span class="no">附录甲</span><span class="t">箱子与胶囊<small>CONTAINERS</small></span><span class="dots"></span><span class="n">${crates.length}</span></a>
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
      <nav class="bk-index">${c.weapons.map((w) => { const b = best(w.list); return `<a class="bk-idx-row" href="#/w/${enc(w.id)}"><span class="th" style="--rc:${rc(b)}">${b.img ? `<img loading="lazy" decoding="async" alt="" src="${esc(img(b.img, 128))}">` : ""}</span><span class="t">${esc(w.name)}${w.en && w.en !== w.name ? `<small>${esc(w.en)}</small>` : ""}</span><span class="dots"></span><span class="n">${w.list.length}</span></a>`; }).join("")}</nav>
      ${folio(`${chapterNo(ci)}·2`)}`;
    return { left, right };
  }

  function xChapterSpread(xi) {
    const ch = xch[xi], no = chapterNo(cats.length + xi);
    const loaded = ch.sections.filter((sec) => sec.items).flatMap((sec) => sec.items);
    const hero = loaded.length ? loaded.slice().sort((a, b) => xRar(b).rank - xRar(a).rank)[0] : null;
    const heroImg = hero ? hero.img : (ch.sections[0] || {}).img;
    const left = `${run(`第${no}章`, ch.en)}
      <div class="bk-chapter">
        <span class="bk-ch-no">第${no}章</span>
        <h2 class="bk-ch-title">${esc(ch.name)}</h2>
        <span class="bk-ch-en">${ch.en}</span>
        <figure class="bk-ch-plate"><span class="tape t1" aria-hidden="true"></span><span class="bk-photo" style="--rc:${hero ? xRar(hero).color : "#8c949c"}">${heroImg ? `<img alt="" src="${esc(img(heroImg, 512))}">` : ""}</span><figcaption>卷首图　${esc(hero ? xFull(hero) : ch.sections[0].name)}</figcaption></figure>
        <p class="bk-ch-meta">本章分 ${ch.sections.length} 节，共 ${xCount(ch).toLocaleString()} 件。</p>
      </div>${folio(`${no}·1`)}`;
    const right = `${run(esc(ch.name), "分节索引")}
      <h2 class="bk-h">分节索引</h2>
      <nav class="bk-index">${ch.sections.map((sec) => {
        const pic = sec.img || (sec.items && sec.items[0] && sec.items[0].img);
        return `<a class="bk-idx-row" href="#/s/${ch.key}/${enc(sec.id)}/0"><span class="th">${pic ? `<img loading="lazy" decoding="async" alt="" src="${esc(img(pic, 128))}">` : ""}</span><span class="t">${esc(sec.name)}</span><span class="dots"></span><span class="n">${sec.count ?? sec.items.length}</span></a>`;
      }).join("")}</nav>
      ${folio(`${no}·2`)}`;
    return { left, right };
  }

  const NOTES = [
    ["入门货，但耐看。", "别小看它，老玩家都收过一个。"],
    ["入门货，但耐看。", "便宜、结实，用一整个赛季也不心疼。"],
    ["行家都会多看两眼。", "成色不错，价格好商量。"],
    ["这件在场上很显眼。", "要的人不少，你先看。"],
    ["压箱底的货，识货的人不多。", "这件我本来不打算拿出来。"],
    ["压箱底的货，识货的人不多。", "这种东西我一般只给熟客看。"],
    ["这东西不在任何官方清单上。你没见过它，我也没卖过。"],
  ];

  function xItemSpread(it, list) {
    const ch = xChapter(it._ch), sec = ch.sections.find((x) => x.id === it._sec);
    const idx = list.indexOf(it);
    const r = xRar(it);
    const rank = r.rank + 1;
    const rows = [
      ["等级", `<span class="bk-rank" style="--rc:${r.color}">${"■".repeat(rank)}${"□".repeat(Math.max(0, 7 - rank))}</span> ${esc(r.name)}`],
      it.tp && ["类型", esc({ Autograph: "选手签名", Team: "战队", Event: "赛事", Other: "常规" }[it.tp] || it.tp)],
      FX[it.fx] && ["特效", esc(FX[it.fx])],
      it.ev && ["赛事", `<a href="#/by/ev/${enc(it.ev)}/0">${esc(it.ev)}</a>`],
      it.team && ["战队", `<a href="#/by/team/${enc(it.team)}/0">${esc(it.team)} 的全部饰品 ›</a>`],
      it.pl && ["选手", `<a href="#/by/pl/${enc(it.pl)}/0">${esc(it.pl)} 的全部签名 ›</a>`],
      it.side && ["阵营", esc(it.side === "CT" ? "反恐精英（CT）" : "恐怖分子（T）")],
      it.sub && ["所属", esc(it.sub)],
      it.tints > 1 && ["颜色", `${it.tints} 种`],
      it.st && ["附加", "有 StatTrak™ 版本"],
      (it.cr && crateById.get(it.cr)) ? ["出自", `<a href="#/case/${enc(it.cr)}/0">${esc(crateById.get(it.cr).name)} ›</a>`]
        : it.src && ["来源", `<a href="#/by/src/${enc(it.src)}/0">${esc(it.src)} ›</a>`],
    ].filter(Boolean);
    const sellable = it.en && !(ch.key === "medals" && !["胸章", "纪念品代币", "观众通行证"].includes(it.tp));
    const n = idx + 1;
    const left = `${run(`${esc(ch.name)} · ${esc(sec.name)}`, `图版 ${pad2(n)}`)}
      <figure class="bk-plate">
        <span class="tape t1" aria-hidden="true"></span><span class="tape t2" aria-hidden="true"></span>
        <div class="bk-photo" style="--rc:${r.color}">${it.img ? `<img alt="${esc(xFull(it))}" src="${esc(img(it.img, 512))}">` : `<span class="bk-noimg">图版缺失</span>`}</div>
        <figcaption><b>图 ${pad2(n)}</b> ${esc(xFull(it))}</figcaption>
      </figure>
      <div class="bk-note"><span class="bk-note-h">军需官备注</span><p>${esc(pick(NOTES[Math.min(6, r.rank)], hashOf(it.id)))}</p></div>
      ${folio(`${ch.key.toUpperCase().slice(0, 3)}·${n}`)}`;
    const right = `${run(`FM-${ch.key.toUpperCase().slice(0, 4)}-${String(n).padStart(4, "0")}`, esc(r.name))}
      <div class="bk-stamp" aria-hidden="true">${X_STAMP[Math.min(6, r.rank)]}</div>
      <div class="bk-kicker">${esc(ch.name)} ／ ${esc(sec.name)}</div>
      <h2 class="bk-item-h">${esc(it.n)}</h2>
      <div class="bk-en">${esc(after(it.en))}</div>
      <table class="bk-form">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>
      ${it.desc ? `<p class="bk-desc">${esc(it.desc)}</p>` : ""}
      ${it.lore ? `<p class="bk-lore">“${esc(it.lore)}”</p>` : ""}
      ${sellable ? `<div class="bk-links"><a target="_blank" rel="noopener" href="https://steamcommunity.com/market/listings/730/${enc(it.en)}">Steam 市场</a><a target="_blank" rel="noopener" href="https://buff.163.com/market/csgo#game=csgo&page_num=1&search=${enc(xFull(it))}">BUFF</a></div>` : ""}
      ${folio(`${ch.key.toUpperCase().slice(0, 3)}·${n}′`)}`;
    return { left, right, idx,
      prev: idx > 0 ? xHref(list[idx - 1]) : null,
      next: idx >= 0 && idx < list.length - 1 ? xHref(list[idx + 1]) : null,
      pos: `${n} / ${list.length}` };
  }
  const after = (en) => { const p = (en || "").split("|").map((x) => x.trim()); return p.length > 1 ? p.slice(1).join(" | ") : en || ""; };

  // ----- matching by real colour (palette from the build) and by shared finish -----
  const labCache = new Map();
  function lab(hex) {
    if (labCache.has(hex)) return labCache.get(hex);
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92));
    const xyz = [
      (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047,
      c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722,
      (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883,
    ].map((v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116));
    const out = [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
    labCache.set(hex, out);
    return out;
  }
  const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // how far apart two palettes look: each colour finds its nearest partner, weighted by how much of the item it covers
  const pdCache = new Map();
  function palDist(p, q) {
    const key = p.map((x) => x[0]).join() + "|" + q.map((x) => x[0]).join();
    if (pdCache.has(key)) return pdCache.get(key);
    const v = palDist0(p, q);
    if (pdCache.size > 50000) pdCache.clear();
    pdCache.set(key, v);
    return v;
  }
  function palDist0(p, q) {
    const one = (x, y) => x.reduce((sum, [h, w]) => sum + w * Math.min(...y.map(([g]) => dE(lab(h), lab(g)))), 0) / (x.reduce((t, [, w]) => t + w, 0) || 1);
    return (one(p, q) + one(q, p)) / 2;
  }
  const finish = (s) => s._f ?? (s._f = shortName(s).replace(/（.*?）/g, "").trim());
  // ===== outfit builder: five ways of putting a kit together =====
  // A kit is a knife, gloves, rifle, sniper rifle and pistol. Each mode is an explicit rule from colour
  // theory, so every pick can say why it is there. URL: #/kit/<mode>.<param>/<ids>/<locks>
  const MODES = [
    ["mono", "同色系", "全套一个色调，深浅有层次"],
    ["neutral", "黑白点缀", "刀、手套和狙用黑白灰打底，步枪和手枪带一点主题色"],
    ["contrast", "撞色", "色轮上相对的两种颜色，刀和手套各占一边"],
    ["set", "同系列", "同名涂装凑一套，比如渐变之色、多普勒"],
    ["theme", "主题", "按涂装风格统一质感，比如全套电镀、全套枪匠"],
  ];
  const THEMES = [["camo", "军事迷彩"], ...FS_ORDER.map((n) => [String(n), FS[n] + "风格"])];
  const CAMO = /迷彩|DDPAT|网格|伪装|丛林|沙漠|森林|城市|冬季|狩猎|雪|草/;

  // ----- colour metrics from the palette computed at build time -----
  const hslCache = new Map();
  function hsl(hex) {
    if (hslCache.has(hex)) return hslCache.get(hex);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    const out = [(h * 60 + 360) % 360, d ? d / (1 - Math.abs(2 * l - 1)) : 0, l];
    hslCache.set(hex, out);
    return out;
  }
  const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  const COLOR_HUE = Object.fromEntries(COLORS.map((c) => [c[0], hsl(c[2])]));
  const NEUTRALS = ["black", "gray", "white"];
  const isNeutralHex = ([h, s, l]) => s < 0.18 || l < 0.12 || l > 0.9;
  function metrics(s) {
    if (s._m) return s._m;
    const pal = s.pal || (s.colors || []).map((c, i) => [colorById[c][2], i ? 0.3 : 0.7]);
    let neutral = 0, chroma = 0, sx = 0, sy = 0, sat = 0, light = 0, tot = 0;
    const hues = [];
    for (const [hex, w] of pal) {
      const c = hsl(hex);
      tot += w; light += w * c[2];
      if (isNeutralHex(c)) { neutral += w; continue; }
      chroma += w; sat += w * c[1];
      sx += w * c[1] * Math.cos(c[0] * Math.PI / 180); sy += w * c[1] * Math.sin(c[0] * Math.PI / 180);
      if (w >= 0.12 && !hues.some((h) => hueGap(h, c[0]) < 40)) hues.push(c[0]);
    }
    tot = tot || 1;
    const hue = chroma ? (Math.atan2(sy, sx) * 180 / Math.PI + 360) % 360 : null;
    const m = { hue, neutral: neutral / tot, chroma: chroma / tot, sat: chroma ? sat / chroma : 0, light: light / tot,
      busy: hues.length >= 2 || s.fs === 7 && hues.length >= 1 && chroma / tot > 0.6 };
    s._m = m;
    return m;
  }
  function hueName(h) {
    if (h == null) return "黑白灰";
    let best = null, d = 999;
    COLORS.forEach((c) => { if (NEUTRALS.includes(c[0]) || c[0] === "brown") return; const g = hueGap(h, COLOR_HUE[c[0]][0]); if (g < d) { d = g; best = c; } });
    return best[1];
  }
  const shade = (a, b) => (a.light - b.light > 0.12 ? "更浅" : b.light - a.light > 0.12 ? "更深" : "深浅相近");

  // ----- how well an item fits the mode on its own (lower is better); stable, so lists keep their order -----
  function contrastHue(color) { return (COLOR_HUE[color][0] + 180) % 360; }
  function roleOf(mode, i) {
    if (mode === "neutral") return [0, 1, 3].includes(i) ? "base" : "accent";
    if (mode === "contrast") return [0, 2, 3].includes(i) ? "a" : "b";
    return "main";
  }
  function fitTo(s, mode, param, i) {
    const m = metrics(s);
    const towards = (hue) => (m.hue == null ? 120 : hueGap(m.hue, hue)) + (1 - m.chroma) * 70;
    if (mode === "mono") {
      if (NEUTRALS.includes(param)) return (1 - m.neutral) * 100 + Math.abs(m.light - COLOR_HUE[param][2]) * 120;
      return towards(COLOR_HUE[param][0]);
    }
    if (mode === "neutral") {
      if (roleOf(mode, i) === "base") return (1 - m.neutral) * 100 + m.sat * 20 + (m.busy ? 25 : 0);
      return NEUTRALS.includes(param) ? (1 - m.neutral) * 60 : towards(COLOR_HUE[param][0]);
    }
    if (mode === "contrast") return towards(roleOf(mode, i) === "a" ? COLOR_HUE[param][0] : contrastHue(param));
    return 0;
  }
  // does the item belong to this mode at all
  function admits(s, mode, param, i) {
    if (mode === "theme") {
      if (KIT_SLOTS[i].key === "gloves") return true;                 // gloves have no finish style
      return param === "camo" ? s.fs === 3 || (s.fs === 2 && CAMO.test(shortName(s))) || CAMO.test(shortName(s)) && [1, 2, 3].includes(s.fs) : s.fs === +param;
    }
    if (mode === "set") return true;
    return fitTo(s, mode, param, i) < (mode === "neutral" && roleOf(mode, i) === "base" ? 55 : 60);
  }

  // ----- how well an item goes with the pieces already chosen (lower is better) -----
  function together(s, chosen, mode, param, i, knife) {
    let score = fitTo(s, mode, param, i);
    const m = metrics(s);
    const same = chosen.filter((c) => mode !== "contrast" || roleOf(mode, KIT_SLOTS.findIndex((sl) => sl.test(c))) === roleOf(mode, i));
    for (const c of same) score += (s.pal && c.pal ? palDist(s.pal, c.pal) : 30) * (mode === "theme" || mode === "set" ? 0.6 : 0.35) / Math.max(1, same.length);
    if (mode === "set" && param) score += finish(s) === param ? -80 : 0;
    if (chosen.filter((c) => metrics(c).busy).length >= 2 && m.busy) score += 40;     // at most two loud pieces
    if (knife && knife !== s && m.sat - metrics(knife).sat > 0.25 && mode !== "contrast") score += 15; // the knife stays the star
    return score - (rarityRank[s.rarity] || 0) * 1.2;
  }

  // a short reason shown under each piece
  function reason(s, mode, param, i, picks) {
    const m = metrics(s), knife = picks[0];
    const loud = m.busy ? "，花色较多" : "";
    if (mode === "set") {
      if (param && finish(s) === param) return `同为「${param}」`;
      return knife ? `没有「${param}」，按刀的颜色补位，${shade(m, metrics(knife))}` : "按颜色补位";
    }
    if (mode === "theme") {
      if (KIT_SLOTS[i].key === "gloves") return knife ? `手套没有涂装风格，按刀的颜色挑，主色${hueName(m.hue)}` : "按颜色挑";
      return `${param === "camo" ? "迷彩" : FS[+param]}涂装，主色${hueName(m.hue)}${loud}`;
    }
    if (mode === "neutral") {
      if (roleOf(mode, i) === "base") return `黑白灰占 ${Math.round(m.neutral * 100)}%，做底色`;
      return `${hueName(m.hue)}色点缀${loud}`;
    }
    if (mode === "contrast") {
      const side = roleOf(mode, i) === "a" ? hueName(COLOR_HUE[param][0]) : hueName(contrastHue(param));
      return i === 0 ? `${side}色一侧，是全套的主角` : `${side}色一侧${i === 1 ? "，和刀形成对比" : ""}${loud}`;
    }
    if (i === 0) return `主色${hueName(m.hue)}，全套以它为准`;
    return knife ? `主色${hueName(m.hue)}，比刀${shade(m, metrics(knife)).replace("相近", "相近，不抢戏")}${loud}` : `主色${hueName(m.hue)}`;
  }

  // ----- parse the URL key; old links like "red" or "red.5" still work -----
  function parseKitKey(key) {
    const [a, b] = String(key || "").split(".");
    if (MODES.some((x) => x[0] === a)) {
      if (a === "set") return { mode: a, param: b ? decodeURIComponent(b) : "" };
      if (a === "theme") return { mode: a, param: THEMES.some((t) => t[0] === b) ? b : "camo" };
      return { mode: a, param: colorById[b] ? b : "red" };
    }
    if (colorById[a]) return FS[+b] ? { mode: "theme", param: String(+b) } : { mode: "mono", param: a };
    return { mode: "mono", param: "red" };
  }
  const kitKey = (k) => `${k.mode}.${k.mode === "set" ? enc(k.param || "") : k.param}`;

  // the series that can make a set: a finish found on a knife and on at least two other kinds of weapon
  let setFinishes = null;
  function finishesForSets() {
    if (setFinishes) return setFinishes;
    const by = new Map();
    skins.forEach((s) => { const f = finish(s); if (!by.has(f)) by.set(f, new Set()); KIT_SLOTS.forEach((sl, i) => { if (sl.test(s)) by.get(f).add(i); }); });
    setFinishes = [...by.entries()].filter(([, set]) => set.has(0) && set.size >= 3).map(([f, set]) => [f, set.size]).sort((a, b) => b[1] - a[1]);
    return setFinishes;
  }

  const candCache = new Map();
  function kitCandidates(k) {
    const ck = k.mode + "." + k.param;
    if (!candCache.has(ck)) candCache.set(ck, kitCandidates0(k));
    return candCache.get(ck);
  }
  function kitCandidates0(k) {
    return KIT_SLOTS.map((slot, i) => {
      const seen = new Set();
      let pool = skins.filter((s) => slot.test(s) && admits(s, k.mode, k.param, i));
      if (k.mode === "set") pool.sort((a, b) => ((finish(a) === k.param ? 0 : 1) - (finish(b) === k.param ? 0 : 1)) || byRarity(a, b));
      else if (k.mode === "theme") pool.sort(byRarity);
      else { const ft = new Map(pool.map((x) => [x, fitTo(x, k.mode, k.param, i)])); pool.sort((a, b) => (ft.get(a) - ft.get(b)) || byRarity(a, b)); }
      return pool.filter((s) => !seen.has(s.name) && seen.add(s.name));
    });
  }

  // rnd = false: keep every piece already in the kit and fill gaps; rnd = true: keep only locked pieces
  function assemble(k, cands, given, locks, rnd) {
    const picks = [];
    KIT_SLOTS.forEach((slot, i) => { if (given[i] && (!rnd || locks[i])) picks[i] = given[i]; });
    const pick = (i, pool) => {
      if (!pool.length) return null;
      const chosen = picks.filter(Boolean);
      // gloves in theme and set modes are chosen by colour against the other pieces
      const sc = new Map(pool.map((x) => [x, together(x, chosen, k.mode, k.param, i, picks[0])]));
      const ranked = pool.slice().sort((a, b) => sc.get(a) - sc.get(b));
      if (!rnd) return ranked[0];
      const fresh = ranked.filter((s) => !given[i] || s.name !== given[i].name).slice(0, 8);
      return (fresh.length ? fresh : ranked)[Math.floor(Math.random() * Math.min(fresh.length || ranked.length, 8))];
    };
    // the knife goes first; when shuffling it is drawn from the whole list
    if (!picks[0]) picks[0] = rnd ? (() => { const p = cands[0].filter((s) => !given[0] || s.name !== given[0].name); return (p.length ? p : cands[0])[Math.floor(Math.random() * (p.length || cands[0].length))] || null; })() : pick(0, cands[0]);
    [1, 2, 3, 4].forEach((i) => { if (!picks[i]) picks[i] = pick(i, cands[i]); });
    return picks;
  }

  let kitShuffle = null;
  function kitSpread(key, idsArg, locksArg, pickSlot, pickPage) {
    const k = parseKitKey(key);
    if (k.mode === "set" && !finishesForSets().some(([f]) => f === k.param)) k.param = finishesForSets()[0][0];
    const cands = kitCandidates(k);
    const ids = (idsArg || "").split(",");
    const given = KIT_SLOTS.map((slot, i) => { const s = byId.get(ids[i]) || ids.map((x) => byId.get(x)).find((x) => x && slot.test(x)); return s && slot.test(s) ? s : null; });
    // without a lock mask (a link from a skin page) the items given are kept
    const locks = KIT_SLOTS.map((_, i) => (locksArg ? locksArg[i] === "1" : !!given[i]));
    const picks = assemble(k, cands, given, locks, false);
    const idsOf = (arr) => arr.map((s) => (s ? s.id : "")).join(",");
    const lockStr = (arr) => arr.map((x) => (x ? "1" : "0")).join("");
    const base = (kk, p, l) => `#/kit/${kitKey(kk)}/${idsOf(p)}/${lockStr(l)}`;
    // picking an item by hand locks it; a new knife re-matches the unlocked pieces
    const hrefWith = (i, s) => {
      const p = picks.slice(), l = locks.slice(); p[i] = s; l[i] = true;
      if (i === 0) KIT_SLOTS.forEach((_, j) => { if (j && !l[j]) p[j] = null; });
      return base(k, p, l);
    };
    const lockHref = (i) => { const l = locks.slice(); l[i] = !l[i]; return base(k, picks, l); };
    // a new kit is drawn only when the button is pressed
    kitShuffle = () => {
      let shuffleK = k;
      if (k.mode === "set" && !locks.some(Boolean)) { const fl = finishesForSets(); shuffleK = { ...k, param: fl[Math.floor(Math.random() * Math.min(fl.length, 40))][0] }; }
      return base(shuffleK, assemble(shuffleK, kitCandidates(shuffleK), picks, locks, true), locks);
    };
    const modeName = MODES.find((x) => x[0] === k.mode)[1];
    const pName = k.mode === "set" ? `「${k.param}」` : k.mode === "theme" ? THEMES.find((t) => t[0] === k.param)[1]
      : k.mode === "contrast" ? `${colorById[k.param][1]}撞${hueName(contrastHue(k.param))}` : `${colorById[k.param][1]}色`;
    const pickHref = (i) => `#/kitpick/${kitKey(k)}/${i}/${idsOf(picks)}/${lockStr(locks)}/0`;
    const backTo = base(k, picks, locks);

    if (pickSlot != null && KIT_SLOTS[pickSlot]) {
      const i = pickSlot, list = cands[i];
      const cell = (s) => `<a class="bk-cell${picks[i] && picks[i].id === s.id ? " on" : ""}" href="${hrefWith(i, s)}" style="--rc:${rc(s)}">
          <span class="bk-cell-photo">${s.img ? `<img loading="lazy" decoding="async" alt="" src="${esc(img(s.img, 256))}">` : ""}</span>
          <span class="bk-cell-cap"><i></i><span>${esc(`${s.weaponName.replace(/（★）/, "")} · ${shortName(s)}`)}</span>${k.mode === "set" && finish(s) === k.param ? "<small>同系列</small>" : ""}</span></a>`;
      const sp = sheetSpread({ title: `挑选${KIT_SLOTS[i].name}`, sub: `${list.length} 件 · ${modeName} ${pName}`, list, base: `#/kitpick/${kitKey(k)}/${i}/${idsOf(picks)}/${lockStr(locks)}`, page: pickPage || 0, runLabel: `${modeName} · ${KIT_SLOTS[i].name}`, cell });
      return { ...sp, backTo, k };
    }

    const plate = (s, i) => `<div class="bk-kit-plate${i < 2 ? " big" : ""}${locks[i] ? " locked" : ""}" style="--rc:${s ? rc(s) : "#8c949c"}">
        <span class="bk-kit-slot">${KIT_SLOTS[i].name}</span>
        <a class="bk-kit-lock" data-replace href="${lockHref(i)}" aria-pressed="${locks[i]}" title="${locks[i] ? "已锁定，换一套时保留" : "锁定这件"}">${locks[i] ? "已锁" : "锁定"}</a>
        <a class="bk-cell-photo" ${s ? `href="#/skin/${enc(s.id)}"` : ""}>${s && s.img ? `<img alt="" src="${esc(img(s.img, 360))}">` : `<span class="bk-noimg">没有合适的</span>`}</a>
        <span class="bk-cell-cap"><i></i><span>${s ? esc(s.weaponName.replace(/（★）/, "")) + " · " + esc(shortName(s)) : "—"}</span></span>
        <span class="bk-kit-why">${s ? esc(reason(s, k.mode, k.param, i, picks)) : "这个条件下没有可选的"}</span></div>`;

    const modeChips = MODES.map(([id, name]) => `<a data-replace href="#/kit/${id}.${id === "set" ? enc(finishesForSets()[0][0]) : id === "theme" ? "camo" : (colorById[k.param] ? k.param : "red")}"${id === k.mode ? ' aria-current="true"' : ""}>${name}</a>`).join("");
    let paramRow = "";
    if (["mono", "neutral", "contrast"].includes(k.mode)) {
      const label = k.mode === "neutral" ? "点缀色" : k.mode === "contrast" ? "主色" : "主色";
      const sws = COLORS.filter((c) => k.mode !== "contrast" || !NEUTRALS.includes(c[0])).map((c) => swatch(c[0], `#/kit/${k.mode}.${c[0]}`, c[0] === k.param, "data-replace")).join("");
      paramRow = `<div class="bk-filter"><span class="bk-filter-h">${label}</span><div class="bk-sws">${sws}</div>${k.mode === "contrast" ? `<span class="bk-kit-pair"><i style="background:${colorById[k.param][2]}"></i>撞<i style="background:hsl(${contrastHue(k.param)},60%,50%)"></i></span>` : ""}</div>`;
    } else if (k.mode === "theme") {
      paramRow = `<div class="bk-filter"><span class="bk-filter-h">主题</span><div class="bk-chips">${THEMES.map(([id, name]) => `<a data-replace href="#/kit/theme.${id}"${id === k.param ? ' aria-current="true"' : ""}>${id === "camo" ? name : `<span class="fs-${id}">${FS[+id]}</span>`}</a>`).join("")}</div></div>`;
    } else {
      paramRow = `<div class="bk-filter"><span class="bk-filter-h">系列</span><div class="bk-chips">${finishesForSets().slice(0, 30).map(([f]) => `<a data-replace href="#/kit/set.${enc(f)}"${f === k.param ? ' aria-current="true"' : ""}>${esc(f)}</a>`).join("")}</div></div>`;
    }
    const left = `${run("配色套装", modeName)}
      <div class="bk-sheet-head"><h2 class="bk-h">${esc(pName)}套装</h2><a class="bk-same" data-shuffle href="#">换一套 ↻</a></div>
      <div class="bk-filter"><span class="bk-filter-h">配法</span><div class="bk-chips">${modeChips}</div></div>
      ${paramRow}
      <div class="bk-kit">${picks.map(plate).join("")}</div>
      ${folio("套·1")}`;
    const right = `${run("备选", "点一件换上，换上的会自动锁定")}
      <p class="bk-kit-rule"><b>${modeName}</b>　${MODES.find((x) => x[0] === k.mode)[2]}。</p>
      ${KIT_SLOTS.map((slot, i) => `<div class="bk-sec"><h3><a href="${pickHref(i)}">${slot.name} · ${cands[i].length} 件可选 ›</a></h3>
        <div class="bk-strip">${cands[i].slice(0, 9).map((s) => `<a data-replace href="${hrefWith(i, s)}" class="see" style="--rc:${rc(s)}"${picks[i] && picks[i].id === s.id ? ' aria-current="true"' : ""}><img alt="" loading="lazy" decoding="async" src="${esc(img(s.img, 128))}"><span>${esc(shortName(s))}</span></a>`).join("") || `<span class="bk-empty">这个条件下没有</span>`}${cands[i].length > 9 ? `<a class="more" href="${pickHref(i)}"><b>全部</b><b>${cands[i].length} 件 ›</b></a>` : ""}</div></div>`).join("")}
      ${folio("套·2")}`;
    return { left, right, k, pName };
  }

  // ===== taste test: one card at a time, swipe right to like, left to pass =====
  // The book learns which colours, finishes and looks you go for. Kept in this browser only.
  const TASTE_KEY = "cs-vault-taste-v2";
  function loadTaste() {
    try { const t = JSON.parse(localStorage.getItem(TASTE_KEY)); if (t && t.f) return t; } catch (e) { /* storage blocked */ }
    return { n: 0, f: {}, likes: [], nopes: [] };
  }
  let taste = loadTaste();
  const saveTaste = () => { try { localStorage.setItem(TASTE_KEY, JSON.stringify(taste)); } catch (e) { /* storage blocked */ } };
  const DUEL_MIN = 15;

  function traits(s) {
    const m = metrics(s);
    const out = {};
    out.color = m.neutral >= 0.6 || m.hue == null ? "黑白灰" : hueName(m.hue);
    if (m.chroma >= 0.3) out.vivid = m.sat > 0.55 ? "鲜艳" : m.sat < 0.32 ? "低调" : "适中";
    out.busy = m.busy ? "花哨" : "素净";
    out.light = m.light > 0.6 ? "浅色" : m.light < 0.35 ? "深色" : "中等明暗";
    if (s.fs) out.style = FS[s.fs];
    out.kind = KIT_SLOTS.find((sl) => sl.test(s))?.name || s.catName;
    return out;
  }
  const TRAIT_NAMES = { color: "颜色", vivid: "鲜艳度", busy: "花色", light: "明暗", style: "涂装风格" };
  const pref = (dim, val) => { const r = taste.f[dim + ":" + val]; return r ? (r.w + 1) / (r.s + 2) : 0.5; };
  const likeScore = (s) => Object.entries(traits(s)).filter(([d]) => TRAIT_NAMES[d]).reduce((sum, [d, v]) => sum + (pref(d, v) - 0.5), 0);
  const seenSet = () => new Set(taste.likes.concat(taste.nopes));

  // the deck: mostly random, and once the book knows you, about a third are likely favourites
  let card = null, nextCard = null, lastAction = null;
  function draw() {
    const seen = seenSet();
    const slot = KIT_SLOTS[Math.floor(Math.random() * KIT_SLOTS.length)];
    const pool = skins.filter((s) => slot.test(s) && s.img && !seen.has(s.id) && (!card || s.name !== card.name));
    const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
    if (!pool.length) return rnd(skins.filter((s) => s.img));
    if (taste.n >= DUEL_MIN && Math.random() < 0.35) return rnd(pool.slice().sort((a, b) => likeScore(b) - likeScore(a)).slice(0, 30));
    return rnd(pool);
  }

  function record(s, like) {
    const t = traits(s);
    for (const d of Object.keys(TRAIT_NAMES)) {
      if (t[d] == null) continue;
      const k = d + ":" + t[d], r = taste.f[k] || (taste.f[k] = { w: 0, s: 0 });
      r.s += 1; r.w += like ? 1 : 0;
    }
    (like ? taste.likes : taste.nopes).push(s.id);
    taste.n += 1;
    saveTaste();
  }
  function unrecord(s, like) {
    const t = traits(s);
    for (const d of Object.keys(TRAIT_NAMES)) {
      const r = t[d] != null && taste.f[d + ":" + t[d]];
      if (r) { r.s -= 1; r.w -= like ? 1 : 0; }
    }
    const list = like ? taste.likes : taste.nopes;
    const i = list.lastIndexOf(s.id); if (i >= 0) list.splice(i, 1);
    taste.n -= 1;
    saveTaste();
  }

  function duelSpread() {
    if (!card) card = draw();
    if (!nextCard) nextCard = draw();
    const t = traits(card);
    const likes = taste.likes.map((id) => byId.get(id)).filter(Boolean).reverse();
    const mini = (s) => `<a href="#/skin/${enc(s.id)}" class="see" style="--rc:${rc(s)}"><img alt="" loading="lazy" decoding="async" src="${esc(img(s.img, 128))}"><span>${esc(shortName(s))}</span></a>`;
    const stage = `<div class="bk-swipe" id="bk-swipe">
        <div class="bk-card under" aria-hidden="true"><span class="bk-photo"><img alt="" decoding="async" src="${esc(img(nextCard.img, 512))}"></span></div>
        <div class="bk-card" id="bk-card" style="--rc:${rc(card)}">
          <span class="bk-card-mark like">喜欢</span><span class="bk-card-mark nope">不要</span>
          <span class="bk-photo"><img alt="${esc(card.name)}" decoding="async" src="${esc(img(card.img, 512))}"></span>
          <span class="bk-card-cap"><b>${esc(t.kind)}</b><small>先凭感觉，名字划走后揭晓</small></span>
        </div>
      </div>
      <div class="bk-swipe-btns">
        <button class="nope" data-swipe="nope" aria-label="不要">✕<small>不要</small></button>
        <button class="undo" data-swipe="undo" ${lastAction ? "" : "disabled"} aria-label="撤回">↶<small>撤回</small></button>
        <button class="like" data-swipe="like" aria-label="喜欢">♥<small>喜欢</small></button>
      </div>
      <p class="bk-swipe-last">${lastAction ? `${lastAction.like ? "喜欢了" : "划走了"}：${esc(lastAction.s.weaponName.replace(/（★）/, ""))} · ${esc(shortName(lastAction.s))}` : "左滑不要，右滑喜欢；也可以按 ← →"}</p>`;
    const side = `${run("心动清单", `${taste.likes.length} 件`)}
      <div class="bk-sec"><h3>最近喜欢的</h3><div class="bk-strip">${likes.slice(0, 10).map(mini).join("") || `<span class="bk-empty">右滑喜欢的会出现在这里</span>`}</div></div>
      <div class="bk-sec"><h3>进度</h3><p class="bk-src">已看 ${taste.n} 件，喜欢 ${taste.likes.length} 件${taste.n ? `（${Math.round(taste.likes.length / taste.n * 100)}%）` : ""}。${taste.n >= DUEL_MIN ? `<a class="bk-same" href="#/taste">看我的审美档案 ›</a>` : `再看 ${DUEL_MIN - taste.n} 件可以生成审美档案。`}</p></div>`;
    if (!wideQuery.matches) return { left: `${run("审美测试", `已看 ${taste.n} 件`)}${stage}`, right: side, rightEmpty: false };
    return { left: `${run("审美测试", `已看 ${taste.n} 件`)}${stage}${folio("审")}`, right: `${side}${folio("心")}` };
  }

  // drag the card; past a third of its width it flies off
  function bindCard() {
    const el = document.getElementById("bk-card");
    if (!el || el.dataset.bound) return;
    el.dataset.bound = "1";
    let sx = 0, sy = 0, dx = 0, dragging = false;
    const set = (x, y, anim) => {
      el.style.transition = anim ? "transform .25s ease" : "none";
      el.style.transform = `translate(${x}px, ${y * 0.3}px) rotate(${x / 18}deg)`;
      el.style.setProperty("--like", Math.max(0, Math.min(1, x / 120)));
      el.style.setProperty("--nope", Math.max(0, Math.min(1, -x / 120)));
    };
    el.addEventListener("pointerdown", (e) => { dragging = true; sx = e.clientX; sy = e.clientY; dx = 0; el.setPointerCapture(e.pointerId); });
    el.addEventListener("pointermove", (e) => { if (!dragging) return; dx = e.clientX - sx; set(dx, e.clientY - sy, false); });
    const end = () => {
      if (!dragging) return; dragging = false;
      if (Math.abs(dx) > Math.min(140, el.offsetWidth / 3)) swipe(dx > 0 ? "like" : "nope");
      else set(0, 0, true);
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  function swipe(kind) {
    if (!card) return;
    if (kind === "undo") {
      if (!lastAction) return;
      unrecord(lastAction.s, lastAction.like);
      nextCard = card; card = lastAction.s; lastAction = null;
      route(false, 0); return;
    }
    const like = kind === "like";
    const el = document.getElementById("bk-card");
    const done = () => {
      record(card, like);
      lastAction = { s: card, like };
      card = nextCard; nextCard = draw();
      route(false, 0);
    };
    if (el && !reduceMotion) {
      el.style.transition = "transform .3s ease-in, opacity .3s ease-in";
      el.style.transform = `translate(${like ? 140 : -140}%, 6%) rotate(${like ? 22 : -22}deg)`;
      el.style.opacity = "0";
      el.style.setProperty(like ? "--like" : "--nope", 1);
      setTimeout(done, 280);
    } else done();
  }

  function tasteSpread() {
    const rows = (dim) => Object.keys(taste.f).filter((k) => k.startsWith(dim + ":")).map((k) => [k.slice(dim.length + 1), taste.f[k]])
      .filter(([, r]) => r.s >= 2).map(([v, r]) => [v, (r.w + 1) / (r.s + 2), r]).sort((a, b) => b[1] - a[1]);
    const bars = (dim) => {
      const vals = rows(dim);
      if (!vals.length) return "";
      return `<div class="bk-taste-dim"><h3>${TRAIT_NAMES[dim]}</h3>${vals.slice(0, 5).map(([v, p, r]) => `<div class="bk-taste-row"><span class="v">${dim === "style" ? `<span class="fs-${FS.indexOf(v)}">${esc(v)}</span>` : esc(v)}</span><span class="bar"><i style="width:${Math.round(p * 100)}%"></i></span><span class="n">${Math.round(p * 100)}%</span><small>${r.w}/${r.s}</small></div>`).join("")}</div>`;
    };
    const top = (dim) => (rows(dim)[0] || [])[0] || null;
    const favColor = top("color"), favStyle = top("style"), favBusy = top("busy"), favVivid = top("vivid");
    const verdict = [favColor && `偏爱${favColor}`, favVivid && `喜欢${favVivid}`, favBusy, favStyle && (favStyle.endsWith("涂装") ? favStyle : `${favStyle}涂装`)].filter(Boolean).join("、");
    const colorId = favColor && favColor !== "黑白灰" ? (COLORS.find((c) => c[1] === favColor) || [])[0] : null;
    const kitHref = favColor === "黑白灰" ? "#/kit/neutral.red" : colorId ? `#/kit/mono.${colorId}` : "#/kit/mono.red";
    const liked = taste.likes.map((id) => byId.get(id)).filter(Boolean).reverse();
    const seen = seenSet(), names = new Set(), recU = [];
    for (const s of skins.filter((x) => !seen.has(x.id) && x.img).map((x) => [x, likeScore(x)]).sort((a, b) => b[1] - a[1]).map(([x]) => x)) {
      if (!names.has(s.name)) { names.add(s.name); recU.push(s); } if (recU.length >= 8) break;
    }
    const mini = (s) => `<a href="#/skin/${enc(s.id)}" class="see" style="--rc:${rc(s)}"><img alt="" loading="lazy" decoding="async" src="${esc(img(s.img, 128))}"><span>${esc(shortName(s))}</span></a>`;
    const left = `${run("审美档案", `${taste.n} 件`)}
      <div class="bk-duel-head"><span class="bk-ch-no">审美档案</span><h2 class="bk-h">${taste.n < DUEL_MIN ? "还需要多看几件" : "你的口味"}</h2></div>
      ${taste.n < DUEL_MIN ? `<p class="bk-p">再看 ${DUEL_MIN - taste.n} 件就能生成档案。<a class="bk-same" href="#/duel">继续 ›</a></p>` : `
      <p class="bk-taste-verdict">${esc(verdict || "口味还不明显，多看几件会更准")}</p>
      ${Object.keys(TRAIT_NAMES).map(bars).join("")}
      <p class="bk-src">百分比是这类皮肤你右滑喜欢的比例，越高越喜欢。<a class="bk-same" href="#/duel">继续 ›</a></p>`}
      ${folio("审·1")}`;
    const right = `${run("心动清单", `${liked.length} 件`)}
      <div class="bk-sec"><h3>你喜欢的 · ${liked.length} 件</h3><div class="bk-strip wrap">${liked.map(mini).join("") || `<span class="bk-empty">还没有</span>`}</div></div>
      ${taste.n >= DUEL_MIN ? `<div class="bk-sec"><h3>没看过，但你应该会喜欢</h3><div class="bk-strip">${recU.map(mini).join("")}</div></div>
      <div class="bk-sec"><h3>用你的口味配一套</h3><p class="bk-src"><a href="${kitHref}">按${esc(favColor || "红")}色配一套 ›</a>${favStyle ? `　<a href="#/kit/theme.${FS.indexOf(favStyle)}">按${esc(favStyle)}配一套 ›</a>` : ""}</p></div>` : ""}
      <div class="bk-sec"><h3>记录</h3><p class="bk-src">只存在这台设备的这个浏览器里。<a href="#" data-taste-reset>${tasteResetArmed ? "再点一次确认清空" : "清空重来"}</a></p></div>
      ${folio("审·2")}`;
    return { left, right };
  }
  let tasteResetArmed = false;

  // How many photos fit on one page: aim for plates about 240px wide with 4:3 photos,
  // sized from the real page so both pages always hold the same number of equal cells.
  function gridShape(tall) {
    if (!wideQuery.matches) return { cols: innerWidth < 560 ? 2 : 3, rows: innerWidth < 560 ? 4 : 3 };
    const pg = $(".bk-left", app);
    const w = (pg ? pg.clientWidth : 560) - 76;                                   // side padding
    const h = (pg ? pg.clientHeight : 600) - 24 - 30 - 24 - (tall ? 84 : 52) - 26 - 14 * 3; // padding, running head, header, folio, gaps
    let cols = 4;
    while (cols > 2 && (w - 16 * (cols - 1)) / cols < 170) cols -= 1;   // plates at least 170px wide
    const cw = (w - 16 * (cols - 1)) / cols;
    const rows = Math.max(1, Math.min(4, Math.floor((h + 14) / (cw * 0.5 + 34 + 14))));
    return { cols, rows };
  }

  function sheetSpread({ title, sub, list, base, page, runLabel, extra, extraRight, cell = cellOf }) {
    const shape = gridShape(!!extra);
    const PER_PAGE = shape.cols * shape.rows;
    const gstyle = ` style="--cols:${shape.cols};--rows:${shape.rows}"`;
    const per = PER_PAGE * 2;
    const pages = Math.max(1, Math.ceil(list.length / per));
    const p = Math.min(page, pages - 1);
    const from = p * per;
    const a = list.slice(from, from + PER_PAGE), b = list.slice(from + PER_PAGE, from + per);
    const range = list.length ? `第 ${from + 1}–${Math.min(list.length, from + per)} 件 / 共 ${list.length}` : "无结果";
    // Both pages get a header block of the same height, so the two grids line up cell for cell.
    const tall = extra ? " tall" : "";
    const left = `${run(esc(runLabel || title), "图版索引")}
      <div class="bk-sheet-top${tall}"><div class="bk-sheet-head"><h2 class="bk-h">${esc(title)}</h2>${sub ? `<span>${esc(sub)}</span>` : ""}</div>${extra || ""}</div>
      ${list.length ? `<div class="bk-grid"${gstyle}>${a.map(cell).join("")}</div>` : `<p class="bk-empty">没有查到。可以试试武器名、皮肤名或英文名，比如“AK 火神”或“Doppler”。</p>`}
      ${folio(p * 2 + 1)}`;
    const right = `${run(range, pages > 1 ? `${p + 1} / ${pages} 页` : "")}
      ${extraRight ? `<div class="bk-sheet-top${tall} side">${extraRight}</div>` : `<div class="bk-sheet-top${tall} mirror" aria-hidden="true"><span>续 · ${esc(title)}</span></div>`}
      <div class="bk-grid"${gstyle}>${b.map(cell).join("")}</div>
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
  const caseRow = (c) => `<a class="bk-idx-row" href="#/case/${enc(c.id)}"><span class="th">${c.img ? `<img loading="lazy" decoding="async" alt="" src="${esc(img(c.img, 128))}">` : ""}</span><span class="t">${esc(c.name)}<small>${esc(c.date || "")}</small></span><span class="dots"></span><span class="n">${c.items.length}</span></a>`;
  // a collection is shown by its rarest skin; the set's own icon is the fallback
  const collRow = (c, n) => {
    const top = best(skinsByColl.get(c.id) || []);
    const pic = top && top.img ? img(top.img, 128) : c.img;
    return `<a class="bk-idx-row" href="#/coll/${enc(c.id)}"><span class="th"${top ? ` style="--rc:${rc(top)}"` : ""}>${pic ? `<img loading="lazy" decoding="async" alt="" src="${esc(pic)}">` : ""}</span><span class="t">${esc(c.name)}</span><span class="dots"></span><span class="n">${n}</span></a>`;
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
  const fileCode = (s) => `FM-${s.weapon.replace(/^weapon_(knife_)?/, "").replace(/_/g, "").toUpperCase().slice(0, 6)}-${String(s._n).padStart(4, "0")}`;

  function itemSpread(s, list) {
    const idx = list.indexOf(s);
    const variants = skinsByName.get(s.name) || [s];
    const cratesOf = s.crates.map((id) => crateById.get(id)).filter(Boolean);
    const colls = s.coll.map((id) => meta.collections[id]).filter(Boolean);
    const min = s.min ?? 0, max = s.max ?? 1;
    const avail = WEARS.map((w) => w[3] > min && w[2] < max);
    const r = rarityById[s.rarity] || { name: "", color: "#6b6f5e" };
    const rank = (rarityRank[s.rarity] ?? 0) + 1;
    const [sibLabel, sibs] = siblings(s);
    const n = s._n;
    const left = `${run(`${esc(s.catName)} · ${esc(s.weaponName)}`, `图版 ${pad2(idx + 1)}`)}
      <figure class="bk-plate">
        <span class="tape t1" aria-hidden="true"></span><span class="tape t2" aria-hidden="true"></span>
        <div class="bk-photo" style="--rc:${r.color}">${s.img ? `<img alt="${esc(s.name)}" src="${esc(img(s.img, 512))}">` : `<span class="bk-noimg">图版缺失</span>`}</div>
        <figcaption><b>图 ${pad2(idx + 1)}</b> ${esc(s.name)}${s.phase ? `（${esc(s.phase)}）` : ""}</figcaption>
      </figure>
      ${variants.length > 1 ? `<div class="bk-strip" aria-label="同款其他版本">${variants.map((v) => `<a href="#/skin/${enc(v.id)}" data-replace aria-current="${v.id === s.id}"><img alt="" loading="lazy" decoding="async" src="${esc(img(v.img, 128))}"><span>${esc(v.phase || "默认")}</span></a>`).join("")}</div>` : ""}
      <div class="bk-note"><span class="bk-note-h">军需官备注</span><p>${esc(dealerLine(s, avail))}</p></div>
      ${folio(n * 2)}`;
    const right = `${run(fileCode(s), esc(r.name))}
      <div class="bk-stamp" aria-hidden="true">${STAMPS[rank] || "机密"}</div>
      <div class="bk-kicker">${esc(s.weaponName)}${s.weaponEn && s.weaponEn !== s.weaponName ? ` ／ ${esc(s.weaponEn)}` : ""}</div>
      <h2 class="bk-item-h${s.fs ? ` fs-${s.fs}` : ""}">${esc(shortName(s))}</h2>
      <div class="bk-en">${esc((s.en.split("|")[1] || s.en).trim())}</div>
      <table class="bk-form">
        <tr><th>等级</th><td><span class="bk-rank" style="--rc:${r.color}">${"■".repeat(rank)}${"□".repeat(Math.max(0, 7 - rank))}</span> ${esc(r.name)}</td></tr>
        <tr><th>磨损区间</th><td>${min.toFixed(2)} — ${max.toFixed(2)}</td></tr>
        <tr><th>可出外观</th><td class="bk-checks">${WEARS.map((w, i) => `<span class="${avail[i] ? "on" : ""}">${avail[i] ? "☒" : "☐"} ${WEAR_SHORT[i]}</span>`).join("")}</td></tr>
        ${s.colors && s.colors.length ? `<tr><th>主色</th><td class="bk-sws inline">${s.colors.map((c) => swatch(c, `#/color/${c}/${enc(s.catName)}/0`, false)).join("")}<a class="bk-same" href="#/color/${s.colors.join("+")}/${enc(s.catName)}/0">同色系${esc(s.catName)} ›</a><a class="bk-same" href="#/kit/mono.${s.colors[0]}/${enc(s.id)}">以它配一套 ›</a></td></tr>` : ""}
        ${s.fs ? `<tr><th>涂装风格</th><td>${fsTag(s.fs, `#/style/${s.fs}/all/0`, false)} <small class="bk-en-small">${FS_EN[s.fs]}</small></td></tr>` : ""}
        ${s.pi ? `<tr><th>涂装编号</th><td>${s.pi}</td></tr>` : ""}
        <tr><th>附加</th><td>${[s.st && "StatTrak™", s.sv && "纪念品", s.phase].filter(Boolean).map(esc).join("　") || "—"}</td></tr>
        ${s.pattern ? `<tr><th>涂装</th><td>${esc(s.pattern)}</td></tr>` : ""}
      </table>
      ${s.desc ? `<p class="bk-desc">${esc(s.desc)}</p>` : ""}
      ${s.lore ? `<p class="bk-lore">“${esc(s.lore)}”</p>` : ""}
      <div class="bk-sec"><h3>出处与索引</h3>
        <div class="bk-xref">
          ${cratesOf.map((c) => `<a href="#/case/${enc(c.id)}"><span class="th">${c.img ? `<img loading="lazy" decoding="async" alt="" src="${esc(img(c.img, 128))}">` : ""}</span><span><small>${ctypeOf(c)[1]}</small>${esc(c.name)}</span></a>`).join("")}
          ${colls.map((c) => `<a href="#/coll/${enc(c.id)}"><span class="th">${c.img ? `<img loading="lazy" decoding="async" alt="" src="${esc(img(c.img, 128))}">` : ""}</span><span><small>收藏品</small>${esc(c.name)}</span></a>`).join("")}
          <a href="#/w/${enc(s.weapon)}/0"><span class="th"><img loading="lazy" decoding="async" alt="" src="${esc(img(s.img, 128))}"></span><span><small>武器</small>全部 ${esc(s.weaponName)}</span></a>
        </div>
        ${!colls.length && !cratesOf.length ? `<p class="bk-src">出处不详</p>` : ""}
      </div>
      ${(() => { const same = (skinsByFinish.get(finish(s)) || []).filter((x) => x.weapon !== s.weapon); const seen = new Set(); const u = same.filter((x) => !seen.has(x.weapon) && seen.add(x.weapon)); return u.length ? `<div class="bk-sec"><h3>同款涂装 · 其他武器 ${u.length} 件</h3><div class="bk-strip">${u.map((x) => `<a href="#/skin/${enc(x.id)}" class="see" style="--rc:${rc(x)}"><img alt="" loading="lazy" decoding="async" src="${esc(img(x.img, 128))}"><span>${esc(x.weaponName)}</span></a>`).join("")}</div></div>` : ""; })()}
      ${sibs.length ? `<div class="bk-sec"><h3>参见 · ${esc(sibLabel)}</h3><div class="bk-strip">${sibs.map((x) => `<a href="#/skin/${enc(x.id)}" style="--rc:${rc(x)}" class="see"><img alt="" loading="lazy" decoding="async" src="${esc(img(x.img, 128))}"><span>${esc(shortName(x))}</span></a>`).join("")}</div></div>` : ""}
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
    const hit = (hay) => terms.every((t) => hay.includes(t));
    const a = skins.filter((s) => hit(s._h ?? (s._h = `${s.name} ${s.en} ${s.weaponName} ${s.weaponEn} ${s.pattern} ${s.phase}`.toLowerCase()))).sort(byRarity);
    const b = [...xById.values()].filter((it) => hit(it._h ?? (it._h = `${xFull(it)} ${it.en} ${it.team || ""} ${it.pl || ""} ${it.ev || ""} ${it.sub || ""}`.toLowerCase())))
      .sort((x, y) => xRar(y).rank - xRar(x).rank);
    return a.concat(b);
  }
  // stickers are only searchable once loaded, so a search pulls in the rest in the background
  function loadAllStickers() {
    const ch = xChapter("stickers");
    if (!ch) return true;
    const missing = ch.sections.filter((sec) => !sec.items);
    if (!missing.length) return true;
    if (!loading.has("*")) {
      const want = location.hash;
      loading.set("*", Promise.all(missing.map((sec) => fetch(`data/${ch.file}/${sec.id}.json`).then((r) => r.json()).then((items) => register(ch, sec, items)).catch(() => {})))
        .then(() => { loading.delete("*"); if (location.hash === want) route(true); }));
    }
    return false;
  }

  // ===== routing =====
  // Each view carries an `order` so the book can tell whether to turn forward or back.
  let fromList = null;   // { list, crumbs, key } of the last index sheet, used to page through items
  let state = null;

  function sheetView(order, tab, list, base, page, title, sub, runLabel, crumbs, extra, extraRight) {
    const sp = sheetSpread({ title, sub, list, base, page, runLabel, extra, extraRight });
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
      const xi = xch.findIndex((c) => c.name === arg);
      if (ci < 0 && xi >= 0) return { kind: "chapter", order: [2, cats.length + xi], tab: xch[xi].key, crumbs: [[xch[xi].name, null]], ...xChapterSpread(xi) };
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
      const all = loadAllStickers();
      const list = search(q);
      return sheetView([3, 99, q], null, list, `#/search/${enc(q)}`, page(arg2), `检索：${q}`, `${list.length} 件${all ? "" : " · 贴纸检索中…"}`, "检索结果", [[`检索：${q}`, null]]);
    }
    if (kind === "s" || kind === "x") {
      const ch = xChapter(arg), xi = xch.indexOf(ch);
      const sec = ch && ch.sections.find((x) => x.id === arg2);
      if (!sec) return resolve("#/toc");
      const chCrumb = [ch.name, `#/c/${enc(ch.name)}`];
      if (!ensureSection(ch, sec)) return { kind: "loading", order: [3, cats.length + xi, sec.id], tab: ch.key, crumbs: [chCrumb, [sec.name, null]], ...loadingSpread(sec.name) };
      if (kind === "s") {
        return sheetView([3, cats.length + xi, sec.id], ch.key, sec.items, `#/s/${ch.key}/${enc(sec.id)}`, page(parts[3]), sec.name, `${sec.items.length} 件`, `${ch.name} · ${sec.name}`, [chCrumb, [sec.name, null]], undefined, undefined);
      }
      const it = xById.get(parts[3]);
      if (!it) return resolve(`#/s/${ch.key}/${enc(sec.id)}/0`);
      let src = fromList && fromList.list.includes(it) ? fromList : { list: sec.items, key: `#/s/${ch.key}/${enc(sec.id)}`, crumbs: [chCrumb, [sec.name, `#/s/${ch.key}/${enc(sec.id)}/0`]] };
      const sp = xItemSpread(it, src.list);
      return { kind: "skin", order: [4, src.key, sp.idx], tab: ch.key, crumbs: [...src.crumbs, [it.n, null]], ...sp };
    }
    if (kind === "duel") return { kind: "duel", order: [3, 94], tab: "taste", crumbs: [["审美测试", null]], ...duelSpread() };
    if (kind === "taste") return { kind: "taste", order: [3, 94, 1], tab: "taste", crumbs: [["审美测试", "#/duel"], ["审美档案", null]], ...tasteSpread() };
    if (kind === "kitpick") {
      if (!hasColors) return resolve("#/toc");
      const slot = Math.max(0, Math.min(KIT_SLOTS.length - 1, parseInt(arg2, 10) || 0));
      const sp = kitSpread(arg, parts[3], parts[4], slot, page(parts[5]));
      return { kind: "sheet-kit", order: [4, 97, kitKey(sp.k), slot, sp.page], tab: null, crumbs: [["配色套装", sp.backTo], [`挑选${KIT_SLOTS[slot].name}`, null]], ...sp };
    }
    if (kind === "kit") {
      if (!hasColors) return resolve("#/toc");
      const sp = kitSpread(arg, arg2, parts[3]);
      return { kind: "kit", order: [3, 97, kitKey(sp.k)], tab: null, crumbs: [["配色套装", null], [`${MODES.find((x) => x[0] === sp.k.mode)[1]} · ${sp.pName}`, null]], ...sp };
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
      const extra = `<div class="bk-filter"><span class="bk-filter-h">颜色</span>
          <div class="bk-sws">${COLORS.map((c) => { const t = toggle(c[0]); return t.length ? swatch(c[0], href(t, cat), ids.includes(c[0]), "data-replace") : swatch(c[0], href(ids, cat), true, "data-replace"); }).join("")}</div></div>`;
      const extraRight = `<div class="bk-filter"><span class="bk-filter-h">类别</span>
          <div class="bk-chips"><a data-replace href="${href(ids, "all")}"${cat === "all" ? ' aria-current="true"' : ""}>全部</a>${cats.map((c) => `<a data-replace href="${href(ids, c.name)}"${cat === c.name ? ' aria-current="true"' : ""}>${esc(TAB_SHORT[c.name] || c.name)}</a>`).join("")}</div>
        </div>`;
      const extraFull = extra.replace("</div></div>", `</div><a class="bk-same" href="#/kit/mono.${ids[0]}">配一套 ›</a></div>`);
      return sheetView([3, 98, ids.join("+"), cat], null, list, `#/color/${ids.join("+")}/${enc(cat)}`, page(parts[3]), `${name}色系`, `${list.length} 件${cat !== "all" ? ` · ${cat}` : ""}`, "按颜色检索", [["按颜色", null], [`${name}色系`, null]], extraFull, extraRight);
    }
    if (kind === "style") {
      const n = FS[+arg] ? +arg : 1;
      const cat = arg2 && arg2 !== "all" && cats.some((c) => c.name === arg2) ? arg2 : "all";
      const list = skins.filter((s) => s.fs === n && (cat === "all" || s.catName === cat)).sort(byRarity);
      const href = (m, ct) => `#/style/${m}/${enc(ct)}/0`;
      const extra = `<div class="bk-filter"><span class="bk-filter-h">风格</span><div class="bk-chips">${FS_ORDER.map((m) => fsTag(m, href(m, cat), m === n, "data-replace")).join("")}</div></div>`;
      const extraRight = `<div class="bk-filter"><span class="bk-filter-h">类别</span><div class="bk-chips"><a data-replace href="${href(n, "all")}"${cat === "all" ? ' aria-current="true"' : ""}>全部</a>${cats.filter((c) => c.name !== "手套").map((c) => `<a data-replace href="${href(n, c.name)}"${cat === c.name ? ' aria-current="true"' : ""}>${esc(TAB_SHORT[c.name] || c.name)}</a>`).join("")}</div><a class="bk-same" href="#/kit/theme.${n}">配一套 ›</a></div>`;
      return sheetView([3, 96, n, cat], null, list, `#/style/${n}/${enc(cat)}`, page(parts[3]), FS[n], `${FS_EN[n]} · ${list.length} 件`, "按涂装风格", [["按涂装风格", null], [FS[n], null]], extra, extraRight);
    }
    if (kind === "by") {
      // reverse index for stickers and other items: same capsule, team, player or event
      const field = { src: "src", team: "team", pl: "pl", ev: "ev" }[arg];
      if (!field) return resolve("#/toc");
      const v = arg2 || "";
      const all = loadAllStickers();
      const list = [...xById.values()].filter((it) => it[field] === v).sort((a, b) => xRar(b).rank - xRar(a).rank);
      const label = { src: "来源", team: "战队", pl: "选手", ev: "赛事" }[arg];
      return sheetView([3, 95, arg, v], null, list, `#/by/${arg}/${enc(v)}`, page(parts[3]), v, `${label} · ${list.length} 件${all ? "" : " · 检索中…"}`, `按${label}`, [[label, null], [v, null]]);
    }
    if (kind === "cases") {
      const t = CTYPES.find((x) => x[0] === arg);
      if (t) {
        const list = crates.filter(t[2]);
        const sp = listSpread({ title: `附录甲 · ${t[1]}`, en: "CONTAINERS", rows: list.map(caseRow), base: `#/cases/${t[0]}`, page: page(arg2) });
        return { kind: "list", order: [2, 90, CTYPES.indexOf(t), sp.page], tab: "cases", crumbs: [["箱子与胶囊", "#/cases"], [t[1], null]], ...sp };
      }
      const groups = CTYPES.map((x) => [x, crates.filter(x[2])]).filter(([, l]) => l.length);
      const left = `${run("附录甲", "CONTAINERS")}
        <div class="bk-chapter"><span class="bk-ch-no">附录甲</span><h2 class="bk-ch-title long">箱子与胶囊</h2><span class="bk-ch-en">CONTAINERS</span>
        <p class="bk-p">收录游戏中全部可开启的容器 ${crates.length} 个：武器箱、纪念包、印花与签名胶囊、音乐盒集、布章包、胸章胶囊、涂鸦箱，以及终端机。按类型分节，新的在前；点开任意一个，可看到里面的全部物品。</p></div>
        ${folio("附·1")}`;
      const right = `${run("附录甲", "分节索引")}<h2 class="bk-h">分节索引</h2>
        <nav class="bk-index">${groups.map(([x, l]) => `<a class="bk-idx-row" href="#/cases/${x[0]}/0"><span class="th">${l[0].img ? `<img loading="lazy" decoding="async" alt="" src="${esc(img(l[0].img, 128))}">` : ""}</span><span class="t">${x[1]}<small>最新：${esc(l[0].name)}</small></span><span class="dots"></span><span class="n">${l.length}</span></a>`).join("")}</nav>
        ${folio("附·2")}`;
      return { kind: "list", order: [2, 90], tab: "cases", crumbs: [["箱子与胶囊", null]], left, right };
    }
    if (kind === "colls") {
      const counts = {};
      skins.forEach((s) => s.coll.forEach((c) => { counts[c] = (counts[c] || 0) + 1; }));
      const rows = Object.values(meta.collections).sort((a, b) => a.name.localeCompare(b.name, "zh")).map((c) => collRow(c, counts[c.id] || 0));
      // agent and charm collections live in their own chapters; they are listed here too
      const xs = new Map();
      ["agents", "charms"].forEach((k) => { const ch = xChapter(k); if (ch) ch.sections.forEach((sec) => (sec.items || []).forEach((it) => { if (it.src) { if (!xs.has(it.src)) xs.set(it.src, []); xs.get(it.src).push(it); } })); });
      [...xs.entries()].sort((a, b) => a[0].localeCompare(b[0], "zh")).forEach(([name, items]) => {
        const top = items.slice().sort((a, b) => xRar(b).rank - xRar(a).rank)[0];
        rows.push(`<a class="bk-idx-row" href="#/by/src/${enc(name)}/0"><span class="th" style="--rc:${xRar(top).color}">${top.img ? `<img loading="lazy" decoding="async" alt="" src="${esc(img(top.img, 128))}">` : ""}</span><span class="t">${esc(name)}<small>${top._ch === "agents" ? "探员" : "挂件"}</small></span><span class="dots"></span><span class="n">${items.length}</span></a>`);
      });
      const sp = listSpread({ title: "附录乙 · 收藏品", en: "COLLECTIONS", rows, base: "#/colls", page: page(arg) });
      return { kind: "list", order: [2, 91, sp.page], tab: "colls", crumbs: [["附录乙 · 收藏品", null]], ...sp };
    }
    if (kind === "case") {
      const c = crateById.get(arg);
      if (!c) return resolve("#/cases");
      const t = ctypeOf(c);
      const crumbs = [["箱子与胶囊", "#/cases"], [t[1], `#/cases/${t[0]}/0`], [c.name, null]];
      // sticker capsules need their sticker sections loaded first
      const stk = xChapter("stickers");
      const waiting = (c.secs || []).map((id) => stk && stk.sections.find((x) => x.id === id)).filter((sec) => sec && !ensureSection(stk, sec));
      if (waiting.length) return { kind: "loading", order: [3, 90, c.id], tab: "cases", crumbs, ...loadingSpread(c.name) };
      const got = c.items.map((id) => byId.get(id) || xById.get(id)).filter(Boolean);
      const sk = got.filter((x) => x.weapon).sort(byRarity), ex = got.filter((x) => !x.weapon).sort((a, b) => xRar(b).rank - xRar(a).rank);
      const rare = c.rare.map((id) => byId.get(id)).filter(Boolean).sort(byRarity);
      const list = sk.concat(ex, rare);
      return sheetView([3, 90, c.id], "cases", list, `#/case/${enc(c.id)}`, page(arg2), c.name, `${t[1]}${c.date ? " · " + c.date : ""} · ${got.length} 件${rare.length ? ` + ★ ${rare.length}` : ""}`, c.name, crumbs);
    }
    if (kind === "coll") {
      const c = meta.collections[arg];
      if (!c) return resolve("#/colls");
      const list = (skinsByColl.get(arg) || []).slice().sort(byRarity);
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
    const tab = (href, key, name, cls = "") => `<a href="${href}" data-tab="${key}" title="${esc(name)}" aria-label="${esc(name)}"${cls ? ` class="${cls}"` : ""}>${esc(TAB_CHAR[name] || name.slice(0, 1))}</a>`;
    $(".bk-tabs", app).innerHTML = cats.map((c, i) => tab(`#/c/${enc(c.name)}`, i, c.name)).join("")
      + xch.map((c, i) => tab(`#/c/${enc(c.name)}`, c.key, c.name, i === 0 ? "part" : "x")).join("")
      + (hasColors ? tab("#/duel", "taste", "审美测试", "part") : "") + tab("#/cases", "cases", "武器箱", "part ap") + tab("#/colls", "colls", "收藏品", "ap");

    app.addEventListener("submit", (e) => {
      const f = e.target.closest("[data-search]");
      if (!f) return;
      e.preventDefault();
      const q = f.q.value.trim();
      if (q) { location.hash = "#/search/" + enc(q); f.q.blur(); }
    });
    app.addEventListener("click", (e) => {
      if (e.target.closest("[data-open]")) { location.hash = "#/toc"; return; }
      const sw = e.target.closest("[data-swipe]");
      if (sw) { e.preventDefault(); swipe(sw.dataset.swipe); return; }
      if (e.target.closest("[data-taste-reset]")) {
        e.preventDefault();
        if (tasteResetArmed) { taste = { n: 0, f: {}, likes: [], nopes: [] }; lastAction = null; saveTaste(); tasteResetArmed = false; }
        else { tasteResetArmed = true; setTimeout(() => { tasteResetArmed = false; }, 4000); }
        route(false, 0); return;
      }
      if (e.target.closest("[data-shuffle]")) { e.preventDefault(); if (kitShuffle) { history.replaceState(null, "", kitShuffle()); route(false, 0); } return; }
      const a = e.target.closest("a[data-replace]");
      if (a) { e.preventDefault(); history.replaceState(null, "", a.getAttribute("href")); route(false, 0); return; }
      const c = e.target.closest(".bk-corner");
      if (c) { e.preventDefault(); turn(c.classList.contains("next") ? 1 : -1); }
    });
    addEventListener("keydown", (e) => {
      if (e.target.closest && e.target.closest("input")) return;
      if (state && state.kind === "duel" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { swipe(e.key === "ArrowLeft" ? "nope" : "like"); return; }
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
    el.addEventListener("pointerdown", (e) => { if (e.target.closest("input, .bk-tabs, .bk-swipe")) return; down = true; swiped = false; sx = e.clientX; sy = e.clientY; t0 = Date.now(); });
    el.addEventListener("pointerup", (e) => {
      if (!down) return; down = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - t0 < 600) { swiped = true; turn(dx < 0 ? 1 : -1); }
    });
    el.addEventListener("pointercancel", () => { down = false; });
    el.addEventListener("click", (e) => { if (swiped) { e.preventDefault(); e.stopPropagation(); swiped = false; } }, true);
  }

  // After a page is shown, fetch the pictures of the pages on either side so turning is instant.
  const warmed = new Set();
  let warmTimer = 0;
  function warmNeighbours(st) {
    clearTimeout(warmTimer);
    warmTimer = setTimeout(() => {
      const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1));
      idle(() => {
        for (const h of [st.next, st.prev]) {
          if (!h || state !== st) continue;
          let v;
          try { v = resolve(h); } catch (e) { continue; }
          const html = (v.left || "") + (v.right || "");
          for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
            const url = m[1].replace(/&amp;/g, "&");
            if (warmed.has(url)) continue;
            warmed.add(url);
            const im = new Image(); im.decoding = "async"; im.src = url;
          }
        }
      });
    }, 350);
  }

  function paint(prev, next, dir) {
    warmNeighbours(next);
    if (next.kind === "duel") setTimeout(bindCard, 0);
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
