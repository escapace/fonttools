import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  readVendoredWheelModules,
  rewriteVendorIndexSource,
  syncVendorIndexModule,
} from '../scripts/update-index'

describe('update-index', () => {
  it('reads vendored wheel modules from filenames and normalizes export names', async () => {
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'fonttools-vendor-'))
    const vendorDirectory = path.join(temporaryDirectory, 'vendor')

    await mkdir(vendorDirectory, { recursive: true })
    await Promise.all([
      writeFile(path.join(vendorDirectory, 'zeta-1.0.0-py3-none-any.whl'), ''),
      writeFile(path.join(vendorDirectory, 'my_package-1.0.0-py3-none-any.whl'), ''),
      writeFile(path.join(vendorDirectory, 'alpha-1.0.0-py3-none-any.whl'), ''),
      writeFile(path.join(vendorDirectory, 'README.md'), ''),
    ])

    await expect(readVendoredWheelModules(vendorDirectory)).resolves.toEqual([
      {
        exportName: 'alpha',
        fileName: 'alpha-1.0.0-py3-none-any.whl',
        importName: 'alphaPath',
      },
      {
        exportName: 'myPackage',
        fileName: 'my_package-1.0.0-py3-none-any.whl',
        importName: 'myPackagePath',
      },
      {
        exportName: 'zeta',
        fileName: 'zeta-1.0.0-py3-none-any.whl',
        importName: 'zetaPath',
      },
    ])
  })

  it('rewrites src/index.ts sections from vendored wheel modules', () => {
    const source = [
      "import oldPath from './vendor/old-1.0.0-py3-none-any.whl'",
      '',
      'export const old = new URL(oldPath, import.meta.url)',
      '',
      'const index = {',
      '  old,',
      '}',
      '',
      'export default index',
    ].join('\n')

    const nextSource = rewriteVendorIndexSource(source, [
      {
        exportName: 'alpha',
        fileName: 'alpha-1.0.0-py3-none-any.whl',
        importName: 'alphaPath',
      },
      {
        exportName: 'myPackage',
        fileName: 'my_package-1.0.0-py3-none-any.whl',
        importName: 'myPackagePath',
      },
    ])

    expect(nextSource).toBe(
      [
        "import alphaPath from './vendor/alpha-1.0.0-py3-none-any.whl'",
        "import myPackagePath from './vendor/my_package-1.0.0-py3-none-any.whl'",
        '',
        'export const alpha = new URL(alphaPath, import.meta.url)',
        'export const myPackage = new URL(myPackagePath, import.meta.url)',
        '',
        'const index = {',
        '  alpha,',
        '  myPackage,',
        '}',
        '',
        'export default index',
      ].join('\n'),
    )
  })

  it('syncs the index module from the vendor directory', async () => {
    const temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'fonttools-sync-index-'))
    const vendorDirectory = path.join(temporaryDirectory, 'src', 'vendor')
    const indexModulePath = path.join(temporaryDirectory, 'src', 'index.ts')

    await mkdir(vendorDirectory, { recursive: true })
    await Promise.all([
      writeFile(path.join(vendorDirectory, 'beta-1.0.0-py3-none-any.whl'), ''),
      writeFile(path.join(vendorDirectory, 'alpha-1.0.0-py3-none-any.whl'), ''),
      writeFile(
        indexModulePath,
        [
          "import stalePath from './vendor/stale-1.0.0-py3-none-any.whl'",
          '',
          'export const stale = new URL(stalePath, import.meta.url)',
          '',
          'const index = {',
          '  stale,',
          '}',
          '',
          'export default index',
        ].join('\n'),
      ),
    ])

    await syncVendorIndexModule(vendorDirectory, indexModulePath)

    await expect(readFile(indexModulePath, 'utf8')).resolves.toBe(
      [
        "import alphaPath from './vendor/alpha-1.0.0-py3-none-any.whl'",
        "import betaPath from './vendor/beta-1.0.0-py3-none-any.whl'",
        '',
        'export const alpha = new URL(alphaPath, import.meta.url)',
        'export const beta = new URL(betaPath, import.meta.url)',
        '',
        'const index = {',
        '  alpha,',
        '  beta,',
        '}',
        '',
        'export default index',
      ].join('\n'),
    )
  })
})
