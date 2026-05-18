import { useEffect, useRef } from 'react'

interface LogViewerProps {
  logs: string[]
}

export function LogViewer({ logs }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const renderedCount = useRef(0)
  const prevLogsRef = useRef<string[]>([])

  useEffect(() => {
    if (!containerRef.current) return
    
    // 배열 인스턴스가 완전히 바뀌었고 내용물이 줄어들었다면 (채널 변경 또는 clear)
    if (logs === prevLogsRef.current) return
    if (logs.length < renderedCount.current || logs[0] !== prevLogsRef.current[0]) {
      containerRef.current.innerHTML = ''
      renderedCount.current = 0
    }

    const newLogs = logs.slice(renderedCount.current)
    if (newLogs.length === 0) return

    // DocumentFragment를 사용해 한 번에 Append (React 렌더링 병목 회피)
    const fragment = document.createDocumentFragment()
    newLogs.forEach(log => {
      const div = document.createElement('div')
      div.className = "text-[12px] font-mono leading-relaxed whitespace-pre-wrap break-all text-surface-300 hover:bg-surface-800/50 px-4 py-0.5"
      div.textContent = log
      fragment.appendChild(div)
    })
    
    containerRef.current.appendChild(fragment)
    renderedCount.current = logs.length
    prevLogsRef.current = logs
    
    // Auto scroll to bottom
    containerRef.current.scrollTop = containerRef.current.scrollHeight
  }, [logs])

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 overflow-y-auto custom-scrollbar bg-surface-950 py-2" 
    />
  )
}
