"""Refresh the standalone index.html from the maintained CSS/JS sources."""
from pathlib import Path
import re
root = Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
css = (root / 'style.css').read_text()
game = (root / 'game.js').read_text()
game = re.sub(r'^import .*?;\n', '', game, count=1)
library = (root / 'vendor/three.module.js').read_text()
library, count = re.subn(r'\nexport \{[^}]+\};\s*$', '', library)
assert count == 1, 'Unexpected Three.js export layout'
used = sorted(set(re.findall(r'\bTHREE\.(\w+)', game)))
license_text = (root / 'vendor/THREE-LICENSE.txt').read_text()
js = '/* Three.js 0.160.1 — MIT license\n' + license_text + '\n*/\nconst THREE = (() => {\n' + library + '\nreturn {' + ','.join(used) + '};\n})();\n(() => {\n' + game + '\n})();'
js = re.sub(r'</script', r'<\\/script', js, flags=re.I)
style = '<style id="bundled-style">\n' + css + '\n</style>'
script = '<script id="bundled-game">\n' + js + '\n</script>'
if 'id="bundled-style"' in html:
    html = re.sub(r'<style id="bundled-style">.*?</style>', lambda _: style, html, flags=re.S)
else:
    html = html.replace('<link rel="stylesheet" href="style.css">', style)
if 'id="bundled-game"' in html:
    html = re.sub(r'<script id="bundled-game">.*?</script>', lambda _: script, html, flags=re.S)
else:
    html = html.replace('<script type="module" src="game.js"></script>', script)
(root / 'index.html').write_text(html)
print('Built standalone index.html')
