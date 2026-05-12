import { useCallback, useRef, useState } from 'react'
import { parseCSV } from '../utils/csv'
import { useStore } from '../store'

export default function FileUpload() {
  const setData = useStore((s) => s.setData)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const records = parseCSV(text)
        if (records.length > 0) {
          setData(records)
        }
      }
      reader.readAsText(file)
    },
    [setData]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file && file.name.endsWith('.csv')) {
        handleFile(file)
      }
    },
    [handleFile]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const onDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => inputRef.current?.click()}
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 10,
        padding: '12px 16px',
        background: isDragging ? 'rgba(66,133,244,0.3)' : 'rgba(30,30,30,0.85)',
        border: isDragging ? '2px dashed #4285f4' : '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8,
        color: '#ccc',
        fontSize: 13,
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        transition: 'all 0.2s',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        onChange={onFileSelect}
        style={{ display: 'none' }}
      />
      📂 CSV 파일을 드래그하거나 클릭
    </div>
  )
}
