# Web design system (Liquid Glass)

The look: Apple iOS 26 Liquid Glass, light mode. Glass only on chrome (nav, tab bar, floating buttons, sheets); content on white cards on iOS grey; teal only for the primary action, selection and charts; red only for SOS.

**Rules for screens**
- Import from `@/components/ui` and use the tokens below.
- No hex, `teal-*` or `slate-*` classes in screen files.
- One primary button per screen.
- A visible label on every input; `aria-label` on icon-only buttons.
- Plain patient words: no internal names, no "compliant", "safe" or "guaranteed".

## Tokens (Tailwind utilities from `app/globals.css`)

| Use | Class |
|---|---|
| Page background | `bg-canvas` |
| Card | `bg-surface` |
| Text | `text-label` |
| Secondary text | `text-label-2` (body), `text-label-3` (captions) |
| Divider | `border-separator` |
| Track, segmented background | `bg-fill`, `bg-fill-strong` |
| Accent | `bg-accent`, `text-accent`, `text-accent-strong` (text on white), `bg-accent-soft` |
| Status | `text-ok` / `bg-ok-soft`, `text-warn` / `bg-warn-soft`, `text-danger-text` / `bg-danger-soft` |
| Radius | `rounded-row` (12), `rounded-tile` (16), `rounded-card` (22), `rounded-feature` (28), `rounded-full` |
| Glass | `glass` (floating chrome), `glass-bar` (sticky header over the page) |
| Shadow | `shadow-float`, `shadow-accent` |

Type: the system font (SF on Apple devices). Large page title `text-[32px] sm:text-[40px] font-bold tracking-[-0.03em]` (use `LargeTitle`); section titles `text-xl font-semibold`; body `text-[17px]`; captions `text-[13px]`.

## Components

| Component | Use |
|---|---|
| `Button`, `ButtonLink`, `IconButton` | Pill buttons. `variant`: `primary` (one per screen), `secondary`, `plain`, `destructive`, `glass`; `size`: `sm`/`md`/`lg`. `IconButton` needs `label`. |
| `Card`, `CardHeader` | White card; title row with a trailing value. |
| `ListGroup`, `ListRow`, `IconTile` | Settings-style grouped list. A row with `href`/`onClick` gets a chevron. `icon` + `iconColor` (`accent`, `blue`, `green`, `orange`, `red`, `gray`, `indigo`). |
| `Field`, `SelectField`, `TextAreaField` | Labelled inputs with `hint` and `error`. |
| `Pill` | Status: `tone` `neutral`/`accent`/`ok`/`warn`/`danger`. The text carries the meaning, not the colour. |
| `LargeTitle` | Page header: `eyebrow`, `title`, `subtitle`, `actions`. |
| `SegmentedNav` | Section switcher (the app shell uses it). |
| `Sheet` | Bottom sheet / dialog for actions and forms. |
| `EmptyState` | Icon, title, one line, one action. |
| `Reveal` | Spring fade-in for lists and cards (off with reduced motion). |
| `SkeletonLine` | Loading bar (the older `SkeletonCard` still works). |

Icons: `lucide-react` (`import { Pill as PillIcon } from "lucide-react"`), 16–24 px, `aria-hidden="true"` next to text. Never emoji.

## Example

```tsx
import { Card, CardHeader, ListGroup, ListRow, LargeTitle, Pill, ButtonLink } from "@/components/ui";
import { CalendarDays, FileText } from "lucide-react";

<LargeTitle eyebrow="Wednesday, 14 October" title="Good evening" />
<Card>
  <CardHeader title="Doses today" trailing="2 of 3 taken" />
  …
</Card>
<ListGroup header="Your health">
  <ListRow icon={<FileText />} iconColor="orange" title="HbA1c" value={<Pill tone="warn">Above range</Pill>} href="/dashboard#reports" />
  <ListRow icon={<CalendarDays />} iconColor="blue" title="Hospital token" value="Book" href="/dashboard#visits" />
</ListGroup>
<ButtonLink href="/dashboard#scan">Scan a prescription</ButtonLink>
```
