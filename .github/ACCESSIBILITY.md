# Accessibility

Vyana is a health app. People use it when they are unwell, older, in a hurry or in an emergency, so it has to work for everyone, including people who use a screen reader, larger text, a keyboard or switch control, or who have low vision, colour blindness or limited dexterity.

## Our target

- **Web app:** [WCAG 2.2](https://www.w3.org/TR/WCAG22/) Level AA.
- **Mobile app:** the same success criteria where they apply, plus the platform guidelines for [Android](https://developer.android.com/guide/topics/ui/accessibility) and [iOS](https://developer.apple.com/accessibility/), using React Native's [accessibility props](https://reactnative.dev/docs/accessibility).

## What every screen must do

| Area | Requirement |
|---|---|
| Screen readers | Every control has an accessible name and role (`aria-*` on web, `accessibilityLabel` / `accessibilityRole` on mobile). Icons that act as buttons have labels. Decorative images are hidden from assistive tech. |
| Keyboard (web) | Everything works with the keyboard alone, in a logical order, with a visible focus indicator. No keyboard traps; dialogs return focus when they close. |
| Text size | Layouts keep working with system font scaling up to 200%. Text is never baked into images. |
| Contrast | At least 4.5:1 for body text and 3:1 for large text, icons and input borders, in light and dark mode. |
| Colour | Colour is never the only signal. Lab values show "High" / "Low" as text, not only red or blue; a missed dose shows a label, not only a colour. |
| Touch targets | At least 44 × 44 pt on iOS and 48 × 48 dp on Android, with spacing between adjacent targets. |
| Motion | Respects the system "reduce motion" setting. Nothing flashes more than three times a second. |
| Forms | Every input has a visible label. Errors say what is wrong and how to fix it, next to the field, and are announced to screen readers. |
| Time limits | Nothing important expires while someone is reading or typing, except sign-in sessions, which can be renewed. |
| Language | Plain words, short sentences. The assistant and care plans can answer in English, Hindi or Hinglish. |
| Notifications | Medicine reminders say what to take in words, not only with a sound or vibration. |

### Emergency screen

The SOS screen gets the strictest treatment:
- the call button is the first focusable element and the largest target on the screen
- it is reachable in one tap or one keystroke from the home screen
- it works without reading any other text

## How we check

- Before a screen is merged: screen reader pass (TalkBack or VoiceOver on mobile, NVDA or VoiceOver on web), keyboard-only pass on web, largest system font size, and a contrast check.
- Automated checks (such as axe or Lighthouse on web) catch some issues, but they don't replace testing with assistive technology.

## Current status

Vyana is in active development and **has not yet had an independent accessibility audit**. Some screens may not meet every requirement above yet. Known gaps are tracked as issues with the `accessibility` label.

## Report a barrier

If something in Vyana is hard or impossible for you to use, please [open an issue](https://github.com/piyushgargog/vyana/issues/new?template=accessibility.yml). Tell us:
- which screen
- what you were trying to do
- what assistive technology, browser or device you use, if any

We treat accessibility barriers as bugs, and barriers on the emergency, medicine reminder and sign-in screens as top priority.
