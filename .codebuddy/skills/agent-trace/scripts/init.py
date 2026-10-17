#!/usr/bin/env python3
"""Scaffold an empty trace JSON from an entry prompt."""
import sys
import os
import json


def main():
    if len(sys.argv) < 3:
        print("usage: init.py <out_path> <entry_text>")
        sys.exit(2)
    out, entry = sys.argv[1], sys.argv[2]
    trace = {
        "entry": entry,
        "depth": 3,
        "triggers": [],
        "flow": [
            {"id": "n1", "kind": "entry", "label": "入口",
             "detail": entry, "children": []}
        ],
    }
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(trace, f, ensure_ascii=False, indent=2)
    print("created", out)


if __name__ == "__main__":
    main()
