export function Main({ children }: { children: React.ReactNode }) {
  return (
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {children}
      </div>
  );
}