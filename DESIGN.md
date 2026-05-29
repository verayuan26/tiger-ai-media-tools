# AI Media Tools — Design System

**Reference:** [Spotify on getdesign.md](https://getdesign.md/spotify) — dark immersive shell, content-first grids, single vibrant accent on near-black surfaces.

**Product context:** Local-first AI media library for factory/creative teams browsing images, video, and audio. UI should feel like a professional media catalog, not a generic admin panel.

## Principles

1. **Content first** — Thumbnails and previews dominate; chrome stays quiet.
2. **Dark default** — Long browsing sessions; reduce glare; let media pop.
3. **One accent** — Spotify green (`#1DB954`) for primary actions and active nav; amber for queue badges only.
4. **Tokens only** — No hardcoded hex in components; use CSS variables from `src/client/styles/theme.css`.
5. **Consistent shell** — Sidebar + page header + scrollable main; same spacing rhythm (`px-6`, `py-4` headers, `p-4` grids).

## Color tokens (dark)

| Role | Token | Notes |
|------|--------|--------|
| App background | `--background` | `#121212` |
| Elevated surface | `--card` | `#181818` |
| Sidebar | `--sidebar` | `#000000` |
| Primary / CTA | `--primary` | `#1DB954` |
| Muted text | `--muted-foreground` | `#b3b3b3` |
| Border | `--border` | `rgba(255,255,255,0.1)` |

## Typography

- **App title:** `text-xl font-semibold tracking-tight`
- **Page title:** `text-2xl font-semibold` via `PageHeader`
- **Body:** `text-sm` / `text-base`; prefer `text-muted-foreground` for secondary copy
- **Mono paths:** `font-mono text-sm` for file paths only

## Layout

```
┌─────────────┬──────────────────────────────────┐
│  Sidebar    │  PageHeader (title + actions)    │
│  256px      ├──────────────────────────────────┤
│             │  Filters / toolbar (optional)    │
│             ├──────────────────────────────────┤
│             │  Main content (grid / tables)    │
└─────────────┴──────────────────────────────────┘
```

- Sidebar: `bg-sidebar`, active item `bg-sidebar-primary text-sidebar-primary-foreground`
- Main: `bg-background`, never `bg-white` in dark mode
- Cards in grid: `border-border`, hover `shadow-lg` + subtle scale on thumbnail

## Components

- **Primary button:** `bg-primary text-primary-foreground hover:bg-primary/90` — replace all `bg-[#4a6fa5]`
- **PageHeader:** `border-b border-border bg-card`
- **Asset grid:** `bg-background` or subtle `bg-muted/30`; cards use `bg-card`
- **Dialogs:** shadcn `Dialog` with default theme tokens

## Out of scope (this pass)

- Light mode toggle
- Custom font licensing (system UI stack)
- Marketing landing pages

## Implementation checklist

- [x] `theme.css` dark-first tokens
- [x] `html.dark` default in `index.html`
- [x] `RootLayout` + `PageHeader` on tokens
- [x] All pages: remove `bg-white`, `text-gray-*`, `#4a6fa5` (EGO-60)
