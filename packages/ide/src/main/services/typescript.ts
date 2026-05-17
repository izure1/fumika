import { exec } from 'child_process'

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

