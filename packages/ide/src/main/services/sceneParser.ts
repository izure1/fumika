import * as fs from 'fs'
import Module from 'module'
import path from 'path'
import { app } from 'electron'
import { register } from 'esbuild-register/dist/node'

// ─── ASAR-safe esbuild binary path resolution ──────────────────────────────
// Electron's ASAR support does NOT intercept child_process.spawn.
// esbuild internally spawns its native binary via spawn(), which fails
// inside app.asar with ENOENT. We must point it to the unpacked location.
if (app.isPackaged && !process.env.ESBUILD_BINARY_PATH) {
  const appPath = app.getAppPath() // e.g. .../resources/app.asar
  const unpackedPath = appPath.replace('app.asar', 'app.asar.unpacked')
  const platformArch = `${process.platform}-${process.arch}` // e.g. win32-x64
  const binaryName = process.platform === 'win32' ? 'esbuild.exe' : 'esbuild'
  process.env.ESBUILD_BINARY_PATH = path.join(
    unpackedPath, 'node_modules', '@esbuild', platformArch, binaryName
  )
}

export interface SceneConnection {
  type: 'next' | 'call'
  target: string
  conditional: boolean
}

export type FlowItem =
  | { kind: 'label'; name: string; line: number }
  | { kind: 'goto'; target: string; line: number }
  | { kind: 'call'; target: string; line: number }
  | { kind: 'next'; target: string; line: number }
  | { kind: 'condition'; id: number; expression?: string; ifBranch: FlowItem[]; elseBranch: FlowItem[]; line: number }

export interface ParseResult {
  flowItems: FlowItem[]
  externalConnections: SceneConnection[]
  error?: string
}

interface TsConfig {
  compilerOptions?: {
    baseUrl?: string
    paths?: Record<string, string[]>
  }
}

function findProjectRoot(filePath: string): string {
  let dir = path.dirname(filePath)
  while (true) {
    if (fs.existsSync(path.join(dir, 'novel.config.ts')) || fs.existsSync(path.join(dir, 'package.json'))) {
      return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) {
      break
    }
    dir = parent
  }
  return path.dirname(filePath)
}

function loadTsConfigPaths(projectRoot: string): { baseUrl: string; paths: Record<string, string[]> } {
  const tsconfigPath = path.join(projectRoot, 'tsconfig.json')
  const result: { baseUrl: string; paths: Record<string, string[]> } = {
    baseUrl: projectRoot,
    paths: {
      '@/*': ['./*']
    }
  }

  try {
    if (fs.existsSync(tsconfigPath)) {
      const content = fs.readFileSync(tsconfigPath, 'utf-8')
      const cleanContent = content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(?:^|[^:])\/\/.*$/gm, '')
      const parsed = JSON.parse(cleanContent) as TsConfig
      if (parsed.compilerOptions) {
        if (parsed.compilerOptions.baseUrl) {
          result.baseUrl = path.resolve(projectRoot, parsed.compilerOptions.baseUrl)
        }
        if (parsed.compilerOptions.paths) {
          result.paths = parsed.compilerOptions.paths
        }
      }
    }
  } catch (e) {
    console.warn(`[SceneParser] Failed to parse tsconfig.json in ${projectRoot}`, e)
  }

  return result
}

function matchTsConfigPath(request: string, baseUrl: string, paths: Record<string, string[]>): string | null {
  for (const [pattern, targetPaths] of Object.entries(paths)) {
    if (pattern.includes('*')) {
      const [prefix, suffix] = pattern.split('*')
      if (request.startsWith(prefix) && request.endsWith(suffix)) {
        const wildcardValue = request.slice(prefix.length, request.length - suffix.length)
        
        for (const targetPath of targetPaths) {
          const resolvedTarget = targetPath.replace('*', wildcardValue)
          const absolutePath = path.resolve(baseUrl, resolvedTarget)
          
          const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']
          for (const ext of extensions) {
            const pathWithExt = absolutePath + ext
            if (fs.existsSync(pathWithExt) && fs.statSync(pathWithExt).isFile()) {
              return pathWithExt
            }
          }
        }
      }
    } else {
      if (request === pattern) {
        for (const targetPath of targetPaths) {
          const absolutePath = path.resolve(baseUrl, targetPath)
          const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']
          for (const ext of extensions) {
            const pathWithExt = absolutePath + ext
            if (fs.existsSync(pathWithExt) && fs.statSync(pathWithExt).isFile()) {
              return pathWithExt
            }
          }
        }
      }
    }
  }
  return null
}


// ─── Helper: Find line number using source code heuristics ─────────────────
function findLineNumber(
  content: string,
  kind: 'label' | 'goto' | 'call' | 'next' | 'condition',
  target: string,
  startIndex: number
): { line: number; index: number } {
  const lines = content.split('\n')
  
  // Create matching patterns
  let regex: RegExp
  if (kind === 'label') {
    regex = new RegExp(`\\blabel\\s*\\(\\s*['"\`]${escapeRegExp(target)}['"\`]`)
  } else if (kind === 'goto') {
    regex = new RegExp(`\\bgoto\\s*\\(\\s*['"\`]${escapeRegExp(target)}['"\`]|\\bgoto\\s*:\\s*['"\`]${escapeRegExp(target)}['"\`]`)
  } else if (kind === 'call') {
    regex = new RegExp(`\\bcall\\s*\\(\\s*['"\`]${escapeRegExp(target)}['"\`]`)
  } else if (kind === 'next') {
    regex = new RegExp(`\\bnext\\s*\\(\\s*['"\`]${escapeRegExp(target)}['"\`]`)
  } else {
    // Condition
    regex = /\bcondition\s*\(/
  }

  // Scan lines starting from startIndex
  for (let i = startIndex; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      return { line: i + 1, index: i + 1 }
    }
  }

  // Fallback: search from beginning if not found
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) {
      return { line: i + 1, index: i + 1 }
    }
  }

  return { line: 1, index: startIndex }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ─── Flow Reconstruction Logic ─────────────────────────────────────────────
interface RawStep {
  type: string
  name?: string
  label?: string
  scene?: string
  if?: any
  elseGoto?: string
  value?: any
}

function parseConditionExpression(fn: any): string {
  if (typeof fn === 'function') {
    // Extract condition body from function string (e.g. "(_vars) => _vars._tries >= 3")
    const str = fn.toString()
    const arrowIdx = str.indexOf('=>')
    if (arrowIdx !== -1) {
      return str.slice(arrowIdx + 2).trim()
    }
    return str
  }
  return String(fn)
}

/**
 * Reconstructs the flattened array of dialogue steps back into a nested FlowItem hierarchy.
 */
function reconstructFlow(
  steps: RawStep[],
  content: string
): { flowItems: FlowItem[]; externalConnections: SceneConnection[] } {
  const externalConnections: SceneConnection[] = []
  
  let lineIdx = 0
  let condIdCounter = 0

  function buildTree(startIndex: number, stopLabel?: string): { items: FlowItem[]; nextIndex: number } {
    const items: FlowItem[] = []
    let i = startIndex

    while (i < steps.length) {
      const step = steps[i]

      // Stop condition for recursion (for condition if/else branches)
      if (stopLabel && step.type === 'label' && step.name === stopLabel) {
        return { items, nextIndex: i }
      }

      // Ignore inner internal labels/gotos generated by _flattenSteps
      if (
        (step.type === 'label' && step.name?.startsWith('__cond_')) ||
        (step.type === 'goto' && step.label?.startsWith('__cond_'))
      ) {
        i++
        continue
      }

      switch (step.type) {
        case 'label': {
          const { line, index } = findLineNumber(content, 'label', step.name || '', lineIdx)
          lineIdx = index
          items.push({ kind: 'label', name: step.name || '', line })
          break
        }
        case 'goto': {
          const { line, index } = findLineNumber(content, 'goto', step.label || '', lineIdx)
          lineIdx = index
          items.push({ kind: 'goto', target: step.label || '', line })
          break
        }
        case 'call': {
          const { line, index } = findLineNumber(content, 'call', step.scene || '', lineIdx)
          lineIdx = index
          items.push({ kind: 'call', target: step.scene || '', line })
          externalConnections.push({ type: 'call', target: step.scene || '', conditional: false })
          break
        }
        case 'next': {
          const { line, index } = findLineNumber(content, 'next', step.scene || '', lineIdx)
          lineIdx = index
          items.push({ kind: 'next', target: step.scene || '', line })
          externalConnections.push({ type: 'next', target: step.scene || '', conditional: false })
          break
        }
        case 'condition': {
          const condId = condIdCounter++
          const { line, index } = findLineNumber(content, 'condition', '', lineIdx)
          lineIdx = index

          const expr = parseConditionExpression(step.if)
          const elseLabel = step.elseGoto // e.g. __cond_else_X or __cond_end_X
          const isElseBranch = elseLabel?.includes('_else_')
          const endLabel = elseLabel?.replace('_else_', '_end_') || `__cond_end_${condId}`

          // Recursive parse for ifBranch
          const ifRes = buildTree(i + 1, elseLabel)
          let nextIdx = ifRes.nextIndex

          // Recursive parse for elseBranch if present
          let elseItems: FlowItem[] = []
          if (isElseBranch) {
            const elseRes = buildTree(nextIdx + 1, endLabel)
            elseItems = elseRes.items
            nextIdx = elseRes.nextIndex
          }

          items.push({
            kind: 'condition',
            id: condId,
            expression: expr,
            ifBranch: ifRes.items,
            elseBranch: elseItems,
            line,
          })

          // Update conditional external connections inside branches
          const updateConnectionsConditional = (itemsList: FlowItem[]) => {
            for (const item of itemsList) {
              if (item.kind === 'call') {
                externalConnections.push({ type: 'call', target: item.target, conditional: true })
              } else if (item.kind === 'next') {
                externalConnections.push({ type: 'next', target: item.target, conditional: true })
              } else if (item.kind === 'condition') {
                updateConnectionsConditional(item.ifBranch)
                updateConnectionsConditional(item.elseBranch)
              }
            }
          }
          updateConnectionsConditional(ifRes.items)
          updateConnectionsConditional(elseItems)

          i = nextIdx
          break
        }
      }
      i++
    }

    return { items, nextIndex: i }
  }

  const { items } = buildTree(0)
  
  // Deduplicate connections (distinct by target and type)
  const uniqueConnections: SceneConnection[] = []
  const seen = new Set<string>()
  for (const conn of externalConnections) {
    const key = `${conn.type}:${conn.target}`
    if (!seen.has(key)) {
      seen.add(key)
      uniqueConnections.push(conn)
    }
  }

  return { flowItems: items, externalConnections: uniqueConnections }
}

// ─── Scene Parsing Entry Point ──────────────────────────────────────────────
export async function parseSceneFile(filePath: string, projectPath?: string): Promise<ParseResult> {
  const projectRoot = projectPath || findProjectRoot(filePath)

  // Clear require cache for all project files to support real-time updates of dependencies
  try {
    const projectRootNormal = path.normalize(projectRoot).toLowerCase()
    for (const cacheKey of Object.keys(require.cache)) {
      if (path.normalize(cacheKey).toLowerCase().startsWith(projectRootNormal)) {
        delete require.cache[cacheKey]
      }
    }
  } catch (e) {
    // Ignore cache clear error
  }

  // Register esbuild dynamically to load typescript module
  const { unregister } = register({
    target: 'node22',
  })

  // Set up tsconfig path alias resolution
  const resolvedConfig = loadTsConfigPaths(projectRoot)
  // @ts-ignore
  const originalResolveFilename = Module._resolveFilename

  let rawSteps: RawStep[] = []
  let nextScene: string | { scene: string; preserve: boolean } | undefined
  let parseError: string | undefined = undefined

  try {
    // @ts-ignore
    Module._resolveFilename = function (
      request: string,
      parent: { paths: string[] } | undefined,
      isMain: boolean,
      options: Record<string, unknown> | undefined
    ) {
      const resolved = matchTsConfigPath(request, resolvedConfig.baseUrl, resolvedConfig.paths)
      if (resolved) {
        return originalResolveFilename.call(this, resolved, parent, isMain, options)
      }
      return originalResolveFilename.call(this, request, parent, isMain, options)
    }

    const imported = require(filePath)
    const sceneDef = imported.default || imported

    if (sceneDef && sceneDef.kind === 'dialogue') {
      rawSteps = (sceneDef.dialogues || []) as RawStep[]
      nextScene = sceneDef.nextScene
    }
  } catch (e: any) {
    parseError = e instanceof Error ? e.message : String(e)
    console.error(`[SceneParser] Failed to load/evaluate scene file: ${filePath}`, e)
  } finally {
    // @ts-ignore
    Module._resolveFilename = originalResolveFilename
    unregister()
  }

  // Load raw code content to capture line numbers
  let content = ''
  try {
    content = fs.readFileSync(filePath, 'utf-8')
  } catch (e) {
    console.error(`[SceneParser] Failed to read source file content: ${filePath}`, e)
  }

  // Reconstruct nested structure
  const result: ParseResult = reconstructFlow(rawSteps, content)
  if (parseError) {
    result.error = parseError
  }

  // Append option-level next scene connection if specified
  if (nextScene) {
    const targetScene = typeof nextScene === 'string' ? nextScene : nextScene.scene
    
    // Check if next scene connection is already registered
    const hasNext = result.externalConnections.some(
      (conn) => conn.type === 'next' && conn.target === targetScene
    )
    if (!hasNext) {
      result.externalConnections.push({
        type: 'next',
        target: targetScene,
        conditional: false,
      })
      
      // Attempt to locate defineScene options in file content to assign options line
      let lineNum = 1
      const match = content.match(/defineScene\s*\(\s*\{/)
      if (match && match.index !== undefined) {
        const preSlice = content.slice(0, match.index)
        lineNum = preSlice.split('\n').length
      }

      result.flowItems.push({
        kind: 'next',
        target: targetScene,
        line: lineNum,
      })
    }
  }

  return result
}
