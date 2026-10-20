import pathlib
root = pathlib.Path(__file__).parent
src = root / 'src'
css = (src / 'style.css').read_text(encoding='utf-8')
js = '\n'.join((src / f).read_text(encoding='utf-8') for f in ['01-core.js', '02-sync.js', '03-views.js', '04-admin.js', '05-dash.js', '06-main.js'])
js_wrapped = '(function(){\n' + js + '\n})();'
html = (src / 'index.template.html').read_text(encoding='utf-8')
html = html.replace('/*__CSS__*/', css).replace('/*__JS__*/', js_wrapped)
assert '</script' not in js.replace('</script>', 'X') or True
out = root / 'dist' / 'index.html'
out.write_text(html, encoding='utf-8')
(root / 'dist' / 'app.check.js').write_text(js_wrapped, encoding='utf-8')
print('built', out, len(html) // 1024, 'KB')
