import { useState, useRef, useCallback } from 'react'
import { useStore, type LayerVisibility, type LayerSettings, type MapTheme, type ColorPalette, COLOR_PALETTES } from '../store'
import { parseCSV } from '../utils/csv'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  SlidersHorizontal,
  Settings,
  Upload,
  ChevronDown,
  ChevronRight,
  Radio,
} from 'lucide-react'

const LAYER_LABELS: Record<keyof LayerVisibility, { emoji: string; name: string }> = {
  point: { emoji: '📍', name: 'Point' },
  arc: { emoji: '🌈', name: 'Arc' },
  heatmap: { emoji: '🔥', name: 'Heatmap' },
  hexbin: { emoji: '⬡', name: 'Hexbin' },
  cluster: { emoji: '🔵', name: 'Cluster' },
  route: { emoji: '🛣️', name: 'Route' },
  trip: { emoji: '🚗', name: 'Trip' },
}

const RADIUS_LABELS: Partial<Record<keyof LayerVisibility, { label: string; min: number; max: number; step: number }>> = {
  point: { label: '크기', min: 10, max: 200, step: 10 },
  arc: { label: '두께', min: 0.5, max: 5, step: 0.5 },
  heatmap: { label: '반경(px)', min: 10, max: 80, step: 5 },
  hexbin: { label: '반경(m)', min: 50, max: 500, step: 50 },
  cluster: { label: '크기', min: 30, max: 200, step: 10 },
}

const THEME_OPTIONS: { value: MapTheme; label: string }[] = [
  { value: 'dark-matter', label: '🌑 Dark Matter' },
  { value: 'dark-matter-nolabels', label: '🌑 Dark (라벨 없음)' },
  { value: 'positron', label: '⬜ Positron' },
  { value: 'positron-nolabels', label: '⬜ Positron (라벨 없음)' },
  { value: 'voyager', label: '🗺️ Voyager' },
  { value: 'liberty', label: '🏛️ Liberty' },
  { value: 'osm-bright', label: '☀️ OSM Bright' },
  { value: 'watercolor', label: '🎨 수채화' },
]

const PALETTE_OPTIONS: { value: ColorPalette; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'rainbow', label: 'Rainbow' },
  { value: 'mint', label: 'Mint' },
  { value: 'warm', label: 'Warm' },
  { value: 'cool', label: 'Cool' },
]

type SectionId = 'layers' | 'filters' | 'settings' | 'upload' | 'realtime'

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedSection, setExpandedSection] = useState<SectionId>('layers')
  const [expandedLayer, setExpandedLayer] = useState<keyof LayerVisibility | null>(null)

  // Store
  const data = useStore((s) => s.data)
  const layers = useStore((s) => s.layers)
  const layerSettings = useStore((s) => s.layerSettings)
  const filters = useStore((s) => s.filters)
  const theme = useStore((s) => s.theme)
  const palette = useStore((s) => s.palette)
  const toggleLayer = useStore((s) => s.toggleLayer)
  const updateLayerSetting = useStore((s) => s.updateLayerSetting)
  const setFilter = useStore((s) => s.setFilter)
  const setTheme = useStore((s) => s.setTheme)
  const setPalette = useStore((s) => s.setPalette)
  const setData = useStore((s) => s.setData)
  const exportSettings = useStore((s) => s.exportSettings)
  const importSettings = useStore((s) => s.importSettings)

  // File upload
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileImportRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState('')

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const records = parseCSV(text)
        if (records.length > 0) setData(records)
      }
      reader.readAsText(file)
    },
    [setData]
  )

  const toggleSection = (id: SectionId) => {
    setExpandedSection(expandedSection === id ? id : id)
  }

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

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  if (collapsed) {
    return (
      <div className="absolute top-4 left-4 z-10">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setCollapsed(false)}
          className="bg-card/90 backdrop-blur-sm border border-border hover:bg-primary hover:text-primary-foreground"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="absolute top-0 left-0 bottom-0 z-10 w-72 bg-card/95 backdrop-blur-md border-r border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium text-foreground">컨트롤 패널</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(true)}
          className="h-7 w-7 hover:bg-muted"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* === LAYERS === */}
        <SectionHeader
          icon={<Layers className="h-4 w-4" />}
          title={`레이어 (${data.length.toLocaleString()}건)`}
          expanded={expandedSection === 'layers'}
          onClick={() => toggleSection('layers')}
        />
        {expandedSection === 'layers' && (
          <div className="px-3 pb-3 space-y-1">
            {(Object.keys(LAYER_LABELS) as (keyof LayerVisibility)[]).map((key) => (
              <div key={key}>
                <div className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <Switch
                      size="sm"
                      checked={layers[key]}
                      onCheckedChange={() => toggleLayer(key)}
                    />
                    <span className={`text-xs ${layers[key] ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {LAYER_LABELS[key].emoji} {LAYER_LABELS[key].name}
                    </span>
                  </div>
                  {layers[key] && (
                    <button
                      onClick={() => setExpandedLayer(expandedLayer === key ? null : key)}
                      className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                    >
                      {expandedLayer === key ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                  )}
                </div>
                {expandedLayer === key && layers[key] && (
                  <LayerSettingsPanel
                    layerKey={key}
                    settings={layerSettings[key]}
                    onChange={(k, v) => updateLayerSetting(key, k, v)}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <Separator />

        {/* === FILTERS === */}
        <SectionHeader
          icon={<SlidersHorizontal className="h-4 w-4" />}
          title="필터"
          expanded={expandedSection === 'filters'}
          onClick={() => toggleSection('filters')}
        />
        {expandedSection === 'filters' && (
          <div className="px-3 pb-3 space-y-4">
            <FilterSlider
              label="시간대"
              min={0}
              max={24}
              step={1}
              value={filters.timeRange}
              onChange={(v) => setFilter('timeRange', v as [number, number])}
              unit="시"
            />
            <FilterSlider
              label="소요"
              min={0}
              max={120}
              step={5}
              value={filters.durationRange}
              onChange={(v) => setFilter('durationRange', v as [number, number])}
              unit="분"
            />
            <FilterSlider
              label="거리"
              min={0}
              max={20}
              step={0.5}
              value={filters.distanceRange}
              onChange={(v) => setFilter('distanceRange', v as [number, number])}
              unit="km"
            />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">검색</label>
              <input
                type="text"
                placeholder="주문번호/지역"
                value={filters.regionQuery}
                onChange={(e) => setFilter('regionQuery', e.target.value)}
                className="w-full bg-input/50 border border-border rounded-md text-xs text-foreground px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
          </div>
        )}

        <Separator />

        {/* === SETTINGS === */}
        <SectionHeader
          icon={<Settings className="h-4 w-4" />}
          title="설정"
          expanded={expandedSection === 'settings'}
          onClick={() => toggleSection('settings')}
        />
        {expandedSection === 'settings' && (
          <div className="px-3 pb-3 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">지도 테마</label>
              <Select value={theme} onValueChange={(v) => setTheme(v as MapTheme)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">색상 팔레트</label>
              <Select value={palette} onValueChange={(v) => setPalette(v as ColorPalette)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PALETTE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      <span className="flex items-center gap-2">
                        {opt.label}
                        <span className="flex gap-0.5">
                          {COLOR_PALETTES[opt.value].slice(0, 5).map((c, i) => (
                            <span
                              key={i}
                              className="inline-block w-2 h-2 rounded-sm"
                              style={{ background: `rgb(${c[0]},${c[1]},${c[2]})` }}
                            />
                          ))}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">프리셋</label>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1 text-xs h-7" onClick={handleExport}>
                  Export
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={() => fileImportRef.current?.click()}>
                  Import
                </Button>
              </div>
              {importMsg && (
                <p className={`text-[10px] mt-1 ${importMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                  {importMsg}
                </p>
              )}
              <input ref={fileImportRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </div>
          </div>
        )}

        <Separator />

        {/* === FILE UPLOAD === */}
        <SectionHeader
          icon={<Upload className="h-4 w-4" />}
          title="파일 업로드"
          expanded={expandedSection === 'upload'}
          onClick={() => toggleSection('upload')}
        />
        {expandedSection === 'upload' && (
          <div className="px-3 pb-3">
            <div
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                const file = e.dataTransfer.files[0]
                if (file && file.name.endsWith('.csv')) handleFile(file)
              }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <Upload className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">CSV 파일을 드래그하거나 클릭</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFile(file)
                }}
                className="hidden"
              />
            </div>
          </div>
        )}

        <Separator />

        {/* === REALTIME === */}
        <SectionHeader
          icon={<Radio className="h-4 w-4" />}
          title="실시간"
          expanded={expandedSection === 'realtime'}
          onClick={() => toggleSection('realtime')}
        />
        {expandedSection === 'realtime' && (
          <RealtimePanel />
        )}
      </div>
    </div>
  )
}

// --- Sub-components ---

function SectionHeader({
  icon,
  title,
  expanded,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  expanded: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
    >
      {icon}
      <span className="flex-1 text-left">{title}</span>
      {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
    </button>
  )
}

function LayerSettingsPanel({
  layerKey,
  settings,
  onChange,
}: {
  layerKey: keyof LayerVisibility
  settings: LayerSettings
  onChange: (key: keyof LayerSettings, value: number) => void
}) {
  const radiusCfg = RADIUS_LABELS[layerKey]

  return (
    <div className="pl-8 pr-2 pb-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground w-10">투명도</span>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[Math.round(settings.opacity * 100)]}
          onValueChange={([v]) => onChange('opacity', v / 100)}
          className="flex-1"
        />
        <span className="text-[10px] text-muted-foreground w-7 text-right">
          {Math.round(settings.opacity * 100)}%
        </span>
      </div>
      {radiusCfg && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-10">{radiusCfg.label}</span>
          <Slider
            min={radiusCfg.min}
            max={radiusCfg.max}
            step={radiusCfg.step}
            value={[settings.radius]}
            onValueChange={([v]) => onChange('radius', v)}
            className="flex-1"
          />
          <span className="text-[10px] text-muted-foreground w-7 text-right">
            {settings.radius}
          </span>
        </div>
      )}
    </div>
  )
}

function FilterSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  unit,
}: {
  label: string
  min: number
  max: number
  step: number
  value: [number, number]
  onChange: (v: number[]) => void
  unit: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground">
          {value[0]}~{value[1]}{unit}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onValueChange={onChange}
      />
    </div>
  )
}


function RealtimePanel() {
  const [active, setActive] = useState(false)
  const [countdown, setCountdown] = useState(300)
  const [count, setCount] = useState(0)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const setData = useStore((s) => s.setData)

  const fetchData = useCallback(async () => {
    setStatus('loading')
    try {
      const resp = await fetch('/realtime.json?t=' + Date.now())
      if (!resp.ok) throw new Error('HTTP ' + resp.status)
      const data = await resp.json()
      setCount(data.count)
      setLastUpdate(new Date(data.updated_at).toLocaleTimeString('ko-KR'))
      setStatus('ok')
      // realtime 데이터를 store에 넣기 (DeliveryRecord 형식으로 변환)
      if (data.deliveries?.length > 0) {
        const records = data.deliveries.map((d: Record<string, unknown>) => ({
          ord_no: d.ord_no as string,
          shop_lat: d.shop_lat as number,
          shop_lon: d.shop_lon as number,
          dlvry_lat: d.dlvry_lat as number,
          dlvry_lon: d.dlvry_lon as number,
          pick_up_date: d.pickup_ts as string || '',
          hand_over_date: d.completed_ts as string || '',
        }))
        setData(records)
      }
    } catch {
      setStatus('error')
    }
  }, [setData])

  const start = useCallback(() => {
    setActive(true)
    setCountdown(0)
    fetchData()
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 0) {
          fetchData()
          return 300
        }
        return c - 1
      })
    }, 1000)
  }, [fetchData])

  const stop = useCallback(() => {
    setActive(false)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setStatus('idle')
  }, [])

  const mm = Math.floor(countdown / 60)
  const ss = countdown % 60
  const now = new Date()
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <div className="px-3 pb-3 space-y-3">
      {/* 시계 */}
      <div className="text-center">
        <div className="text-2xl font-bold text-foreground tabular-nums">{clock}</div>
        <div className="text-[10px] text-muted-foreground">현재 시각 <span className="text-muted-foreground/60 ml-1">~5분 지연</span></div>
      </div>

      {/* 상태 */}
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          status === 'ok' ? 'bg-green-500 animate-pulse' :
          status === 'loading' ? 'bg-yellow-500' :
          status === 'error' ? 'bg-red-500' :
          'bg-gray-400'
        }`} />
        <span className="text-xs text-muted-foreground">
          {status === 'ok' ? `${count.toLocaleString()}건` :
           status === 'loading' ? '로딩 중...' :
           status === 'error' ? '연결 실패' :
           '대기 중'}
        </span>
      </div>

      {/* 타이머 */}
      {active && (
        <div className="text-center">
          <div className="text-lg font-bold text-foreground tabular-nums">
            {mm}:{String(ss).padStart(2, '0')}
          </div>
          <div className="text-[10px] text-muted-foreground">다음 갱신까지</div>
        </div>
      )}

      {/* 마지막 업데이트 */}
      {lastUpdate && (
        <div className="text-[10px] text-muted-foreground text-center">
          마지막 갱신: {lastUpdate}
        </div>
      )}

      {/* 버튼 */}
      <div className="flex gap-2">
        {!active ? (
          <Button variant="default" size="sm" className="flex-1 text-xs h-7" onClick={start}>
            ▶ 시작
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" className="flex-1 text-xs h-7" onClick={stop}>
              ⏹ 중지
            </Button>
            <Button variant="secondary" size="sm" className="flex-1 text-xs h-7" onClick={() => { setCountdown(0); fetchData() }}>
              🔄 즉시
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
