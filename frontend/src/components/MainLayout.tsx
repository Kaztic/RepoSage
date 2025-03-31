import { useState, useEffect, useRef, ReactNode } from 'react';

type ResizableSection = 'sidebar' | 'fileviewer';

type MainLayoutProps = {
  sidebarContent: ReactNode;
  mainContent: ReactNode;
  rightPanelContent?: ReactNode;
  initialSidebarWidth?: string;
  initialRightPanelWidth?: string;
};

export default function MainLayout({
  sidebarContent,
  mainContent,
  rightPanelContent,
  initialSidebarWidth = '25%',
  initialRightPanelWidth = '40%'
}: MainLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth);
  const [rightPanelWidth, setRightPanelWidth] = useState(initialRightPanelWidth);
  
  const resizingRef = useRef<{ 
    active: boolean; 
    type: ResizableSection; 
    startX: number; 
    startWidth: string 
  }>({
    active: false,
    type: 'sidebar',
    startX: 0,
    startWidth: ''
  });

  // Resize handlers
  const startResize = (e: React.MouseEvent, type: ResizableSection) => {
    e.preventDefault();
    const startWidth = type === 'sidebar' ? sidebarWidth : rightPanelWidth;
    
    resizingRef.current = {
      active: true,
      type,
      startX: e.clientX,
      startWidth
    };
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
  };
  
  const handleResize = (e: MouseEvent) => {
    if (!resizingRef.current.active) return;
    
    const { type, startX, startWidth } = resizingRef.current;
    const delta = e.clientX - startX;
    
    // Convert percentage to pixels, then back to percentage after adjustment
    const parentWidth = document.documentElement.clientWidth;
    const startWidthPx = (parseFloat(startWidth) / 100) * parentWidth;
    
    if (type === 'sidebar') {
      const newWidth = ((startWidthPx + delta) / parentWidth) * 100;
      // Limit sidebar width between 15% and 50%
      const clampedWidth = Math.max(15, Math.min(50, newWidth));
      setSidebarWidth(`${clampedWidth}%`);
    } else {
      const newWidth = ((startWidthPx - delta) / parentWidth) * 100;
      // Limit right panel width between 20% and 60%
      const clampedWidth = Math.max(20, Math.min(60, newWidth));
      setRightPanelWidth(`${clampedWidth}%`);
    }
  };
  
  const stopResize = () => {
    resizingRef.current.active = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  };
  
  // Cleanup resize listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', stopResize);
    };
  }, []);

  return (
    <div className="flex flex-1 h-full max-h-full overflow-hidden">
      {/* Sidebar */}
      <div 
        className="overflow-y-auto overflow-x-hidden border-r border-gray-700 bg-gray-800 flex flex-col"
        style={{ width: sidebarWidth, maxHeight: '100%' }}
      >
        {sidebarContent}
      </div>

      {/* Resize handle for sidebar */}
      <div 
        className="w-1 hover:w-2 bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors"
        onMouseDown={(e) => startResize(e, 'sidebar')}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col max-h-full overflow-hidden">
        {mainContent}
      </div>

      {/* Right panel (conditional render) */}
      {rightPanelContent && (
        <>
          {/* Resize handle for right panel */}
          <div 
            className="w-1 hover:w-2 bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors"
            onMouseDown={(e) => startResize(e, 'fileviewer')}
          />

          {/* Right panel content */}
          <div 
            className="overflow-hidden bg-gray-800 flex flex-col max-h-full"
            style={{ width: rightPanelWidth }}
          >
            {rightPanelContent}
          </div>
        </>
      )}
    </div>
  );
} 