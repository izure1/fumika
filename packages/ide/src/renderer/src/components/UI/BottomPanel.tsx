import { useOutputStore } from '../../store/useOutputStore'
import { LogViewer } from './LogViewer'
import { X, Trash2 } from 'lucide-react'
import { useState, useCallback } from 'react'

export function BottomPanel() {
  const { isPanelOpen, channels, activeChannel, setActiveChannel, setPanelOpen, clearChannel } = useOutputStore()
  const [height, setHeight] = useState(256)

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = height
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      // 마우스를 위로 올릴수록 Y 좌표가 작아지므로 높이는 커집니다.
      const newHeight = Math.max(100, Math.min(800, startHeight + (startY - moveEvent.clientY)))
      setHeight(newHeight)
    }
    
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
    }
    
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'row-resize'
  }, [height])
  
  if (!isPanelOpen) return null

  const channelNames = Object.keys(channels)
  const currentLogs = channels[activeChannel] || []

  return (
    <div 
      className="flex flex-col shrink-0 border-t border-surface-800 bg-surface-900 z-40 relative"
      style={{ height }}
    >
      {/* Resizer 핸들 */}
      <div 
        className="absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-primary-500/50 -mt-[2px] z-50 transition-colors" 
        onMouseDown={handleResizeStart}
        title="패널 높이 조절"
      />
      
      <div className="flex h-10 items-center justify-between border-b border-surface-800 px-4 bg-surface-900/50 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-surface-300 uppercase tracking-wider">출력</span>
          <select 
            value={activeChannel}
            onChange={(e) => setActiveChannel(e.target.value)}
            className="bg-surface-800 text-surface-200 text-xs px-2 py-1 rounded outline-none border border-surface-700 hover:border-surface-600 focus:border-primary-500 transition-colors"
          >
            {channelNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-surface-400">
          <button 
            onClick={() => clearChannel(activeChannel)}
            className="p-1.5 hover:bg-surface-800 hover:text-surface-100 rounded transition-colors"
            title="출력 지우기"
          >
            <Trash2 size={14} />
          </button>
          <button 
            onClick={() => setPanelOpen(false)}
            className="p-1.5 hover:bg-surface-800 hover:text-surface-100 rounded transition-colors"
            title="패널 닫기"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative bg-surface-950">
        <LogViewer logs={currentLogs} />
      </div>
    </div>
  )
}
