# StrudelLM

Make music with AI. Just describe what you want to hear.

Built by the [Tambo](https://tambo.co) team to show what's possible when you give an AI agent control of a live coding music engine.

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
