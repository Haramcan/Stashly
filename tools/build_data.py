#!/usr/bin/env python3
"""Lädt die Kartendatenbanken für die App herunter und schreibt sie nach data/.

Quellen:
  - Dragon Ball Super Fusion World: offizielle Kartenliste (dbs-cardgame.com/fw)
  - One Piece Card Game:            offizielle Kartenliste (en.onepiece-cardgame.com)
  - Pokémon TCG:                    TCGdex API (api.tcgdex.net), englisch + deutsch

Aufruf:  python3 tools/build_data.py            (alles)
         python3 tools/build_data.py dbfw op    (nur bestimmte Spiele)
Nur Python-Standardbibliothek, keine Installation nötig.
"""
import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data")
UA = "Mozilla/5.0 (TCG-Sammlung data builder)"


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                raise
            print(f"  retry {url}: {e}", file=sys.stderr)
            time.sleep(2 * (i + 1))


def get_json(url):
    return json.loads(get(url))


def clean(s):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s or ""))
    return re.sub(r"\s+", " ", s).strip()


def write(name, obj):
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, name)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"-> {p} ({os.path.getsize(p)//1024} KB)")


# ---------------------------------------------------------------- Dragon Ball
DB_BASE = "https://www.dbs-cardgame.com/fw/en/cardlist/"


def build_dbfw():
    print("Dragon Ball Fusion World …")
    page = get(DB_BASE)
    cats = re.findall(r'<li><a href="javascript:void\(0\);" data-val="(\d+)"[^>]*>([^<]+)</a></li>', page)
    sets, cards = [], []
    seen = set()
    # älteste Sets zuerst einlesen, damit Nachdrucke beim Original-Set landen; Promos zuletzt
    cats = list(enumerate(cats))
    cats.sort(key=lambda x: (("Promotion" in x[1][1] or "Release Event" in x[1][1]), -x[0]))
    for order, (val, title) in cats:
        title = clean(title)
        m = re.search(r"\[([^\]]+)\]\s*$", title)
        code = m.group(1).replace(" ", "") if m else ("PROMO" if "Promotion" in title else f"X{val}")
        if code in ("FB01-FB05", "FB06-FB09", "FB10-FB11", "SB01/SB02"):
            code = "REP-" + code.replace("/", "-")
        name = re.sub(r"\s*\[[^\]]+\]\s*$", "", title).strip()
        name = re.sub(r"^(BOOSTER PACK|STARTER DECK|MANGA BOOSTER|STORY BOOSTER)\s*", lambda x: x.group(1) + " ", name)
        kind = "booster" if code.startswith(("FB", "SB", "ST")) else ("starter" if code.startswith("FS") else "promo")
        html_ = get(DB_BASE + "?search=true&category%5B0%5D=" + val)
        items = re.findall(
            r'data-src="detail\.php\?card_no=([^"&]+)(?:&amp;p=|&p=)?([^"]*)"[^>]*><img[^>]*data-src="([^"]+)" alt="([^"]*)"',
            html_,
        )
        n = 0
        for no, p, img, alt in items:
            key = no + (p or "")
            if key in seen:
                continue
            seen.add(key)
            nm = html.unescape(alt)
            if nm.startswith(no):
                nm = nm[len(no):].strip()
            img_file = img.split("/")[-1]
            cards.append({"id": key, "no": no, "p": p.lstrip("_"), "set": code, "name": nm, "img": img_file})
            n += 1
        sets.append({"id": code, "name": name, "kind": kind, "order": order, "cat": val, "count": n})
        print(f"  {code:14} {n:4} Karten  {name}")
        time.sleep(0.3)

    # Details (Seltenheit, Farbe, Typ) – nur pro Basis-Kartennummer
    base_nos = sorted({c["no"] for c in cards})
    print(f"  Details für {len(base_nos)} Karten …")

    def detail(no):
        try:
            h = get(DB_BASE + "detail.php?card_no=" + urllib.parse.quote(no))
        except Exception:  # noqa: BLE001
            return no, {}
        t = clean(h)
        info = {}
        m = re.search(re.escape(no) + r"\s+([A-Z*+]{1,5})\s", t)
        if m:
            info["r"] = m.group(1)
        for key, label in (("type", "Card type"), ("color", "Color"), ("cost", "Cost"), ("power", "Power"), ("traits", "Special Traits")):
            m = re.search(label + r"\s+(.+?)\s+(Color|Cost|Specified cost|Power|Combo power|Special Traits|Skills|Where to get it)\s", t)
            if m:
                v = m.group(1).strip()
                if key in ("power", "traits"):
                    v = v.split("  ")[0]
                if v and v != "-":
                    info[key] = v[:80]
        return no, info

    details = {}
    with ThreadPoolExecutor(6) as ex:
        for i, (no, info) in enumerate(ex.map(detail, base_nos)):
            details[no] = info
            if i % 200 == 0:
                print(f"   {i}/{len(base_nos)}")
    sets.sort(key=lambda s: s["order"])
    for c in cards:
        d = details.get(c["no"], {})
        if d.get("r"):
            c["r"] = d["r"]
        for k in ("type", "color"):
            if d.get(k):
                c[k] = d[k].title() if k == "type" else d[k]
        if c["p"]:
            c["par"] = 1
    return {"sets": sets, "cards": cards, "imgBase": "https://www.dbs-cardgame.com/fw/images/cards/card/en/"}


# ---------------------------------------------------------------- One Piece
OP_BASE = "https://en.onepiece-cardgame.com/cardlist/"


def build_op():
    print("One Piece …")
    page = get(OP_BASE)
    opts = re.findall(r'<option value="(\d+)"[^>]*>([^<]+)', page)
    sets, cards, seen = [], [], set()
    opts = list(enumerate(opts))
    opts.sort(key=lambda x: (("Promotion" in x[1][1] or "Other" in x[1][1]), -x[0]))
    for order, (val, title) in opts:
        if not val:
            continue
        title = clean(html.unescape(title))
        m = re.search(r"\[([^\]]+)\]\s*$", title)
        if m:
            code = m.group(1).replace(" ", "")
        elif "Promotion" in title:
            code = "P"
        else:
            code = "OTHER"
        name = re.sub(r"\s*\[[^\]]+\]\s*$", "", title).strip()
        kind = "starter" if code.startswith("ST") else ("promo" if code in ("P", "OTHER") else "booster")
        h = get(OP_BASE + "?series=" + val)
        blocks = re.findall(r'<dl class="modalCol" id="([^"]+)">(.*?)</dl>', h, re.S)
        n = 0
        for cid, b in blocks:
            if cid in seen:
                continue
            seen.add(cid)
            info = re.search(r'<div class="infoCol">\s*<span>([^<]*)</span>\s*\|\s*<span>([^<]*)</span>\s*\|\s*<span>([^<]*)</span>', b)
            nm = re.search(r'<div class="cardName">(.*?)</div>', b, re.S)
            img = re.search(r'data-src="\.\./images/cardlist/card/([^"]+)"', b)

            def fld(cls):
                m2 = re.search(r'<div class="' + cls + r'"><h3>.*?</h3>(.*?)</div>', b, re.S)
                return clean(m2.group(1)) if m2 else ""

            no = info.group(1).strip() if info else cid.split("_")[0]
            c = {
                "id": cid,
                "no": no,
                "p": cid[len(no):].lstrip("_") if cid.startswith(no) else "",
                "set": code,
                "name": clean(nm.group(1)) if nm else "",
                "r": info.group(2).strip() if info else "",
                "type": info.group(3).strip().title() if info else "",
                "color": fld("color"),
                "img": img.group(1) if img else cid + ".png",
            }
            if c["p"]:
                c["par"] = 1
            cards.append(c)
            n += 1
        sets.append({"id": code, "name": name, "kind": kind, "order": order, "count": n})
        print(f"  {code:14} {n:4} Karten  {name}")
        time.sleep(0.3)
    sets.sort(key=lambda s: s["order"])
    # Preise (TCGplayer Marktpreis in USD) von optcgapi.com – optional
    prices = {}
    for ep in ("allSetCards", "allSTCards", "allPromos"):
        try:
            for x in get_json("https://optcgapi.com/api/" + ep + "/"):
                k = x.get("card_image_id") or x.get("card_set_id")
                if k and x.get("market_price"):
                    prices[k] = x["market_price"]
        except Exception as e:  # noqa: BLE001
            print("  (Preise", ep, "nicht geladen:", e, ")")
    for c in cards:
        if c["id"] in prices:
            c["usd"] = prices[c["id"]]
    print(f"  Preise für {sum(1 for c in cards if 'usd' in c)} Karten")
    return {"sets": sets, "cards": cards, "imgBase": "https://en.onepiece-cardgame.com/images/cardlist/card/"}


# ---------------------------------------------------------------- Pokémon
TD = "https://api.tcgdex.net/v2/"


def build_pokemon():
    print("Pokémon …")
    series = get_json(TD + "en/series")
    ser_name = {s["id"]: s["name"] for s in series}
    set_serie = {}
    ser_order = {}
    for i, s in enumerate(series):
        if s["id"] == "tcgp":  # TCG Pocket (nur digital) auslassen
            continue
        ser_order[s["id"]] = i
        d = get_json(TD + "en/series/" + s["id"])
        for st in d.get("sets", []):
            set_serie[st["id"]] = s["id"]
    try:
        de_sets = {s["id"]: s["name"] for s in get_json(TD + "de/sets")}
    except Exception:  # noqa: BLE001
        de_sets = {}

    def set_detail(sid):
        try:
            return get_json(TD + "en/sets/" + urllib.parse.quote(sid))
        except Exception:  # noqa: BLE001
            return None

    ids = list(set_serie)
    with ThreadPoolExecutor(6) as ex:
        dets = list(ex.map(set_detail, ids))
    sets, cards = [], []
    for sid, d in zip(ids, dets):
        if not d:
            continue
        cc = d.get("cardCount", {})
        logo = d.get("logo", "")
        sym = d.get("symbol", "")
        sets.append({
            "id": sid,
            "name": d["name"],
            "nameDe": de_sets.get(sid, ""),
            "serie": ser_name.get(set_serie[sid], set_serie[sid]),
            "serieId": set_serie[sid],
            "date": d.get("releaseDate", ""),
            "total": cc.get("total", 0),
            "official": cc.get("official", 0),
            "logo": logo.replace("https://assets.tcgdex.net/", ""),
            "symbol": sym.replace("https://assets.tcgdex.net/", ""),
            "kind": "booster",
            "abbr": (d.get("abbreviation") or {}).get("official", ""),
        })
        for c in d.get("cards", []):
            img = c.get("image", "")
            cards.append({
                "id": c["id"],
                "no": c["localId"],
                "set": sid,
                "name": c["name"],
                "img": img.replace("https://assets.tcgdex.net/", ""),
            })
    # deutsche Namen
    try:
        de = {c["id"]: c["name"] for c in get_json(TD + "de/cards")}
    except Exception:  # noqa: BLE001
        de = {}
    # Seltenheiten
    rar = {}
    for r in get_json(TD + "en/rarities"):
        try:
            for c in get_json(TD + "en/cards?rarity=" + urllib.parse.quote(r)):
                rar[c["id"]] = r
        except Exception:  # noqa: BLE001
            pass
    for c in cards:
        if de.get(c["id"]) and de[c["id"]] != c["name"]:
            c["nameDe"] = de[c["id"]]
        if c["id"] in rar and rar[c["id"]] != "None":
            c["r"] = rar[c["id"]]
    sets.sort(key=lambda s: (s["date"] or "9999", s["id"]))
    for i, s in enumerate(sets):
        s["order"] = i
    print(f"  {len(sets)} Sets, {len(cards)} Karten, {len(de)} deutsche Namen, {len(rar)} Seltenheiten")
    return {"sets": sets, "cards": cards, "imgBase": "https://assets.tcgdex.net/"}


def main():
    want = sys.argv[1:] or ["dbfw", "op", "pokemon"]
    builders = {"dbfw": build_dbfw, "op": build_op, "pokemon": build_pokemon}
    meta_p = os.path.join(OUT, "meta.json")
    meta = json.load(open(meta_p, encoding="utf-8")) if os.path.exists(meta_p) else {}
    for g in want:
        d = builders[g]()
        d["updated"] = date.today().isoformat()
        write(f"{g}.json", d)
        meta[g] = {"updated": d["updated"], "sets": len(d["sets"]), "cards": len(d["cards"])}
    write("meta.json", meta)


if __name__ == "__main__":
    main()
