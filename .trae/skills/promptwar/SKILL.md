---
name: "promptwar"
description: "Builds a polished, fast, modern web app for the PromptWars x GDGoC MM(DU) hackathon using Vite + Bun + React + Tailwind + shadcn + Framer Motion + Lucide. Invoke when the user drops the comp problem statement and says 'start the build' or 'use promptwar skill'."
---

# PromptWar Comp Skill

A pre-baked recipe for shipping a winning PromptWars submission fast using vibe coding.

## When to Invoke

Trigger this skill when the user says any of:
- "use promptwar skill"
- "start the build"
- "comp day, here's the problem statement: ..."
- "build this for promptwar"

## Prerequisites (assume already met)

- Antigravity is installed and open
- A public GitHub repo is created and cloned inside Antigravity
- Working directory is the cloned repo
- User will do the final `git push` themselves (do NOT push automatically)

## Step 1 — Read the Problem Statement

- Carefully read the full statement the user provides.
- Identify: target user, core feature(s), required inputs/outputs, any tech constraints.

## Step 2 — Ask 2-3 Clarifying Questions (MAX)

Use AskUserQuestion. Don't over-ask. Cover:
1. **Must-have feature** vs nice-to-have (so we don't overbuild)
2. **Visual style** preference (dark/light, reference site to mimic like Linear/Vercel/Stripe/Notion)
3. **3D needed?** (yes/no — only ask if problem could go either way)

If the problem statement is crystal clear, skip questions and propose a quick plan instead.

## Step 3 — Scaffold the Project

Run these commands in order:

```bash
bun create vite@latest . --template react
bun install
bun add tailwindcss @tailwindcss/vite
bun add framer-motion lucide-react
bun add -d @types/node
```

Then:
- Configure Tailwind via the Vite plugin in `vite.config.js`
- Set up `src/index.css` with Tailwind imports + a default dark-friendly theme
- Create a proper `.gitignore` (Vite's default is fine, just confirm node_modules is excluded)
- Set up `src/App.jsx` with a clean router-less layout (single page unless problem needs routing)

For shadcn/ui: since it's copy-paste, **don't run the CLI during scaffolding** (slows setup). Instead, when specific components are needed (Button, Card, Dialog, Input, etc.), paste the snippets inline from `ui.shadcn.com` and adapt them.

## Step 4 — Build Feature by Feature

For each feature:
1. Write the component in a separate file under `src/components/`
2. Use shadcn-style components for UI primitives
3. Add Lucide icons (import named: `import { ArrowRight } from "lucide-react"`)
4. Add Framer Motion for entrance/hover/scroll animations (wrap with `motion.div`, use `whileInView` for scroll)
5. Use Tailwind for all styling — no separate CSS files unless absolutely needed

**Style defaults to apply unless user says otherwise:**
- Dark theme with one accent color (suggest: emerald, violet, or blue)
- Inter or Geist font via Google Fonts
- Generous padding/whitespace
- Glassmorphism on hero cards (`backdrop-blur` + `bg-white/5`)
- Subtle gradient backgrounds on hero sections
- Mobile-first responsive

## Step 5 — Add 3D (only if user said yes in Step 2)

```bash
bun add three @react-three/fiber @react-three/drei
```

- Put the 3D scene in a separate component, lazy-loaded with `React.lazy` + `<Suspense fallback={...}>`
- Only render it in the hero section
- Keep geometry low-poly, use `Float` or `OrbitControls` from drei
- For quick wins: use a pre-made Spline scene embed instead of coding from scratch

## Step 6 — Speed Pass

Before declaring done, verify:
- All heavy components are lazy-loaded (`React.lazy`)
- Images use external URLs, not bundled files
- No `console.log` left in code
- No unused imports
- No `node_modules` or large binaries in repo
- First paint is under 2 seconds (test by running `bun run dev` and checking)

Check repo size:
```bash
git ls-files | xargs du -ch
```
Must be under 10 MB.

## Step 7 — Polish Pass

- Add a sticky navbar with blur backdrop
- Add smooth scroll between sections
- Add hover states on all interactive elements
- Add a footer (small but judges notice)
- Check on mobile breakpoint (Chrome DevTools device mode)

## Step 8 — Push Checklist for the User

Tell the user:
```
Ready to push. Quick checklist:
1. git add .
2. git status (verify no node_modules, no .env)
3. git commit -m "feat: <short description>"
4. git push origin main (only one branch)
5. Verify repo size on GitHub is under 10 MB
6. Copy the public repo link for submission
```

**NEVER run `git push` automatically. The user pushes.**

## Hard Rules (NEVER violate)

- Repo must stay under 10 MB
- Only one branch (main)
- Repo must be public
- Never push automatically — user does it
- Never commit node_modules, .env, large binaries
- Never submit anything to the competition form

## What Can Flex Based on the Problem

- Add `react-router-dom` if multi-page needed
- Add `zustand` only if state gets complex (default: useState + Context)
- Add `@supabase/supabase-js` if problem needs auth or database
- Add `recharts` for data visualization
- Add `react-hook-form` + `zod` for complex forms
- Add LLM API call if problem allows (Groq is free and fast)
- Skip 3D entirely if problem is logic/utility focused

## What Stays Fixed (Winning Defaults)

- Bun + Vite + React + Tailwind base
- shadcn-style components (pasted, not CLI-installed during scaffold)
- Framer Motion + Lucide React
- Speed rules (lazy load, CDN, code split)
- Dark-friendly modern UI
- Mobile responsive
- User pushes, not the skill