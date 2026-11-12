"""Insert the blank lines that anti-slop(require-readable-spacing) asks for."""
import re, sys
from collections import defaultdict

root = sys.argv[1]
hits = defaultdict(set)
for line in sys.stdin:
    m = re.match(r"^(\S+):(\d+):\d+: error anti-slop\(require-readable-spacing\)", line)
    if m:
        hits[m.group(1)].add(int(m.group(2)))
for rel, lines in hits.items():
    path = f"{root}/{rel}"
    with open(path, encoding="utf-8") as f:
        content = f.read().split("\n")
    for n in sorted(lines, reverse=True):
        content.insert(n - 1, "")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(content))
    print(f"{rel}: {len(lines)} blank line(s)")
