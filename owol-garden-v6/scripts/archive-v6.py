"""Package the public OWOL source and standalone build; never include raw logs."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

project = Path(__file__).resolve().parents[1]
root = project.parent
release = project / 'release'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def make_zip(path, entries):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for source, target in sorted(entries, key=lambda x: x[1]):
            z.write(source, target)
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None
        count = len(z.namelist())
    return {'name': path.name, 'bytes': path.stat().st_size,
            'files': count, 'sha256': digest(path.read_bytes()), 'integrity': 'ok'}

run = [(release / name, 'OWOL-garden-v6-run/' + name) for name in
       ['OWOL-garden-v6.html', 'serve.mjs', 'THIRD-PARTY-NOTICES.txt',
        'README.md', 'VALIDATION.md', 'ASSETS.md', '먼저 읽어주세요.txt']]
run += [(p, 'OWOL-garden-v6-run/examples/' + p.name)
        for p in (project / 'examples/v6').glob('*.json')]
run.append((project / 'review.html', 'OWOL-garden-v6-run/review.html'))
for name in ['asset-manifest.json', 'performance.json', 'reference-access.json',
             'material-specification.json', 'test-summary.json']:
    run.append((project / 'evidence/v6' / name, 'OWOL-garden-v6-run/validation/' + name))

roots = {'src', 'tests', 'examples', 'scripts', 'evidence', 'dist'}
single = {'.gitignore', 'index.html', 'package.json', 'package-lock.json',
          'playwright.config.js', 'README.md', 'VALIDATION.md', 'ASSETS.md',
          'RUN-ME.txt', 'START-ART-WINDOWS.cmd', 'THIRD-PARTY-NOTICES.txt', 'review.html'}
source = []
for p in project.rglob('*'):
    if not p.is_file():
        continue
    relative = p.relative_to(project)
    if relative.parts[0] not in roots and str(relative) not in single:
        continue
    if any(x in {'node_modules', 'test-results', '__pycache__', '.git'} for x in relative.parts):
        continue
    if p.suffix in {'.log', '.pem', '.key', '.env', '.pyc'} or 'diagnostic' in p.name.lower():
        continue
    source.append((p, 'OWOL-garden-v6-source/' + str(relative)))

archives = [make_zip(root / 'OWOL-garden-v6-run.zip', run),
            make_zip(root / 'OWOL-garden-v6-source.zip', source)]
tested = json.loads((project / 'evidence/v6/standalone-smoke.json').read_text())['htmlSha256']
assert digest((release / 'OWOL-garden-v6.html').read_bytes()) == tested
with zipfile.ZipFile(root / 'OWOL-garden-v6-run.zip') as z:
    assert digest(z.read('OWOL-garden-v6-run/OWOL-garden-v6.html')) == tested

copies = {'OWOL-garden-v6-review.html': project / 'review.html',
          'OWOL-garden-v6-plant-contact-sheet.png': project / 'evidence/v6/contact-sheet.png',
          'OWOL-materials-before-V5.png': project / 'evidence/v6/materials-before-v5.png',
          'OWOL-materials-after-V6.png': project / 'evidence/v6/material-samples.png',
          'OWOL-garden-v6-preview.png': project / 'evidence/v6/standalone-scene.png'}
files = archives[:]
for name, path in copies.items():
    target = root / name
    shutil.copyfile(path, target)
    files.append({'name': name, 'bytes': target.stat().st_size,
                  'sha256': digest(target.read_bytes())})
manifest = {'baselineRepository': 'aelandscapeinfo-design/garden',
            'baselineBranch': 'codex/owol-v5-composition-20261016',
            'baselineCommit': 'dab07e18f0e542306b09fa28cc99a2998d7e230e',
            'branch': 'codex/owol-v6-recovery-20261017',
            'status': 'V6 material and twelve-asset shape study; not full V6 or 36 species',
            'counts': {'newPlaceableAssets': 12, 'distinctNewMorphologies': 12,
                       'structuralVariantsPerAsset': 3, 'totalNewStructuralVariants': 36,
                       'newColorOnlyCatalogueVariants': 0, 'remainingTo36Assets': 24},
            'testedHtmlSha256': tested,
            'servedHtmlMatchesRunZip': True,
            'files': files}
(root / 'OWOL-garden-v6-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
(root / 'OWOL-garden-v6-SHA256SUMS.txt').write_text(''.join(f['sha256'] + '  ' + f['name'] + '\n' for f in files))
print(json.dumps({'files': files}, ensure_ascii=False, indent=2))
