# Mobile design system (Liquid Glass)

The look: Apple iOS 26 Liquid Glass, light mode. Native glass (`expo-glass-effect`) only on chrome (tab bar, floating buttons, sheets); content on white cards on iOS grey; teal only for the primary action, selection and charts; red only for SOS.

**Rules for screens**
- Import from `@/components/ui` and use `T` from `@/constants/theme`.
- No hex colours in screen files.
- One primary `Button` per screen.
- `accessibilityLabel` on icon-only controls.
- Plain patient words.

## Tokens: `T` in `src/constants/theme.ts`

| | |
|---|---|
| Colours | `T.color.canvas` (screen), `surface` (card), `label`, `label2`, `label3`, `separator`, `fill`, `accent`, `accentStrong` (text), `accentSoft`, `danger`, `dangerText`, `dangerSoft`, `ok`, `okSoft`, `warn`, `warnSoft`, `tile.*` (icon tiles) |
| Radius | `T.radius.row` 12, `tile` 16, `card` 22, `feature` 28, `pill` 999 (use `borderCurve: 'continuous'`) |
| Space | `T.space.xs` 4 · `sm` 8 · `md` 12 · `lg` 16 · `xl` 24 · `xxl` 32 |
| Type | `T.text.largeTitle`, `title1`–`title3`, `headline`, `body`, `callout`, `subhead`, `footnote`, `caption`, `sectionHeader` (or the `Text` component) |
| Shadow | `T.shadow.float`, `T.shadow.accent` |

## Components

| Component | Use |
|---|---|
| `Screen` | A screen with an iOS large title (`title`, `eyebrow`, `trailing`), scrolling content, pull to refresh (`onRefresh`), room for the tab bar. |
| `Text` | `variant` (type scale) and `tone` (`label`, `secondary`, `tertiary`, `accent`, `danger`, `ok`, `warn`, `white`). |
| `Button` | Pill with a spring press and a light haptic. `variant`: `primary`, `secondary`, `plain`, `destructive`; `size`, `icon`, `loading`. |
| `Card`, `CardHeader` | White card and its title row. |
| `ListGroup`, `ListRow`, `IconTile` | Settings-style grouped list. A row with `onPress` gets a chevron and a selection haptic. |
| `Pill` | Status: `tone` `neutral` / `accent` / `ok` / `warn` / `danger`. |
| `Symbol` | SF Symbol on iOS + Material Symbol on Android: `<Symbol ios="pills.fill" android="medication" />`. |
| `Glass` | Native Liquid Glass (iOS 26) with a translucent fallback, for floating chrome only. |
| `Sheet` | Native iOS page sheet / Android slide-up panel for actions and short forms. |
| `EmptyState` | Icon, title, one line, one action. |

## Example

```tsx
import { Screen, Card, CardHeader, ListGroup, ListRow, IconTile, Pill, Button } from '@/components/ui';

<Screen eyebrow="Wednesday, 14 October" title="Today">
  <Card>
    <CardHeader title="Doses" trailing="2 of 3 taken" />
    <Button title="Take" onPress={take} />
  </Card>
  <ListGroup header="Your health">
    <ListRow icon={<IconTile ios="chart.line.uptrend.xyaxis" android="monitoring" color="orange" />} title="HbA1c" trailing={<Pill text="Above range" tone="warn" />} onPress={openReports} />
  </ListGroup>
</Screen>
```
