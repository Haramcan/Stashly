#!/usr/bin/env python3
"""Schreibt die Dateiliste und eine Versionsnummer in sw.js.
Nach jeder Änderung an der App ausführen:  python3 tools/build_sw.py"""
import hashlib
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INCLUDE_DIRS = ["css", "js", "icons", "data"]
INCLUDE_FILES = ["index.html", "manifest.webmanifest"]

files = list(INCLUDE_FILES)
for d in INCLUDE_DIRS:
    for base, _, names in os.walk(os.path.join(ROOT, d)):
        for n in sorted(names):
            if n.startswith("."):
                continue
            files.append(os.path.relpath(os.path.join(base, n), ROOT).replace(os.sep, "/"))
files = sorted(set(files))
h = hashlib.sha256()
for f in files:
    with open(os.path.join(ROOT, f), "rb") as fh:
        h.update(f.encode())
        h.update(fh.read())
version = h.hexdigest()[:12]
assets = ["./"] + ["./" + f for f in files]
block = "// BEGIN-GENERATED\nconst VERSION = '%s';\nconst ASSETS = [\n%s\n];\n// END-GENERATED" % (
    version, ",\n".join("  '%s'" % a for a in assets))
p = os.path.join(ROOT, "sw.js")
s = open(p, encoding="utf-8").read()
s = re.sub(r"// BEGIN-GENERATED.*?// END-GENERATED", lambda m: block, s, flags=re.S)
open(p, "w", encoding="utf-8").write(s)
print("sw.js:", len(assets), "Dateien, Version", version)
