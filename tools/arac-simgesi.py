# -*- coding: utf-8 -*-
"""Generate decorative tool heading symbols from the shared card icon source.

Usage: python tools/arac-simgesi.py [--check]
Favicon assets remain independent and are never modified here.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ICONS = json.loads((ROOT / "tools/card-icons.json").read_text(encoding="utf-8"))
OLD = re.compile(r'<img\b[^>]*class="tool-logo"[^>]*>')
CURRENT = re.compile(r'<div class="tool-logo tool-emblem" aria-hidden="true">.*?</div>', re.S)


def main():
    check = "--check" in sys.argv
    count, changed = 0, []
    for page in sorted(ROOT.glob("*/index.html")):
        source = page.read_text(encoding="utf-8")
        if not (OLD.search(source) or CURRENT.search(source)):
            continue
        slug = page.parent.name
        if slug not in ICONS:
            raise ValueError("Missing shared icon: " + slug)
        svg = ICONS[slug]["svg"].replace('<svg ', '<svg focusable="false" ', 1)
        markup = '<div class="tool-logo tool-emblem" aria-hidden="true">' + svg + '</div>'
        updated = CURRENT.sub(lambda _: markup, OLD.sub(lambda _: markup, source))
        count += 1
        if updated != source:
            changed.append(slug)
            if not check:
                page.write_text(updated, encoding="utf-8", newline="")
    if not count:
        raise ValueError("No tool heading symbols found")
    if check and changed:
        print("Stale tool symbols: " + ", ".join(changed))
        return 1
    print("Tool symbols: %d checked, %d updated." % (count, len(changed)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
