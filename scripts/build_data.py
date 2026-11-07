#!/usr/bin/env python3
"""Build the trimmed data files the site loads.

Source: ByMykel/CSGO-API (MIT), Chinese + English item names.
Usage:
    python scripts/build_data.py            # data only
    python scripts/build_data.py --colors   # also download thumbnails and compute each skin's main color
"""
import argparse
import colorsys
import io
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

API = "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/{lang}/{name}.json"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data")

RARITY_ORDER = ["rarity_common_weapon", "rarity_uncommon_weapon", "rarity_rare_weapon",
                "rarity_mythical_weapon", "rarity_legendary_weapon", "rarity_ancient_weapon",
                "rarity_ancient", "rarity_contraband_weapon", "rarity_contraband"]

# Color buckets shown as swatches on the site. Hue ranges in degrees.
HUE_BUCKETS = [("red", 0, 15), ("orange", 15, 40), ("yellow", 40, 70), ("green", 70, 165),
               ("cyan", 165, 195), ("blue", 195, 255), ("purple", 255, 290), ("pink", 290, 345),
               ("red", 345, 361)]


def get(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "cs-vault-build"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def load(lang, name):
    return json.loads(get(API.format(lang=lang, name=name)))


def short_desc(desc):
    """Split the description into the finish text and the italic flavor line."""
    desc = (desc or "").replace("\\n", "\n")
    parts = [p.strip() for p in desc.split("\n") if p.strip()]
    lore = ""
    body = []
    for p in parts:
        if p.startswith("<i>"):
            lore = p.replace("<i>", "").replace("</i>", "").strip()
        else:
            body.append(p)
    return " ".join(body), lore


def strip_weapon_blurb(items):
    """Every skin of a weapon repeats the same weapon blurb first; keep only the finish sentence."""
    by_weapon = {}
    for it in items:
        by_weapon.setdefault(it["weapon"], []).append(it["desc"])
    prefix = {}
    for w, descs in by_weapon.items():
        prefix[w] = os.path.commonprefix(descs) if len(descs) > 1 else ""
    for it in items:
        p = prefix[it["weapon"]]
        if p and len(p) < len(it["desc"]):
            # cut back to the last sentence end inside the shared prefix
            cut = max(p.rfind("。"), p.rfind(". "))
            if cut > 0:
                it["desc"] = it["desc"][cut + 1:].strip()


def main_color(img_bytes):
    from PIL import Image
    im = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
    im.thumbnail((96, 96))
    weights = {}
    neutral = {"black": 0.0, "white": 0.0, "gray": 0.0}
    total = 0.0
    for r, g, b, a in im.getdata():
        if a < 128:
            continue
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        total += 1
        if s < 0.22 or v < 0.16:
            if v < 0.3:
                neutral["black"] += 1
            elif v > 0.75 and s < 0.15:
                neutral["white"] += 1
            else:
                neutral["gray"] += 1
            continue
        deg = h * 360
        name = next(n for n, lo, hi in HUE_BUCKETS if lo <= deg < hi)
        if name == "orange" and v < 0.55:
            name = "brown"
        # saturated pixels count more: they are what people notice
        weights[name] = weights.get(name, 0.0) + 0.6 + s * v
    if not total:
        return None
    chroma = sum(weights.values())
    if weights and chroma / total > 0.12:
        ranked = sorted(weights.items(), key=lambda kv: -kv[1])
        out = [ranked[0][0]]
        if len(ranked) > 1 and ranked[1][1] > ranked[0][1] * 0.45:
            out.append(ranked[1][0])
        return out
    return [max(neutral.items(), key=lambda kv: kv[1])[0]]


def compute_colors(skins):
    def work(s):
        try:
            return s["id"], main_color(get(s["img"] + "/128fx128f", timeout=30))
        except Exception as e:  # network hiccups should not fail the build
            print("color failed", s["id"], e, file=sys.stderr)
            return s["id"], None

    with ThreadPoolExecutor(16) as ex:
        res = dict(ex.map(work, skins))
    for s in skins:
        if res.get(s["id"]):
            s["colors"] = res[s["id"]]
    ok = sum(1 for s in skins if s.get("colors"))
    print(f"colors: {ok}/{len(skins)}")


def build(with_colors):
    zh = load("zh-CN", "skins")
    en = {x["id"]: x for x in load("en", "skins")}
    crates_zh = load("zh-CN", "crates")
    crates_en = {x["id"]: x for x in load("en", "crates")}

    skins = []
    for x in zh:
        e = en.get(x["id"], {})
        desc, lore = short_desc(x.get("description"))
        rarity = (x.get("rarity") or {}).get("id")
        skins.append({
            "id": x["id"],
            "name": x["name"],
            "en": e.get("name", ""),
            "weapon": x["weapon"]["id"],
            "weaponName": x["weapon"]["name"],
            "weaponEn": (e.get("weapon") or {}).get("name", ""),
            "cat": x["category"]["id"],
            "catName": x["category"]["name"],
            "pattern": (x.get("pattern") or {}).get("name", ""),
            "rarity": rarity,
            "min": x.get("min_float"),
            "max": x.get("max_float"),
            "st": bool(x.get("stattrak")),
            "sv": bool(x.get("souvenir")),
            "phase": x.get("phase") or "",
            "img": x.get("image", ""),
            "desc": desc,
            "lore": lore,
            "coll": [c["id"] for c in x.get("collections") or []],
            "crates": [c["id"] for c in x.get("crates") or []],
            "team": (x.get("team") or {}).get("id", ""),
        })
    # Vanilla knives use a HUD id (sfui_wpnhud_*); fold them into the weapon id the finishes use
    by_name = {}
    for sk in skins:
        by_name.setdefault(sk["weaponName"], []).append(sk["weapon"])
    canon = {n: max(set(ids), key=ids.count) for n, ids in by_name.items()}
    for sk in skins:
        sk["weapon"] = canon[sk["weaponName"]]
    strip_weapon_blurb(skins)

    # Collections come embedded in skins; keep a small lookup
    collections = {}
    for x in zh:
        for c in x.get("collections") or []:
            collections[c["id"]] = {"id": c["id"], "name": c["name"], "img": c.get("image", "")}

    skin_ids = {s["id"] for s in skins}
    crates = []
    for c in crates_zh:
        contains = [i["id"] for i in c.get("contains") or [] if i["id"] in skin_ids]
        rare = [i["id"] for i in c.get("contains_rare") or [] if i["id"] in skin_ids]
        if not contains:
            continue  # sticker capsules, music kits etc. are for later sections
        crates.append({
            "id": c["id"], "name": c["name"], "en": crates_en.get(c["id"], {}).get("name", ""),
            "type": c.get("type") or "", "date": c.get("first_sale_date") or "",
            "img": c.get("image", ""), "items": contains, "rare": rare,
        })
    crates.sort(key=lambda c: c["date"] or "0000", reverse=True)

    rarities = {}
    for x in zh:
        r = x.get("rarity") or {}
        if r.get("id"):
            rarities[r["id"]] = {"id": r["id"], "name": r["name"], "color": r.get("color", "#888")}
    rarity_list = sorted(rarities.values(), key=lambda r: RARITY_ORDER.index(r["id"]) if r["id"] in RARITY_ORDER else 99)

    if with_colors:
        compute_colors(skins)

    os.makedirs(OUT, exist_ok=True)
    meta = {"rarities": rarity_list, "collections": collections,
            "source": "ByMykel/CSGO-API", "count": len(skins)}
    for name, obj in (("skins", skins), ("crates", crates), ("meta", meta)):
        with open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"skins {len(skins)}, crates {len(crates)}, collections {len(collections)}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--colors", action="store_true")
    build(ap.parse_args().colors)
