import { create } from 'zustand'

export type ThemeColor = 'indigo' | 'rose' | 'emerald' | 'amber' | 'sky' | 'violet'
export type ThemeBg = 'slate' | 'zinc' | 'neutral' | 'stone' | 'gray'

export interface TsError {
  line: number;
  message: string;
}

interface ProjectState {
  projectPath: string | null
  activeFile: string | null
  globalLoading: boolean
  isPreviewOpen: boolean
  previewUrl: string | null
  previewLoading: boolean
  themeColor: ThemeColor
  themeBg: ThemeBg
  formatOnSave: boolean
  autoUpdate: boolean
  isSettingsOpen: boolean
  isGraphOpen: boolean
  pendingLine: number | null
  tsErrors: Record<string, TsError[]>
  isTsChecking: boolean
  isBuilding: boolean
  setProjectPath: (path: string | null) => void
  setActiveFile: (file: string | null) => void
  setGlobalLoading: (loading: boolean) => void
  setIsPreviewOpen: (open: boolean) => void
  setPreviewUrl: (url: string | null) => void
  setPreviewLoading: (loading: boolean) => void
  setThemeColor: (color: ThemeColor) => void
  setThemeBg: (bg: ThemeBg) => void
  setFormatOnSave: (format: boolean) => void
  setAutoUpdate: (enabled: boolean) => void
  setIsSettingsOpen: (open: boolean) => void
  setIsGraphOpen: (open: boolean) => void
  setPendingLine: (line: number | null) => void
  setTsErrors: (errors: Record<string, TsError[]>) => void
  setIsTsChecking: (checking: boolean) => void
  setIsBuilding: (building: boolean) => void
  initSettings: () => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectPath: null,
  activeFile: null,
  globalLoading: false,
  isPreviewOpen: false,
  previewUrl: null,
  previewLoading: false,
  themeColor: 'amber',
  themeBg: 'neutral',
  formatOnSave: true,
  autoUpdate: true,
  isSettingsOpen: false,
  isGraphOpen: false,
  pendingLine: null,
  tsErrors: {},
  isTsChecking: false,
  isBuilding: false,
  setProjectPath: (path) => set({ projectPath: path, activeFile: null, isPreviewOpen: false, tsErrors: {} }),
  setActiveFile: (file) => {
    set({ activeFile: file })
    const state = get()
    if (state.isGraphOpen && file) {
      set({ isGraphOpen: false })
    }
  },
  setGlobalLoading: (loading) => set({ globalLoading: loading }),
  setIsPreviewOpen: (open) => set({ isPreviewOpen: open }),
  setPreviewUrl: (url) => set({ previewUrl: url }),
  setPreviewLoading: (loading) => set({ previewLoading: loading }),
  setThemeColor: (color) => {
    set({ themeColor: color })
    window.api.settings.set({ themeColor: color }).catch(console.error)
  },
  setThemeBg: (bg) => {
    set({ themeBg: bg })
    window.api.settings.set({ themeBg: bg }).catch(console.error)
  },
  setFormatOnSave: (format) => {
    set({ formatOnSave: format })
    window.api.settings.set({ formatOnSave: format }).catch(console.error)
  },
  setAutoUpdate: (enabled) => {
    set({ autoUpdate: enabled })
    window.api.settings.set({ autoUpdate: enabled }).catch(console.error)
  },
  setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setIsGraphOpen: (open) => set({ isGraphOpen: open }),
  setPendingLine: (line) => set({ pendingLine: line }),
  setTsErrors: (errors) => set({ tsErrors: errors }),
  setIsTsChecking: (checking) => set({ isTsChecking: checking }),
  setIsBuilding: (building) => set({ isBuilding: building }),
  initSettings: async () => {
    try {
      const res = await window.api.settings.get()
      if (res.success && res.settings) {
        set({ 
          themeColor: res.settings.themeColor || 'amber',
          themeBg: res.settings.themeBg || 'neutral',
          formatOnSave: res.settings.formatOnSave ?? true,
          autoUpdate: res.settings.autoUpdate ?? true
        })
      }
    } catch (e) {
      console.error('Failed to init settings:', e)
    }
  }
}))

