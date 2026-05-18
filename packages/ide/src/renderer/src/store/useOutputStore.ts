import { create } from 'zustand'

interface OutputState {
  isPanelOpen: boolean
  activeChannel: string
  channels: Record<string, string[]>
  togglePanel: () => void
  setPanelOpen: (open: boolean) => void
  setActiveChannel: (channel: string) => void
  addLog: (channel: string, message: string) => void
  clearChannel: (channel: string) => void
}

export const useOutputStore = create<OutputState>((set) => ({
  isPanelOpen: false,
  activeChannel: 'Electron Main (Log)',
  channels: {
    'Electron Main (Log)': [],
    'Electron Main (Error)': [],
    'Electron Main (Warn)': [],
  },
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  setPanelOpen: (open) => set({ isPanelOpen: open }),
  setActiveChannel: (channel) => set((state) => ({ 
    activeChannel: channel,
    channels: { ...state.channels, [channel]: state.channels[channel] || [] }
  })),
  addLog: (channel, message) => set((state) => {
    const channelLogs = state.channels[channel] || []
    // 너무 많은 로그가 메모리를 점유하지 않도록 최대 5000줄로 제한
    const newLogs = channelLogs.length >= 5000 ? channelLogs.slice(1000) : channelLogs
    return {
      channels: {
        ...state.channels,
        [channel]: [...newLogs, message]
      }
    }
  }),
  clearChannel: (channel) => set((state) => ({
    channels: {
      ...state.channels,
      [channel]: []
    }
  }))
}))
