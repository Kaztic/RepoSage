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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
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

  // Store previous width to restore when uncollapsing
  const prevSidebarWidthRef = useRef(sidebarWidth);

  // Toggle sidebar collapsed state
  const toggleSidebar = () => {
    if (!isSidebarCollapsed) {
      prevSidebarWidthRef.current = sidebarWidth;
      setSidebarWidth('0%');
    } else {
      setSidebarWidth(prevSidebarWidthRef.current);
    }
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

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
      setIsSidebarCollapsed(false);
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
        className={`overflow-y-auto overflow-x-hidden border-r border-surface-700 bg-surface-800 flex flex-col transition-all duration-300 ease-in-out`}
        style={{ width: sidebarWidth, maxHeight: '100%' }}
      >
        {sidebarContent}
      </div>

      {/* Resize handle for sidebar with collapse toggle */}
      <div className="flex flex-col items-center">
        <div 
          className="w-1.5 hover:w-2.5 bg-surface-700 hover:bg-primary-500 cursor-col-resize h-full flex items-center transition-all duration-200 relative"
          onMouseDown={(e) => startResize(e, 'sidebar')}
        >
          <button 
            onClick={toggleSidebar}
            className="absolute bg-surface-700 hover:bg-primary-600 text-white p-1 rounded-full w-5 h-5 flex items-center justify-center -right-2 top-1/2 transform -translate-y-1/2 transition-colors duration-200"
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              {isSidebarCollapsed ? (
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col max-h-full overflow-hidden bg-surface-900">
        {mainContent}
      </div>

      {/* Right panel (conditional render) */}
      {rightPanelContent && (
        <>
          {/* Resize handle for right panel */}
          <div 
            className="w-1.5 hover:w-2.5 bg-surface-700 hover:bg-primary-500 cursor-col-resize transition-all duration-200"
            onMouseDown={(e) => startResize(e, 'fileviewer')}
          />

          {/* Right panel content */}
          <div 
            className="overflow-hidden bg-surface-800 flex flex-col max-h-full shadow-elevated transition-all duration-300 ease-in-out"
            style={{ width: rightPanelWidth }}
          >
            {rightPanelContent}
          </div>
        </>
      )}
    </div>
  );
} 