import { exec } from 'child_process'
import ts from 'typescript'

export interface TsError {
  line: number;
  message: string;
}

export type TsErrorMap = Record<string, TsError[]>;

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// tsc 출력을 파싱하여 errorMap으로 변환
const parseTscOutput = (raw: string, projectPath: string): TsErrorMap => {
  const errorMap: TsErrorMap = {};
  const lines = raw.split('\n');

  // tsc --pretty false: 파일(줄,열): error TS...: 메시지
  const parenRegex = /^(.+)\((\d+),(\d+)\):\s+(error\s+TS\d+:\s+.+)$/;
  // tsc --pretty true: 파일:줄:열 - error TS...: 메시지
  const colonRegex = /^(.+):(\d+):(\d+)\s+-\s+(error\s+TS\d+:\s+.+)$/;

  const normalizedProject = projectPath.replace(/\\/g, '/').replace(/\/$/, '');

  for (const line of lines) {
    const cleaned = line.replace(/\x1b\[[0-9;]*m/g, '').trim();
    if (!cleaned) continue;

    const match = cleaned.match(parenRegex) || cleaned.match(colonRegex);
    if (!match) continue;

    const filePath = match[1].trim();
    const lineNum = parseInt(match[2], 10);
    const message = match[4];

    let normalizedPath = filePath.replace(/\\/g, '/');

    if (normalizedPath.toLowerCase().startsWith(normalizedProject.toLowerCase())) {
      normalizedPath = normalizedPath.slice(normalizedProject.length).replace(/^\//, '');
    }

    // node_modules 내부 에러는 무시
    if (normalizedPath.includes('node_modules')) continue;

    if (!errorMap[normalizedPath]) {
      errorMap[normalizedPath] = [];
    }
    errorMap[normalizedPath].push({ line: lineNum, message });
  }

  return errorMap;
};

// exec를 Promise로 래핑
const runCmd = (cmd: string, cwd: string): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve) => {
    exec(cmd, { cwd, maxBuffer: 1024 * 1024 * 10 }, (_error, stdout, stderr) => {
      resolve({ stdout: stdout || '', stderr: stderr || '' });
    });
  });

// 결과에 tsconfig.json 설정 에러만 포함되어 있는지 판별
const hasOnlyConfigErrors = (errorMap: TsErrorMap): boolean => {
  const keys = Object.keys(errorMap);
  return keys.length > 0 && keys.every(k => k.endsWith('tsconfig.json'));
};

export const checkProjectTypes = async (projectPath: string): Promise<TsErrorMap> => {
  // 1차: 기본 실행
  const baseCmd = `${npx} tsc --noEmit --pretty false --skipLibCheck`;
  const firstRun = await runCmd(baseCmd, projectPath);
  const firstRaw = [firstRun.stdout, firstRun.stderr].join('\n');
  const firstResult = parseTscOutput(firstRaw, projectPath);

  // tsconfig 설정 에러로 소스 파일 검사가 차단된 경우,
  // 문제 옵션을 CLI 플래그로 덮어써서 재시도
  if (hasOnlyConfigErrors(firstResult)) {
    const retryCmd = `${npx} tsc --noEmit --pretty false --moduleResolution node --skipLibCheck`;
    const retryRun = await runCmd(retryCmd, projectPath);
    const retryRaw = [retryRun.stdout, retryRun.stderr].join('\n');
    const retryResult = parseTscOutput(retryRaw, projectPath);

    // 1차 설정 에러 + 2차 소스 에러를 병합
    const merged: TsErrorMap = { ...firstResult };
    for (const [key, errors] of Object.entries(retryResult)) {
      if (!merged[key]) {
        merged[key] = errors;
      } else {
        merged[key] = [...merged[key], ...errors];
      }
    }
    return merged;
  }

  return firstResult;
};

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

