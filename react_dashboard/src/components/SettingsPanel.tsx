import { useRef, useState } from 'react'
import {
  useStore,
  type MapTheme,
  type ColorPalette,
  COLOR_PALETTES,
} from '../store'

const THEME_OPTIONS: { value: MapTheme; label: string }[] = [
  { value: 'dark-matter', label: '🌑 Dark Matter' },
  { value: 'positron', label: '⬜ Positron' },
  { value: 'voyager', label: '🗺️ Voyager' },
]

const PALETTE_OPTIONS: { value: ColorPalette; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'rainbow', label: 'Rainbow' },
  { value: 'mint', label: 'Mint' },
  { value: 'warm', label: 'Warm' },
  { value: 'cool', label: 'Cool' },
]

export default function SettingsPanel() {
  const theme = useStore((s) => s.theme)
  const palette = useStore((s) => s.palette)
  const setTheme = useStore((s) => s.setTheme)
  const setPalette = useStore((s) => s.setPalette)
  const exportSettings = useStore((s) => s.exportSettings)
  const importSettings = useStore((s) => s.importSettings)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState('')

  const handleExport = () => {
    const json = exportSettings()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dashboard-preset.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    fileRef.current?.click()
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const ok = importSettings(reader.result as string)
      setImportMsg(ok ? '✓ 적용됨' : '✗ 실패')
      setTimeout(() => setImportMsg(''), 2000)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 70,
        right: 16,
        zIndex: 10,
        background: 'rgba(30,30,30,0.92)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '12px 14px',
        backdropFilter: 'blur(8px)',
        minWidth: 170,
      }}
    >
      <div style={{ color: '#999', fontSize: 11, marginBottom: 8 }}>설정</div>

      {/* Theme */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ color: '#bbb', fontSize: 11, marginBottom: 4 }}>지도 테마</div>
        {THEME_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 0',
              color: theme === opt.value ? '#fff' : '#888',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="theme"
              checked={theme === opt.value}
              onChange={() => setTheme(opt.value)}
              style={{ accentColor: '#4285f4' }}
            />
            {opt.label}
          </label>
        ))}
      </div>

      {/* Palette */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ color: '#bbb', fontSize: 11, marginBottom: 4 }}>색상 팔레트</div>
        {PALETTE_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 0',
              color: palette === opt.value ? '#fff' : '#888',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="palette"
              checked={palette === opt.value}
              onChange={() => setPalette(opt.value)}
              style={{ accentColor: '#4285f4' }}
            />
            <span style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              {opt.label}
              <span style={{ display: 'flex', gap: 1, marginLeft: 4 }}>
                {COLOR_PALETTES[opt.value].slice(0, 5).map((c, i) => (
                  <span
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: `rgb(${c[0]},${c[1]},${c[2]})`,
                      display: 'inline-block',
                    }}
                  />
                ))}
              </span>
            </span>
          </label>
        ))}
      </div>

      {/* Preset export/import */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
        <div style={{ color: '#bbb', fontSize: 11, marginBottom: 4 }}>프리셋</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleExport}
            style={{
              flex: 1,
              background: 'rgba(66,133,244,0.2)',
              border: '1px solid rgba(66,133,244,0.4)',
              borderRadius: 4,
              color: '#8ab4f8',
              fontSize: 11,
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            Export
          </button>
          <button
            onClick={handleImport}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 4,
              color: '#aaa',
              fontSize: 11,
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            Import
          </button>
        </div>
        {importMsg && (
          <div style={{ color: importMsg.startsWith('✓') ? '#4caf50' : '#f44336', fontSize: 10, marginTop: 4 }}>
            {importMsg}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={onFileChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  )
}
