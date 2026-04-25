import brotliPath from './vendor/brotli-1.2.0-cp313-cp313-pyodide_2025_0_wasm32.whl'
import fonttoolsPath from './vendor/fonttools-4.62.1-py3-none-any.whl'
import lxmlPath from './vendor/lxml-6.0.2-cp313-cp313-pyodide_2025_0_wasm32.whl'
import uharfbuzzPath from './vendor/uharfbuzz-0.52.0-cp310-abi3-pyodide_2025_0_wasm32.whl'
import unicodedata2Path from './vendor/unicodedata2-17.0.0-cp313-cp313-pyodide_2025_0_wasm32.whl'

export const brotli = new URL(brotliPath, import.meta.url)
export const fonttools = new URL(fonttoolsPath, import.meta.url)
export const lxml = new URL(lxmlPath, import.meta.url)
export const uharfbuzz = new URL(uharfbuzzPath, import.meta.url)
export const unicodedata2 = new URL(unicodedata2Path, import.meta.url)

const index = {
  brotli,
  fonttools,
  lxml,
  uharfbuzz,
  unicodedata2,
}

export default index
