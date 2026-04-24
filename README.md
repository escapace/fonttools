# @escapace/fonttools

Bundle of Python wheels: [fonttools](https://fonttools.readthedocs.io/en/latest/) and its common dependencies, built for the [Pyodide](https://pyodide.org/en/stable/) Python runtime.

fonttools is a Python toolkit for reading, writing, subsetting, and optimizing TrueType and OpenType fonts. Pyodide runs CPython in WebAssembly in browsers and Node.js, and lets JavaScript load Python packages, run Python code, and write files into a virtual file system.

The additional wheels support WOFF2, XML/SVG handling, HarfBuzz repacking, and Unicode data: brotli, lxml, uharfbuzz, and unicodedata2. Load the wheels before importing the Python module.

## Install

```sh
pnpm add @escapace/fonttools pyodide
```

Use the Pyodide version required by the peer dependency. These wheels target Pyodide, not system CPython.

## Browser example

Pass the exported wheel URLs to Pyodide's package loader before running Python.

```ts
import wheels from '@escapace/fonttools'
import { loadPyodide } from 'pyodide'

const pyodide = await loadPyodide()

await pyodide.loadPackage(Object.values(wheels).map((url) => url.href))

const result = pyodide.runPython(`
import json
from fontTools import unicodedata

json.dumps({
    'script': unicodedata.script_name('Latn'),
    'block': unicodedata.block('a'),
})
`)

console.log(JSON.parse(String(result)))
```

## Node example

Font files must exist inside Pyodide's virtual file system. This example copies a local font there before opening it with fonttools.

```ts
import { readFile } from 'node:fs/promises'
import wheels from '@escapace/fonttools'
import { loadPyodide } from 'pyodide'

const pyodide = await loadPyodide()

await pyodide.loadPackage(Object.values(wheels).map((url) => url.href))

pyodide.FS.writeFile('/tmp/font.ttf', await readFile('font.ttf'))

const result = pyodide.runPython(`
import json
from fontTools.ttLib import TTFont

font = TTFont('/tmp/font.ttf')
json.dumps(sorted(tag for tag in font.keys() if tag != 'GlyphOrder'))
`)

console.log(JSON.parse(String(result)))
```

## Exports

The default export is an object with all wheel URL objects. Named exports are available for brotli, fonttools, lxml, uharfbuzz, and unicodedata2.
