import React, { useEffect, useRef, useState } from 'react'

export interface DialogBoxProps {
  isOpen: boolean
  title: string
  defaultValue?: string
  placeholder?: string
  options?: { label: string; value: string }[]
  selectOptions?: { label: string; value: string }[]
  selectLabel?: string
  onConfirm: (value: string, selectValue?: string) => void
  onCancel: () => void
}

export function DialogBox({ isOpen, title, defaultValue = '', placeholder = '', options, selectOptions, selectLabel, onConfirm, onCancel }: DialogBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const selectRef = useRef<HTMLSelectElement>(null)
  const singleSelectRef = useRef<HTMLSelectElement>(null)
  const [selectVal, setSelectVal] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (singleSelectRef.current) {
        singleSelectRef.current.focus()
      } else if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
      if (selectOptions && selectOptions.length > 0) {
        setSelectVal(selectOptions[0].value)
      }
    }
  }, [isOpen, selectOptions])

  if (!isOpen) return null

  const handleConfirm = () => {
    const textVal = inputRef.current ? inputRef.current.value : ''
    const singleVal = singleSelectRef.current ? singleSelectRef.current.value : ''
    
    if (options) {
      onConfirm(singleVal)
    } else {
      onConfirm(textVal, selectRef.current ? selectRef.current.value : selectVal)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === 'Enter') {
      handleConfirm()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="bg-surface-800 border border-surface-700 p-4 rounded-sm shadow-xl w-full max-w-md min-w-[320px] mx-4 animate-fade-scale">
        <h3 className="text-sm font-bold text-white mb-2">{title}</h3>
        {options ? (
          <select
            ref={singleSelectRef}
            className="w-full bg-surface-900 border border-surface-600 text-white px-2 py-1 rounded-sm mb-4 focus:outline-none focus:border-primary-500"
            defaultValue={defaultValue || (options.length > 0 ? options[0].value : '')}
            onKeyDown={handleKeyDown}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <>
            <input
              ref={inputRef}
              className="w-full bg-surface-900 border border-surface-600 text-white px-2 py-1 rounded-sm mb-3 focus:outline-none focus:border-primary-500"
              defaultValue={defaultValue}
              placeholder={placeholder}
              onKeyDown={handleKeyDown}
            />
            {selectOptions && (
              <div className="mb-4">
                {selectLabel && (
                  <label className="block text-[10px] text-surface-400 font-bold uppercase tracking-wider mb-1">
                    {selectLabel}
                  </label>
                )}
                <select
                  ref={selectRef}
                  className="w-full bg-surface-900 border border-surface-600 text-white px-2 py-1 rounded-sm focus:outline-none focus:border-primary-500"
                  value={selectVal}
                  onChange={(e) => setSelectVal(e.target.value)}
                  onKeyDown={handleKeyDown}
                >
                  {selectOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
        <div className="flex justify-end gap-2">
          <button 
            className="px-3 py-1 text-xs bg-surface-700 hover:bg-surface-600 rounded-sm text-white" 
            onClick={onCancel}
          >
            취소
          </button>
          <button 
            className="px-3 py-1 text-xs bg-primary-600 hover:bg-primary-500 rounded-sm text-white" 
            onClick={handleConfirm}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}

