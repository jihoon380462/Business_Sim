#!/usr/bin/env python3
"""릴리스 버전 올리기: python3 tools/release.py 1.2.1
- src/data.js VERSION
- index.html 의 ?v=
- src/*.js 의 상대 import 에 ?v= (브라우저 캐시 때문에 옛 모듈이 섞이는 것 방지)
- version.json (게임이 새 버전을 감지하는 용도)
"""
import re, sys, json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
v = sys.argv[1]
d = root / 'src/data.js'
d.write_text(re.sub(r"VERSION = '[^']*'", f"VERSION = '{v}'", d.read_text()))
h = root / 'index.html'
h.write_text(re.sub(r"\?v=[0-9A-Za-z.\-]+", f"?v={v}", h.read_text()))
for f in (root / 'src').glob('*.js'):
    t = f.read_text()
    t2 = re.sub(r"(from\s+'\./[A-Za-z0-9_\-]+\.js)(\?v=[^']*)?'", lambda m: f"{m.group(1)}?v={v}'", t)
    if t2 != t: f.write_text(t2)
(root / 'version.json').write_text(json.dumps({'version': v}) + '\n')
print('release', v)
