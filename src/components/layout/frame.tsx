import { Header } from "./header";

export function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      <Header />
      <div className="flex-1 flex overflow-hidden">{children}</div>
    </div>
  );
}
