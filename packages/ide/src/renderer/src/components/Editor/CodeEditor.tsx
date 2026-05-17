import Editor, { useMonaco, loader, type OnMount } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { useEffect, useRef, useCallback } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

// Vite Web Worker 설정
self.MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'json') return new jsonWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  }
}

loader.config({ monaco })

interface Props {
  code: string
  onChange: (value: string | undefined) => void
  language?: string
  filePath?: string
}

function toFileUri(absPath: string): string {
  return monaco.Uri.file(absPath).toString()
}

export function CodeEditor({ code, onChange, language = 'typescript', filePath }: Props) {
  const monacoInstance = useMonaco()
  const { projectPath, pendingLine, setPendingLine } = useProjectStore()
  // 마지막으로 주입한 projectPath (동일 프로젝트 중복 주입 방지)
  const injectedProjectRef = useRef<string | null>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor
  }, [])

  const handleValidate = useCallback((markers: monaco.editor.IMarker[]) => {
    if (!filePath || !projectPath) return
    const errors = markers
      .filter(m => m.severity === monaco.MarkerSeverity.Error)
      .map(m => ({ line: m.startLineNumber, message: m.message }))
    
    const normFile = filePath.replace(/\\/g, '/')
    const normProj = projectPath.replace(/\\/g, '/')
    
    let relPath = normFile
    if (normFile.toLowerCase().startsWith(normProj.toLowerCase())) {
      relPath = normFile.slice(normProj.length).replace(/^[/\\]/, '')
    }

    const store = useProjectStore.getState()
    store.setTsErrors({
      ...store.tsErrors,
      [relPath]: errors
    })
  }, [filePath, projectPath])

  // pendingLine 감지 → 해당 라인으로 커서 이동
  useEffect(() => {
    if (pendingLine == null || !editorRef.current) return
    const editor = editorRef.current
    // 약간의 딜레이로 에디터가 content를 로드한 뒤 이동
    const timer = setTimeout(() => {
      editor.revealLineInCenter(pendingLine)
      editor.setPosition({ lineNumber: pendingLine, column: 1 })
      editor.focus()
      setPendingLine(null)
    }, 100)
    return () => clearTimeout(timer)
  }, [pendingLine, setPendingLine])

  // Monaco TS 컴파일러 옵션 — 프로젝트 tsconfig.json 자동 동기화
  useEffect(() => {
    if (!monacoInstance) return

    monacoInstance.editor.setTheme('vs-dark')

    const ts = (monacoInstance.languages as any).typescript
    if (!ts) return

    const applyCompilerOptions = async () => {
      // 기본 옵션 (tsconfig 없을 때 폴백)
      const defaults = {
        target: ts.ScriptTarget.ESNext,
        allowNonTsExtensions: true,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        module: ts.ModuleKind.ESNext,
        noEmit: true,
        esModuleInterop: true,
        paths: {} as Record<string, string[]>,
      }

      if (!projectPath) {
        ts.typescriptDefaults.setCompilerOptions(defaults)
        return
      }

      try {
        const tsconfigPath = projectPath.replace(/\\/g, '/') + '/tsconfig.json'
        const res = await window.api.fs.readFile(tsconfigPath)

        if (res.success && res.content) {
          const tsconfig = JSON.parse(res.content)
          const opts = tsconfig.compilerOptions ?? {}

          // tsconfig paths → Monaco file URI paths 변환
          const monacoPaths: Record<string, string[]> = {}
          const projectUri = monaco.Uri.file(projectPath).toString() + '/'

          if (opts.paths) {
            for (const [pattern, targets] of Object.entries(opts.paths)) {
              monacoPaths[pattern] = (targets as string[]).map((t: string) => {
                // './*' → 'file:///D:/project/*' 형태로 변환
                const normalized = t.replace(/^\.\//, '')
                return projectUri + normalized
              })
            }
          }

          // tsconfig target 매핑
          const targetMap: Record<string, number> = {
            es3: ts.ScriptTarget.ES3,
            es5: ts.ScriptTarget.ES5,
            es2015: ts.ScriptTarget.ES2015,
            es2016: ts.ScriptTarget.ES2016,
            es2017: ts.ScriptTarget.ES2017,
            es2018: ts.ScriptTarget.ES2018,
            es2019: ts.ScriptTarget.ES2019,
            es2020: ts.ScriptTarget.ES2020,
            esnext: ts.ScriptTarget.ESNext,
          }

          // tsconfig module 매핑
          const moduleMap: Record<string, number> = {
            none: ts.ModuleKind.None,
            commonjs: ts.ModuleKind.CommonJS,
            amd: ts.ModuleKind.AMD,
            umd: ts.ModuleKind.UMD,
            system: ts.ModuleKind.System,
            es2015: ts.ModuleKind.ES2015,
            esnext: ts.ModuleKind.ESNext,
          }

          ts.typescriptDefaults.setCompilerOptions({
            ...defaults,
            target: targetMap[(opts.target ?? 'esnext').toLowerCase()] ?? ts.ScriptTarget.ESNext,
            module: moduleMap[(opts.module ?? 'esnext').toLowerCase()] ?? ts.ModuleKind.ESNext,
            strict: opts.strict ?? false,
            esModuleInterop: opts.esModuleInterop ?? true,
            resolveJsonModule: opts.resolveJsonModule ?? false,
            isolatedModules: opts.isolatedModules ?? false,
            noImplicitReturns: opts.noImplicitReturns ?? false,
            paths: monacoPaths,
          })
        } else {
          ts.typescriptDefaults.setCompilerOptions(defaults)
        }
      } catch {
        ts.typescriptDefaults.setCompilerOptions(defaults)
      }
    }

    applyCompilerOptions()

    ts.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [2307, 2792]
    })
  }, [monacoInstance, projectPath])

  // 프로젝트 파일 + fumika 타입을 addExtraLib으로 주입
  // addExtraLib은 TS 워커의 별도 가상 파일시스템을 사용하므로
  // createModel/program 동기화 문제를 회피한다.
  useEffect(() => {
    if (!monacoInstance || !projectPath) return
    if (injectedProjectRef.current === projectPath) return
    injectedProjectRef.current = projectPath

    const ts = (monacoInstance.languages as any).typescript
    if (!ts) return

    const injectAll = async () => {
      try {
        // ── 1. 프로젝트 소스 파일 (node_modules 제외) ──
        const res = await window.api.fs.readDir(projectPath, true)
        if (!res.success || !res.files) return

        type DirEntry = { name: string; isDirectory: boolean; path: string; children: DirEntry[] }

        const collectTsPaths = (entries: DirEntry[], skipNodeModules = true): string[] => {
          const result: string[] = []
          for (const entry of entries) {
            if (entry.isDirectory) {
              if (skipNodeModules && entry.name === 'node_modules') continue
              result.push(...collectTsPaths(entry.children ?? [], skipNodeModules))
            } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) {
              result.push(entry.path)
            }
          }
          return result
        }

        const srcPaths = collectTsPaths(res.files as DirEntry[], true)

        // 모든 파일 경로 수집 (draft + original)
        const absPaths = srcPaths.map(
          (rel) => projectPath + '\\' + rel.replace(/\//g, '\\')
        )
        const draftPaths = absPaths.map(
          (abs) => abs.replace(/([^/\\]+)$/, '.$1.draft')
        )

        // 배치 IPC: draft와 원본을 한 번에 읽음 + fumika 타입도 병렬 요청
        const [draftRes, originalRes, typesRes] = await Promise.all([
          window.api.fs.readFiles(draftPaths),
          window.api.fs.readFiles(absPaths),
          window.api.project.getTypes(projectPath),
        ])

        const draftFiles = draftRes.success ? draftRes.files ?? [] : []
        const originalFiles = originalRes.success ? originalRes.files ?? [] : []

        // draft 우선, 없으면 original로 폴백
        for (let i = 0; i < absPaths.length; i++) {
          const content = draftFiles[i]?.content ?? originalFiles[i]?.content
          if (content == null) continue
          ts.typescriptDefaults.addExtraLib(content, toFileUri(absPaths[i]))
        }

        // ── 2. fumika 타입 파일 (이미 병렬로 가져옴) ──
        if (typesRes.success && typesRes.types) {
          for (const type of typesRes.types) {
            const absPath = projectPath + '\\node_modules\\fumika\\dist\\types\\' + type.path.replace(/\//g, '\\')
            ts.typescriptDefaults.addExtraLib(type.content, toFileUri(absPath))
          }

          // fumika 진입점
          const fumikaIndexUri = toFileUri(projectPath + '\\node_modules\\fumika\\index.d.ts')
          ts.typescriptDefaults.addExtraLib(
            `export * from './dist/types/index'`,
            fumikaIndexUri
          )
        }
      } catch (e) {
        console.error('Failed to inject project files:', e)
      }
    }

    injectAll()
  }, [monacoInstance, projectPath])

  // watcher 선언 파일 갱신 → addExtraLib 업데이트
  useEffect(() => {
    if (!monacoInstance) return

    const ts = (monacoInstance.languages as any).typescript
    if (!ts) return

    const unsubscribe = window.api.fs.onFileChanged(({ path: changedPath, content }) => {
      const libUri = toFileUri(changedPath)
      // addExtraLib은 같은 URI로 호출 시 자동 교체
      ts.typescriptDefaults.addExtraLib(content, libUri)
    })

    return unsubscribe
  }, [monacoInstance])

  // 현재 에디터가 열린 파일의 extraLib을 제거하여 model/extraLib 충돌 방지
  // Monaco는 같은 URI에 model과 extraLib이 동시 존재하면
  // TS worker가 두 소스를 모두 인식 → 중복 선언/타입 충돌 발생
  useEffect(() => {
    if (!monacoInstance || !filePath) return
    const ts = (monacoInstance.languages as any).typescript
    if (!ts) return

    const libUri = toFileUri(filePath)
    // model이 활성화되면 extraLib 제거 (model이 TS worker에 우선)
    ts.typescriptDefaults.addExtraLib('', libUri)

    return () => {
      // 에디터가 닫히면 최종 코드로 extraLib 복원
      // 다른 파일에서 이 파일을 참조할 때 타입 정보 유지
      if (code !== undefined) {
        ts.typescriptDefaults.addExtraLib(code, libUri)
      }
    }
  }, [monacoInstance, filePath])

  const fileUri = filePath ? toFileUri(filePath) : undefined

  return (
    <div className="w-full h-full overflow-hidden rounded-lg border border-surface-700 bg-[#1e1e1e]">
      <Editor
        height="100%"
        defaultLanguage={language}
        path={fileUri}
        value={code}
        onChange={onChange}
        onMount={handleEditorMount}
        onValidate={handleValidate}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          padding: { top: 16, bottom: 16 },
        }}
      />
    </div>
  )
}
