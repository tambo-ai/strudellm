# StrudelLM

Make music with AI. Just describe what you want to hear.

Built by the [Tambo](https://tambo.co) team to show what's possible when you give an AI agent control of a live coding music engine using Strudel.

## Try it

Go to [StrudelLM.com](https://strudellm.com) live:

```
make the intro to Stranger Things
```

## What Can You Do?


## How It Works

You chat. The AI writes [Strudel](https://strudel.cc/) code. Music plays instantly.

```
┌─────────────────────────────────────────────────────────────────┐
│                        StrudelLM                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐    │
│   │   You       │───▶│  Tambo AI   │───▶│    Strudel      │    │
│   │             │    │   Agent     │    │  (makes sound)  │    │
│   └─────────────┘    └─────────────┘    └─────────────────┘    │
│         │                   │                    │              │
│         ▼                   ▼                    ▼              │
│   "Make a drum      Writes valid         Plays it              │
│    beat"            Strudel code         immediately           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Why We Built This

This is a [Tambo](https://tambo.co) demo. We wanted to show that AI agents aren't just for chatbots and dashboards—they can control creative tools too.

Under the hood, it uses Tambo's **tool system** to let the AI write and execute Strudel code in real-time. When the code has errors, Tambo automatically retries until it works.

```typescript
export const validateAndUpdateRepl: TamboTool = {
  name: "updateRepl",
  description: "Update the Strudel REPL with new pattern code...",
  tool: async (code: string) => {
    const result = await service.updateAndPlay(code);
    if (!result.success) {
      throw new Error(`Invalid pattern: ${result.error}`);
    }
    return "Pattern updated";
  },
};
```

## Get Started

```bash
npm install
npx tambo init    # adds your API key
npm run dev
```

Open [localhost:3000](http://localhost:3000) and start making music.

## Tambo integration

Key places we use Tambo in this repo:

- `src/app/chat/page.tsx`: wraps the app in `TamboProvider` and registers `contextHelpers`.
- `src/lib/tambo.ts`: registers Tambo components + tools.
- `src/strudel/tools/*`: local tools that Tambo can call (ex: `updateRepl`).

Relevant docs:

- Requires `NEXT_PUBLIC_TAMBO_API_KEY` (and optionally `NEXT_PUBLIC_TAMBO_URL`); see `example.env.local`.
- `NEXT_PUBLIC_TAMBO_URL` is only needed if you're pointing at a non-default Tambo environment (e.g. self-hosted); most setups can omit it.
  If `NEXT_PUBLIC_TAMBO_URL` is unset, `@tambo-ai/react` will use the default Tambo Cloud API (https://api.tambo.ai).

- https://docs.tambo.co/getting-started/integrate
- https://docs.tambo.co/llms.txt
- https://docs.tambo.co/concepts/components/
- https://docs.tambo.co/concepts/tools/adding-tools
- https://docs.tambo.co/concepts/additional-context/configuration

## Prompts to Try

- "Make the intro to Stranger Things"
- "Create a house beat with a 909 kick"
- "Build a lo-fi hip hop beat with jazzy chords"
- "Make an ambient soundscape with evolving pads"
- "Now make it faster and more intense"

## Learn More

- [Tambo Docs](https://docs.tambo.co) - Build your own AI agents
- [Strudel Docs](https://strudel.cc/learn) - Learn the pattern syntax

## Built With

- [Tambo](https://tambo.co) - AI agent framework
- [Strudel](https://strudel.cc/) - Live coding music environment
- [Jazz](https://jazz.tools/) - Sync and persistence
