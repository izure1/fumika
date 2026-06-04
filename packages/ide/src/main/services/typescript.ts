import type ts from 'typescript'
import path from 'path'
import { exec } from 'child_process'
import fs from 'fs'
import { createRequire } from 'module'

export interface TsError {
  line: number
  message: string
}

export type TsErrorMap = Record<string, TsError[]>

// TypeScript 모듈을 동적으로 가져오는 헬퍼 함수
export function getTsInstance(projectPath?: string): typeof ts {
  // 1. 프로젝트 폴더의 node_modules에서 찾기 시도
  if (projectPath) {
    try {
      const projectRequire = createRequire(path.join(projectPath, 'package.json'))
      const ts = projectRequire('typescript')
      if (ts) return ts
    } catch (e) {
      // ignore
    }
  }

  // 2. IDE 자체 패키지의 typescript 시도 (개발 환경이나 모노레포용)
  try {
    const ts = require('typescript')
    if (ts) return ts
  } catch (e) {
    // ignore
  }

  // 3. 마지막 폴백 (IDE 실행 디렉토리 기준)
  try {
    const parentRequire = createRequire(__dirname)
    const ts = parentRequire('typescript')
    if (ts) return ts
  } catch (e) {
    // ignore
  }

  throw new Error('TypeScript compiler (typescript) 패키지를 로드할 수 없습니다. 프로젝트에 typescript가 설치되어 있는지 확인해주세요.')
}

const parseTscOutput = (raw: string, projectPath: string): TsErrorMap => {
  const errorMap: TsErrorMap = {}
  const lines = raw.replace(/\r/g, '').split('\n')
  const normalizedProject = projectPath.replace(/\\/g, '/').replace(/\/$/, '')

  for (const line of lines) {
    const match = line.match(/^([^(]+)\((\d+),\d+\):\s+error\s+TS\d+:\s+(.+)$/)
    if (match) {
      const filePath = match[1].trim()
      const lineNum = parseInt(match[2], 10)
      const message = match[3].trim()

      let normalizedPath = filePath.replace(/\\/g, '/')
      if (normalizedPath.toLowerCase().startsWith(normalizedProject.toLowerCase())) {
        normalizedPath = normalizedPath.slice(normalizedProject.length).replace(/^\//, '')
      }

      if (normalizedPath.includes('node_modules')) continue

      if (!errorMap[normalizedPath]) {
        errorMap[normalizedPath] = []
      }
      errorMap[normalizedPath].push({ line: lineNum, message })
    }
  }
  return errorMap
}

const runTscCmd = (cmd: string, projectPath: string): Promise<{ stdout: string; stderr: string }> => {
  return new Promise((resolve) => {
    exec(
      cmd,
      {
        cwd: projectPath,
        maxBuffer: 1024 * 1024 * 10,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
      },
      (error, stdout, stderr) => {
        const raw = [stdout, stderr].join('\n')
        try {
          fs.writeFileSync(
            path.join(projectPath, 'tsc_debug.log'),
            `CMD: ${cmd}\nERROR: ${error ? error.message : 'none'}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}\nRAW:\n${raw}\n`,
            'utf-8'
          )
        } catch (e) {
          // ignore
        }
        resolve({ stdout: stdout || '', stderr: stderr || '' })
      }
    )
  })
}

const hasOnlyConfigErrors = (errorMap: TsErrorMap): boolean => {
  const keys = Object.keys(errorMap)
  return keys.length > 0 && keys.every((k) => k.endsWith('tsconfig.json'))
}

export const checkProjectTypes = async (projectPath: string, _modifiedFile?: string): Promise<TsErrorMap> => {
  let tscPath: string
  try {
    const projectRequire = createRequire(path.join(projectPath, 'package.json'))
    tscPath = projectRequire.resolve('typescript/bin/tsc')
  } catch {
    tscPath = path.join(projectPath, 'node_modules/typescript/bin/tsc')
  }

  const nodePath = process.execPath
  const baseCmd = `"${nodePath}" "${tscPath}" --noEmit --pretty false --skipLibCheck`

  // 1차: 기본 실행
  const firstRun = await runTscCmd(baseCmd, projectPath)
  const firstRaw = [firstRun.stdout, firstRun.stderr].join('\n')
  const firstResult = parseTscOutput(firstRaw, projectPath)

  // tsconfig 설정 에러로 소스 파일 검사가 차단된 경우,
  // 문제 옵션을 CLI 플래그로 덮어써서 재시도
  if (hasOnlyConfigErrors(firstResult)) {
    const retryCmd = `"${nodePath}" "${tscPath}" --noEmit --pretty false --moduleResolution node --skipLibCheck`
    const retryRun = await runTscCmd(retryCmd, projectPath)
    const retryRaw = [retryRun.stdout, retryRun.stderr].join('\n')
    const retryResult = parseTscOutput(retryRaw, projectPath)

    // 1차 설정 에러 + 2차 소스 에러를 병합
    const merged: TsErrorMap = { ...firstResult }
    for (const [key, errors] of Object.entries(retryResult)) {
      if (!merged[key]) {
        merged[key] = errors
      } else {
        merged[key] = [...merged[key], ...errors]
      }
    }
    return merged
  }

  return firstResult
}

export function parseInterfaceFieldsFromAST(content: string, interfaceName: string, projectPath?: string): string[] {
  const ts = getTsInstance(projectPath)
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true)
  const fields: string[] = []

  const extractFieldsFromType = (typeNode: ts.TypeNode) => {
    if (ts.isTypeLiteralNode(typeNode)) {
      for (const member of typeNode.members) {
        if (ts.isPropertySignature(member) && ts.isIdentifier(member.name)) {
          if (!fields.includes(member.name.text)) {
            fields.push(member.name.text)
          }
        }
      }
    } else if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
      for (const t of typeNode.types) {
        extractFieldsFromType(t)
      }
    } else if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
      const refName = typeNode.typeName.text
      if (refName === 'Expand' && typeNode.typeArguments && typeNode.typeArguments.length > 0) {
        extractFieldsFromType(typeNode.typeArguments[0])
        return
      }
      const findDeclaration = (innerNode: ts.Node) => {
        if (ts.isInterfaceDeclaration(innerNode) && innerNode.name.text === refName) {
          for (const member of innerNode.members) {
            if (ts.isPropertySignature(member) && ts.isIdentifier(member.name)) {
              if (!fields.includes(member.name.text)) {
                fields.push(member.name.text)
              }
            }
          }
        } else if (ts.isTypeAliasDeclaration(innerNode) && innerNode.name.text === refName) {
          extractFieldsFromType(innerNode.type)
        }
        ts.forEachChild(innerNode, findDeclaration)
      }
      ts.forEachChild(sourceFile, findDeclaration)
    }
  }

  function visit(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node) && node.name.text === interfaceName) {
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && ts.isIdentifier(member.name)) {
          fields.push(member.name.text)
        }
      }
    } else if (ts.isTypeAliasDeclaration(node) && node.name.text === interfaceName) {
      extractFieldsFromType(node.type)
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const varName = node.name.text
      const normalize = (s: string) => s.toLowerCase().replace(/-/g, '')
      const nVar = normalize(varName)
      const nIface = normalize(interfaceName)
      const matches =
        nVar === nIface ||
        nVar + 'module' === nIface ||
        nVar === nIface + 'module'

      if (matches) {
        if (node.initializer) {
          let callNode = node.initializer
          while (ts.isCallExpression(callNode)) {
            const expression = callNode.expression
            if (ts.isPropertyAccessExpression(expression)) {
              callNode = expression.expression
            } else if (ts.isIdentifier(expression) && expression.text === 'define') {
              if (callNode.typeArguments && callNode.typeArguments.length > 0) {
                extractFieldsFromType(callNode.typeArguments[0])
              }
              break
            } else {
              break
            }
          }
        } else if (node.type && (ts.isTypeReferenceNode(node.type) || ts.isImportTypeNode(node.type))) {
          const typeNameText = ts.isTypeReferenceNode(node.type)
            ? node.type.typeName.getText(sourceFile)
            : node.type.qualifier ? node.type.qualifier.getText(sourceFile) : ''
          if (typeNameText.includes('NovelModule') && node.type.typeArguments && node.type.typeArguments.length > 0) {
            extractFieldsFromType(node.type.typeArguments[0])
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (fields.length > 0 && !fields.includes('skip')) {
    fields.push('skip')
  }

  return fields
}

