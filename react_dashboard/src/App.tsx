import { useState } from 'react'
import Map from './components/Map'
import Sidebar from './components/Sidebar'
import QueryBuilder from './components/QueryBuilder'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TooltipProvider } from '@/components/ui/tooltip'

function App() {
  const [showQuery, setShowQuery] = useState(false)

  return (
    <TooltipProvider>
      <div className="relative w-screen h-screen overflow-hidden bg-background">
        {/* Map fills entire viewport */}
        <Map />

        {/* Left sidebar */}
        <Sidebar />

        {/* Query Builder trigger */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowQuery(true)}
          className="absolute top-4 right-4 z-10 bg-card/90 backdrop-blur-sm border border-border hover:bg-primary hover:text-primary-foreground text-xs"
        >
          🔍 SQL
        </Button>

        {/* Query Builder Dialog */}
        <Dialog open={showQuery} onOpenChange={setShowQuery}>
          <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>🔍 쿼리 빌더</DialogTitle>
            </DialogHeader>
            <QueryBuilder onClose={() => setShowQuery(false)} />
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

export default App
