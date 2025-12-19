import * as React from "react";
import { cn } from "@/lib/utils";

const DEFAULT_SIDEBAR_WIDTH = 480;
const MIN_SIDEBAR_WIDTH = 280;
const MAX_SIDEBAR_WIDTH = 600;

const SidebarContext = React.createContext<{
  sidebarWidth: number;
  setSidebarWidth: React.Dispatch<React.SetStateAction<number>>;
  isResizing: boolean;
  setIsResizing: React.Dispatch<React.SetStateAction<boolean>>;
  handleResizeStart: (e: React.MouseEvent) => void;
} | null>(null);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

export function Sidebar({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = React.useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = React.useState(false);
  
  // Handle sidebar resize
  const handleResizeStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const value = React.useMemo(() => ({
    sidebarWidth,
    setSidebarWidth,
    isResizing,
    setIsResizing,
    handleResizeStart
  }), [
    sidebarWidth,
    setSidebarWidth,
    isResizing,
    setIsResizing,
    handleResizeStart
  ]);

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  )
}

function ResizeHandle() {
  const { isResizing, handleResizeStart } = useSidebar();

  return (
    <div
      onMouseDown={handleResizeStart}
      className={cn(
        "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10",
        "hover:bg-primary/50 transition-colors",
        isResizing && "bg-primary/50"
      )}
    />
  )
}

export function SidebarContent({ children }: { children: React.ReactNode }) {
  const { sidebarWidth, isResizing } = useSidebar();

  return (
    <div
      className={cn(
        "h-full border-l border-border flex flex-col relative bg-background",
        {
          "transition-all duration-300": !isResizing,
          "cursor-col-resize select-none": isResizing
        },
      )}
      style={{ width: sidebarWidth }}
    >
      <ResizeHandle />
      {children}
    </div>
  )
}