"""Refresh the standalone index.html from the maintained CSS/JS sources."""
from pathlib import Path
import re
root = Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
css = (root / 'style.css').read_text()
def source(name):
    return re.sub(r'^import[^\n]*;\s*\n', '', (root / name).read_text(), flags=re.M)

def module(name, exports, prelude=''):
    body = re.sub(r'\bexport\s+(?=(?:const|let|class|function|async)\b)', '', source(name))
    if name == 'art.js':
        import base64
        for asset in ('equipment-atlas.png', 'materials-atlas.png'):
            data = base64.b64encode((root / 'assets' / asset).read_bytes()).decode()
            body = body.replace("'assets/" + asset + "'", "'data:image/png;base64," + data + "'")
    return '(() => {\n' + prelude + '\n' + body + '\nreturn {' + ','.join(exports) + '};\n})();'

world_names = ['BLOCKS','VoxelWorld','WORLD_MIN_Y','WORLD_MAX_Y','WORLD_CHUNK','hash3']
item_names = ['itemDefs','recipes','drawItemIcon','setItemAtlas','equipmentSlots','smeltingRecipes']
art_names = ['loadGeneratedArt','generatedArtSheets']
game = 'const WorldModule = ' + module('world.js', world_names) + '\n'
game += 'const {' + ','.join(world_names) + '} = WorldModule;\n'
game += 'const LegacyModule = ' + module('legacy-world.js', ['createLegacyWorld']) + '\nconst {createLegacyWorld} = LegacyModule;\n'
game += 'const ItemsModule = ' + module('items.js', item_names, 'const B = WorldModule.BLOCKS;') + '\nconst {' + ','.join(item_names) + '} = ItemsModule;\n'
game += 'const ArtModule = ' + module('art.js', art_names) + '\nconst {' + ','.join(art_names) + '} = ArtModule;\n'
game += 'const SaveModule = ' + module('save.js', ['validateSnapshot','migrateV5']) + '\nconst {validateSnapshot,migrateV5} = SaveModule;\n'
game += 'const MiningModule = ' + module('mining.js', ['miningProfile'], 'const B = WorldModule.BLOCKS;') + '\nconst {miningProfile} = MiningModule;\n'
monster_names = ['nightAt','daylightAt','NightCreatures','createCreatureVisuals']
game += 'const MonsterModule = ' + module('monsters.js', monster_names) + '\nconst {' + ','.join(monster_names) + '} = MonsterModule;\n'
import base64
game += source('game.js').replace("'assets/terrain-atlas.png'", "'data:image/png;base64," + base64.b64encode((root / 'assets/terrain-atlas.png').read_bytes()).decode() + "'")
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
