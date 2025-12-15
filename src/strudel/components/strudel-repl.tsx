import * as React from 'react';
import { useStrudel } from '../context/strudel-provider';

export function StrudelRepl() {
  const ref = React.useRef<HTMLDivElement>(null);

  const { setRoot } = useStrudel();

  React.useEffect(() => {
    if (ref.current) {
      setRoot(ref.current);
    }
  }, [ref, setRoot]);

  return <div ref={ref} className="h-full w-full flex flex-col justify-stretch items-stretch bg-background text-foreground *:h-full" />;
}
