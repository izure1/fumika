// =============================================================
// configLoader.ts — esbuild-register 기반 프로젝트 설정 동적 로더
// =============================================================
// novel.config.ts를 실제로 평가(evaluate)하여 모듈 키를 추출하고,
// TypeScript AST를 이용해 빌트인 모듈 → 소스 파일 매핑을 구축합니다.
// =============================================================

import { register } from 'esbuild-register/dist/node'
import Module from 'module'
import type ts from 'typescript'
import path from 'path'
import fs from 'fs'
import { parseInterfaceFieldsFromAST, getTsInstance } from './typescript'

// ─── 타입 정의 ────────────────────────────────────────────────

export interface AvailableCommands {
  builtin: string[]
  custom: string[]
}

interface BuiltinModuleMapping {
  /** 모듈 키 → 해당 모듈의 소스 파일 상대 경로 */
  keyToFile: Record<string, string>
  /** 모듈 키 → 변수명 (예: 'character-focus' → 'characterFocusModule') */
  keyToVar: Record<string, string>
}

const BUILTIN_KEYS = [
  'dialogue', 'choice', 'background', 'character', 'character-focus',
  'character-highlight', 'character-effect', 'mood', 'effect',
  'overlay-text', 'overlay-image', 'overlay-effect', 'screen-fade',
  'screen-flash', 'screen-wipe', 'camera-zoom', 'camera-pan',
  'camera-effect', 'ui', 'control', 'audio', 'dialogBox', 'input', 'element'
]

const BUILTIN_KEY_TO_FILE: Record<string, string> = {
  dialogue: '../modules/dialogue',
  choice: '../modules/choice',
  background: '../modules/background',
  character: '../modules/character',
  'character-focus': '../modules/character',
  'character-highlight': '../modules/character',
  'character-effect': '../modules/character',
  mood: '../modules/mood',
  effect: '../modules/effect',
  'overlay-text': '../modules/overlay',
  'overlay-image': '../modules/overlay',
  'overlay-effect': '../modules/overlay',
  'screen-fade': '../modules/screen',
  'screen-flash': '../modules/screen',
  'screen-wipe': '../modules/screen',
  'camera-zoom': '../modules/camera',
  'camera-pan': '../modules/camera',
  'camera-effect': '../modules/camera',
  ui: '../modules/ui',
  control: '../modules/control',
  audio: '../modules/audio',
  dialogBox: '../modules/dialogBox',
  input: '../modules/input',
  element: '../modules/element'
}

// ─── 캐시 ─────────────────────────────────────────────────────

let _builtinMappingCache: BuiltinModuleMapping | null = null
let _builtinMappingCacheKey = ''

// ─── esbuild-register 기반 config 로더 ───────────────────────

/**
 * esbuild-register로 프로젝트의 novel.config.ts를 실제 평가하여
 * 등록된 모든 모듈 키를 추출합니다.
 */
export async function loadConfigModuleKeys(projectPath: string): Promise<string[]> {
  const configPath = path.resolve(projectPath, 'novel.config.ts')

  if (!fs.existsSync(configPath)) return []

  const { unregister } = register({ target: 'node18' })

  const originalResolveFilename = (Module as any)._resolveFilename
  const moduleAsAny = Module as any
  moduleAsAny._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
    if (request.startsWith('@/')) {
      const targetPath = path.join(projectPath, request.slice(2))
      return originalResolveFilename.call(this, targetPath, parent, isMain, options)
    }
    return originalResolveFilename.call(this, request, parent, isMain, options)
  }

  try {
    // 프로젝트 디렉토리 기준으로 모듈을 해석하는 require 생성
    const projectRequire = Module.createRequire(configPath)

    // 이전 캐시 무효화: 프로젝트 파일이 수정되었을 수 있으므로
    const normalizedProject = projectPath.replace(/\\/g, '/')
    for (const key of Object.keys(require.cache)) {
      if (key.replace(/\\/g, '/').startsWith(normalizedProject)) {
        delete require.cache[key]
      }
    }

    const mod = projectRequire(configPath)
    const config = mod.default || mod

    if (config && typeof config === 'object' && config.modules) {
      return Object.keys(config.modules)
    }
    return []
  } catch (err) {
    console.warn('[IDE] esbuild-register config load failed:', err)
    return []
  } finally {
    const moduleAsAny = Module as any
    moduleAsAny._resolveFilename = originalResolveFilename
    unregister()
  }
}

// ─── AST 기반 빌트인 모듈 매핑 빌더 ──────────────────────────

/**
 * fumika core의 defineNovelConfig.ts를 TypeScript AST로 분석하여
 * BUILTIN_MODULES 객체의 { 모듈 키 → 소스 파일 경로, 변수명 } 매핑을 구축합니다.
 *
 * 정규식 대신 TypeScript 파서를 사용하여 정확하게 추출합니다.
 */
function parseBuiltinModuleMapping(content: string, isDts: boolean, projectPath: string): BuiltinModuleMapping {
  const ts = getTsInstance(projectPath)
  const sf = ts.createSourceFile(
    isDts ? 'defineNovelConfig.d.ts' : 'defineNovelConfig.ts',
    content,
    ts.ScriptTarget.Latest,
    true
  )

  // 1단계: import 문 수집 → { 변수명 → 상대 경로 }
  const importMap: Record<string, string> = {}
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const modulePath = stmt.moduleSpecifier.text
      const clause = stmt.importClause
      if (!clause) continue

      // default import
      if (clause.name) {
        importMap[clause.name.text] = modulePath
      }

      // named imports
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const specifier of clause.namedBindings.elements) {
          importMap[specifier.name.text] = modulePath
        }
      }
    }
  }

  // 2단계: BUILTIN_MODULES 추출
  const keyToVar: Record<string, string> = {}
  const keyToFile: Record<string, string> = {}

  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'BUILTIN_MODULES'
    ) {
      if (node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
        for (const prop of node.initializer.properties) {
          if (ts.isPropertyAssignment(prop)) {
            let key: string | undefined
            if (ts.isStringLiteral(prop.name)) {
              key = prop.name.text
            } else if (ts.isIdentifier(prop.name)) {
              key = prop.name.text
            }

            let varName: string | undefined
            if (ts.isIdentifier(prop.initializer)) {
              varName = prop.initializer.text
            }

            if (key && varName) {
              keyToVar[key] = varName
              if (importMap[varName]) {
                keyToFile[key] = importMap[varName]
              }
            }
          }

          if (ts.isShorthandPropertyAssignment(prop)) {
            const key = prop.name.text
            keyToVar[key] = key
            if (importMap[key]) {
              keyToFile[key] = importMap[key]
            }
          }
        }
      } else if (node.type && ts.isTypeLiteralNode(node.type)) {
        for (const member of node.type.members) {
          if (ts.isPropertySignature(member)) {
            let key: string | undefined
            if (ts.isIdentifier(member.name)) {
              key = member.name.text
            } else if (ts.isStringLiteral(member.name)) {
              key = member.name.text
            }
            if (key) {
              keyToVar[key] = key
              if (BUILTIN_KEY_TO_FILE[key]) {
                keyToFile[key] = BUILTIN_KEY_TO_FILE[key]
              }
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sf)

  return { keyToFile, keyToVar }
}

// ─── fumika core 소스 경로 탐색 ──────────────────────────────

/**
 * 프로젝트 기준으로 fumika core의 소스 디렉토리를 찾습니다.
 * 모노레포와 npm 설치 양쪽을 지원합니다.
 */
function findCoreSourceDir(projectPath: string): string | null {
  const candidates = [
    // 모노레포 (packages/core)
    path.resolve(projectPath, '../../packages/core/src'),
    path.resolve(projectPath, '../core/src'),
    // npm 설치 (소스 또는 타입 정의 경로 포함)
    path.resolve(projectPath, 'node_modules/fumika/src'),
    path.resolve(projectPath, '../node_modules/fumika/src'),
    path.resolve(projectPath, '../../node_modules/fumika/src'),
    path.resolve(projectPath, 'node_modules/fumika/dist/types'),
    path.resolve(projectPath, '../node_modules/fumika/dist/types'),
    path.resolve(projectPath, '../../node_modules/fumika/dist/types'),
  ]

  for (const dir of candidates) {
    const tsTarget = path.join(dir, 'define', 'defineNovelConfig.ts')
    const dtsTarget = path.join(dir, 'define', 'defineNovelConfig.d.ts')
    if (fs.existsSync(tsTarget) || fs.existsSync(dtsTarget)) return dir
  }
  return null
}

// ─── 빌트인 모듈 매핑 조회 (캐시 포함) ────────────────────────

function getBuiltinMapping(projectPath: string): BuiltinModuleMapping | null {
  const coreDir = findCoreSourceDir(projectPath)
  if (!coreDir) return null

  const tsPath = path.join(coreDir, 'define', 'defineNovelConfig.ts')
  const dtsPath = path.join(coreDir, 'define', 'defineNovelConfig.d.ts')
  const defineNovelConfigPath = fs.existsSync(tsPath) ? tsPath : dtsPath

  // 캐시 확인
  if (_builtinMappingCache && _builtinMappingCacheKey === defineNovelConfigPath) {
    return _builtinMappingCache
  }

  try {
    const content = fs.readFileSync(defineNovelConfigPath, 'utf-8')
    const isDts = defineNovelConfigPath.endsWith('.d.ts')
    _builtinMappingCache = parseBuiltinModuleMapping(content, isDts, projectPath)
    _builtinMappingCacheKey = defineNovelConfigPath
    return _builtinMappingCache
  } catch (err) {
    console.warn('[IDE] Failed to parse defineNovelConfig:', err)
    return null
  }
}

// ─── 사용 가능한 커맨드 목록 조회 ─────────────────────────────

/**
 * 프로젝트의 사용 가능한 모든 커맨드 타입을 반환합니다.
 *
 * 1. esbuild-register로 novel.config.ts를 평가하여 전체 모듈 키 추출
 * 2. fumika core의 defineNovelConfig.ts AST 분석으로 빌트인 모듈 키 식별
 * 3. 전체 - 빌트인 = 커스텀 모듈 키
 */
export async function getAvailableCommands(projectPath: string): Promise<AvailableCommands> {
  const allKeys = await loadConfigModuleKeys(projectPath)
  const mapping = getBuiltinMapping(projectPath)

  const builtinSet = mapping
    ? new Set(Object.keys(mapping.keyToVar))
    : new Set(BUILTIN_KEYS)

  const builtin = allKeys.filter(k => builtinSet.has(k))
  const custom = allKeys.filter(k => !builtinSet.has(k))

  return { builtin, custom }
}

// ─── 모듈 키 → 필드 목록 해석 ─────────────────────────────────

/**
 * 주어진 모듈 키에 대해 커맨드 인터페이스의 필드 목록을 반환합니다.
 *
 * 1. 빌트인 모듈: AST 매핑에서 소스 파일 경로를 해석하고 파싱
 * 2. 커스텀 모듈: 프로젝트의 modules/ 디렉토리 또는 novel.config.ts에서 파싱
 */
export async function resolveCommandFields(
  projectPath: string,
  moduleKey: string
): Promise<string[]> {
  // ── 1. 빌트인 모듈 시도 ──
  const mapping = getBuiltinMapping(projectPath)
  if (mapping && mapping.keyToFile[moduleKey]) {
    const coreDir = findCoreSourceDir(projectPath)
    if (coreDir) {
      const relPath = mapping.keyToFile[moduleKey]
      const defineDir = path.join(coreDir, 'define')
      
      const tsFile = path.resolve(defineDir, relPath + '.ts')
      const dtsFile = path.resolve(defineDir, relPath + '.d.ts')
      const sourceFile = fs.existsSync(tsFile) ? tsFile : dtsFile

      if (fs.existsSync(sourceFile)) {
        const content = fs.readFileSync(sourceFile, 'utf-8')
        const fields = parseInterfaceFieldsFromAST(content, moduleKey, projectPath)
        if (fields.length > 0) return fields
      }
    }
  }

  // ── 2. 커스텀 모듈 시도: modules/ 폴더의 .ts 파일 ──
  const customModulePath = path.join(projectPath, 'modules', `${moduleKey}.ts`)
  if (fs.existsSync(customModulePath)) {
    const content = fs.readFileSync(customModulePath, 'utf-8')
    const fields = parseInterfaceFieldsFromAST(content, moduleKey, projectPath)
    if (fields.length > 0) return fields
  }

  // ── 3. 커스텀 모듈 시도: novel.config.ts 내 인라인 정의 ──
  const configPath = path.join(projectPath, 'novel.config.ts')
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf-8')
    const fields = parseInterfaceFieldsFromAST(content, moduleKey, projectPath)
    if (fields.length > 0) return fields
  }

  return []
}
