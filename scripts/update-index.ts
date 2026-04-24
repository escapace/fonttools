import { Lang, parse, type Edit, type SgNode } from '@ast-grep/napi'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface VendoredWheelModule {
  exportName: string
  fileName: string
  importName: string
}

const ROOT_DIRECTORY = path.resolve(import.meta.dirname, '..')
const INDEX_MODULE_PATH = path.join(ROOT_DIRECTORY, 'src', 'index.ts')
const VENDOR_DIRECTORY_PATH = path.join(ROOT_DIRECTORY, 'src', 'vendor')

function assertNode<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message)
  }

  return value
}

function createRangeEdit(startNode: SgNode, endNode: SgNode, insertedText: string): Edit {
  return {
    endPos: endNode.range().end.index,
    insertedText,
    startPos: startNode.range().start.index,
  }
}

function getVendorImportDeclarations(rootNode: SgNode): SgNode[] {
  return rootNode
    .findAll('import $NAME from $SOURCE')
    .filter((node) => node.getMatch('SOURCE')?.text().startsWith("'./vendor/") === true)
}

function getVendorUrlExports(rootNode: SgNode): SgNode[] {
  return rootNode.findAll('export const $NAME = new URL($PATH, import.meta.url)')
}

function isWheelFile(fileName: string): boolean {
  return fileName.endsWith('.whl')
}

function normalizeWheelDistributionName(fileName: string): string {
  const match = /^(?<distribution>.+?)-\d[^-]*-/u.exec(fileName)

  if (match?.groups?.distribution === undefined) {
    throw new Error(`Could not determine wheel distribution name from ${fileName}`)
  }

  return match.groups.distribution
}

function toJavaScriptIdentifier(distributionName: string): string {
  const parts = distributionName.split(/[^A-Za-z0-9]+/u).filter((part) => part.length > 0)

  if (parts.length === 0) {
    throw new Error(`Could not derive a JavaScript identifier from ${distributionName}`)
  }

  const [firstPart, ...remainingParts] = parts
  let identifier = `${firstPart.toLowerCase()}${remainingParts
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1).toLowerCase()}`)
    .join('')}`

  if (!/^[$A-Z_a-z]/u.test(identifier)) {
    identifier = `_${identifier}`
  }

  return identifier
}

function validateUniqueExportNames(modules: VendoredWheelModule[]): void {
  const exportNames = new Set<string>()

  for (const module of modules) {
    if (exportNames.has(module.exportName)) {
      throw new Error(`Duplicate export name generated for vendored wheel ${module.fileName}`)
    }

    exportNames.add(module.exportName)
  }
}

function renderVendorImports(modules: VendoredWheelModule[]): string {
  return modules
    .map((module) => `import ${module.importName} from './vendor/${module.fileName}'`)
    .join('\n')
}

function renderVendorUrlExports(modules: VendoredWheelModule[]): string {
  return modules
    .map(
      (module) =>
        `export const ${module.exportName} = new URL(${module.importName}, import.meta.url)`,
    )
    .join('\n')
}

function renderIndexDeclaration(modules: VendoredWheelModule[]): string {
  return ['const index = {', ...modules.map((module) => `  ${module.exportName},`), '}'].join('\n')
}

export async function readVendoredWheelModules(
  vendorDirectoryPath: string = VENDOR_DIRECTORY_PATH,
): Promise<VendoredWheelModule[]> {
  const entries = await readdir(vendorDirectoryPath, { withFileTypes: true })
  const modules = entries
    .filter((entry) => entry.isFile() && isWheelFile(entry.name))
    .map((entry) => {
      const exportName = toJavaScriptIdentifier(normalizeWheelDistributionName(entry.name))

      return {
        exportName,
        fileName: entry.name,
        importName: `${exportName}Path`,
      }
    })
    .sort((left, right) => left.exportName.localeCompare(right.exportName))

  if (modules.length === 0) {
    throw new Error(`No vendored wheels found in ${vendorDirectoryPath}`)
  }

  validateUniqueExportNames(modules)

  return modules
}

export function rewriteVendorIndexSource(source: string, modules: VendoredWheelModule[]): string {
  validateUniqueExportNames(modules)

  const rootNode = parse(Lang.TypeScript, source).root()
  const vendorImportDeclarations = getVendorImportDeclarations(rootNode)
  const vendorUrlExports = getVendorUrlExports(rootNode)
  const indexDeclaration = rootNode.find('const index = { $$$PROPS }')

  if (vendorImportDeclarations.length === 0) {
    throw new Error(`Could not find vendored wheel imports in ${INDEX_MODULE_PATH}`)
  }

  if (vendorUrlExports.length === 0) {
    throw new Error(`Could not find vendored URL exports in ${INDEX_MODULE_PATH}`)
  }

  const firstVendorImport = vendorImportDeclarations[0]
  const lastVendorImport = assertNode(
    vendorImportDeclarations.at(-1),
    `Could not determine the last vendored wheel import in ${INDEX_MODULE_PATH}`,
  )
  const firstVendorUrlExport = vendorUrlExports[0]
  const lastVendorUrlExport = assertNode(
    vendorUrlExports.at(-1),
    `Could not determine the last vendored URL export in ${INDEX_MODULE_PATH}`,
  )

  return rootNode.commitEdits([
    createRangeEdit(firstVendorImport, lastVendorImport, renderVendorImports(modules)),
    createRangeEdit(firstVendorUrlExport, lastVendorUrlExport, renderVendorUrlExports(modules)),
    assertNode(
      indexDeclaration,
      `Could not find index object declaration in ${INDEX_MODULE_PATH}`,
    ).replace(renderIndexDeclaration(modules)),
  ])
}

export async function syncVendorIndexModule(
  vendorDirectoryPath: string = VENDOR_DIRECTORY_PATH,
  indexModulePath: string = INDEX_MODULE_PATH,
): Promise<void> {
  const [modules, source] = await Promise.all([
    readVendoredWheelModules(vendorDirectoryPath),
    readFile(indexModulePath, 'utf8'),
  ])
  const nextSource = rewriteVendorIndexSource(source, modules)

  if (nextSource === source) {
    return
  }

  await writeFile(indexModulePath, nextSource)
}

function isMainModule(metaUrl: string): boolean {
  const entryPath = process.argv[1]

  return entryPath !== undefined && path.resolve(entryPath) === fileURLToPath(metaUrl)
}

if (isMainModule(import.meta.url)) {
  await syncVendorIndexModule(process.argv[2], process.argv[3])
}
