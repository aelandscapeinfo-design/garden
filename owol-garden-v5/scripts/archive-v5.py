"""Package the tested V5 build and its matching source, without build caches."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib, json, urllib.request
root=Path(__file__).resolve().parents[1]
out=root.parent
run_names=['OWOL-garden-v5.html','serve.mjs','START-ART-WINDOWS.cmd','먼저 읽어주세요.txt','README.md','ASSETS.md','VALIDATION.md','THIRD-PARTY-NOTICES.txt','review.html']
archives=[]
with ZipFile(out/'OWOL-garden-v5-run.zip','w',ZIP_DEFLATED,compresslevel=9) as z:
    for name in run_names: z.write(root/'release'/name,name)
    for file in sorted((root/'examples').glob('*')): z.write(file,'examples/'+file.name)
with ZipFile(out/'OWOL-garden-v5-source.zip','w',ZIP_DEFLATED,compresslevel=9) as z:
    for file in sorted(root.rglob('*')):
        if not file.is_file(): continue
        rel=file.relative_to(root)
        if any(p in {'node_modules','.git','test-results','playwright-report'} for p in rel.parts): continue
        if rel.parts[0]=='release' and rel.as_posix() not in ['release/'+x for x in run_names]: continue
        z.write(file,'owol-garden-v5/'+str(rel))
for name in ['OWOL-garden-v5-run.zip','OWOL-garden-v5-source.zip']:
    file=out/name
    with ZipFile(file) as z:
        bad=z.testzip()
        if bad: raise RuntimeError('Bad ZIP member: '+bad)
        archives.append(dict(name=name,bytes=file.stat().st_size,files=len(z.namelist()),sha256=hashlib.sha256(file.read_bytes()).hexdigest(),integrity='ok'))
with ZipFile(out/'OWOL-garden-v5-run.zip') as r,ZipFile(out/'OWOL-garden-v5-source.zip') as s:
    html=r.read('OWOL-garden-v5.html')
    assert html==s.read('owol-garden-v5/release/OWOL-garden-v5.html')==urllib.request.urlopen('http://127.0.0.1:5183').read()
    for file in (root/'dist').rglob('*'):
        if file.is_file(): assert file.read_bytes()==s.read('owol-garden-v5/'+str(file.relative_to(root)))
manifest=dict(archives=archives,testedHtmlSha256=hashlib.sha256(html).hexdigest(),servedHtmlMatchesRunAndSourceZip=True,sourceDistMatchesTestedBuild=True)
(out/'OWOL-garden-v5-manifest.json').write_text(json.dumps(manifest,indent=2))
(out/'OWOL-garden-v5-SHA256SUMS.txt').write_text(''.join(a['sha256']+'  '+a['name']+'\n' for a in archives))
print(json.dumps(manifest,indent=2))
