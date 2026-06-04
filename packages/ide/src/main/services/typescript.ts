import ts from 'typescript'
import path from 'path'
import { exec } from 'child_process'
import fs from 'fs'

export interface TsError {
  line: number
  message: string
}

export type TsErrorMap = Record<string, TsError[]>

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

export const checkProjectTypes = async (projectPath: string, _modifiedFile?: string): Promise<TsErrorMap> => {
  return new Promise((resolve) => {
    let tscPath: string
    try {
      tscPath = require.resolve('typescript/bin/tsc')
    } catch {
      tscPath = path.join(projectPath, 'node_modules/typescript/bin/tsc')
    }

    const nodePath = process.execPath
    const cmd = `"${nodePath}" "${tscPath}" --noEmit --pretty false --skipLibCheck`

    exec(cmd, { cwd: projectPath, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }, (error, stdout, stderr) => {
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
      const errorMap = parseTscOutput(raw, projectPath)
      resolve(errorMap)
    })
  })
}

export function parseInterfaceFieldsFromAST(content: string, interfaceName: string): string[] {
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

