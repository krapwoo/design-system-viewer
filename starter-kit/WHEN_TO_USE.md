# When to use X vs Y

Disambiguation for components whose names or looks overlap, so a new screen reaches for the right
one on the first try instead of the closest-looking one. Each entry names the deciding question —
answer it and the choice falls out. For the full prop/variant/state list per component, read
`native/catalog/manifest.ts`'s `buildComponentManifest()` output (rendered live at the catalog's
"Manifest" page) rather than guessing from a component's name alone.

## InputField vs SearchField vs Dropdown

All three render on the same field chrome (`FieldContainer`) and can look identical at rest. The
deciding question: **what happens when the user taps in?**

- **InputField** — a labeled field with a *floating label* (the label shrinks to a caption once
  active/filled). Use for a named piece of data with a fixed identity across the interaction — "To",
  "From", "Arrive by", a person's name. Supports a live `editable` TextInput mode *or* a tappable
  picker mode (`active` forced from outside, e.g. by a Dropdown/BottomSheet you're driving).
- **SearchField** — a single-purpose live text input with a permanent leading search icon and no
  floating label (there's nothing to float to — "search" *is* the label, implied by the icon). Use
  for free-text filtering/searching, never for a named field with a fixed value.
- **Dropdown** — not a text input at all. A label-above-value trigger that opens a `BottomSheet`
  picker with a fixed option list. Use when the answer is one of a small, known set of choices
  (a direction, a filter value) — never for free text.

Rule of thumb: known short list → **Dropdown**. Free-text filter/search → **SearchField**. Anything
else the user types or picks, with its own persistent label → **InputField**.

## Button vs Pill

Both are tappable, labeled, and can carry an icon.

- **Button** — an *action*. Something happens when you tap it (save, confirm, navigate, submit).
  Five weights (`primary`/`secondary`/`tertiary`/`white`/`ghost`) express visual priority among
  multiple actions on the same screen.
- **Pill** — a *selection toggle*, not an action. Tapping it flips a `selected`/`not_selected`
  state that persists (a filter chip, a saved-place shortcut). If tapping it doesn't leave something
  visibly "on," it should be a Button, not a Pill.

## Toast vs Banner

Both show a status message with an icon and optional action, and both support the same five
semantic variants.

- **Toast** — *transient* and *self-contained*. Appears on top of the current screen, unrelated to
  the content beneath it, and is expected to go away on its own or via its own action ("Undo",
  "Retry"). Owns no layout space — it floats.
- **Banner** — *persistent* and *in-flow*. Lives inside the screen's own layout (top of a list,
  inside a card stack) for as long as the condition it describes is true ("Fare increase", "Line
  suspended"). Never auto-dismisses; the condition or an explicit user action clears it.

If the message is about something happening *right now, because of something the user just did* →
Toast. If it's a standing fact about the current screen's data → Banner.

## Badge vs Pill vs a Toast/Banner variant

All three can render the same five semantic colors, which makes them easy to reach for
interchangeably. They aren't interchangeable:

- **Badge** — *read-only status label*. Not tappable. Use inline next to other content ("On time"
  next to a train row, "Suspended" next to a line name).
- **Pill** — *tappable selection*. Use it when the same-looking chip needs to respond to a tap and
  hold a selected state.
- **Toast/Banner variant** — the color describes a *message about the whole screen or a transient
  event*, not a single inline data point. If you're tagging one row's status, that's a Badge; if
  you're telling the user something happened, that's a Toast or Banner.

## Dialog vs BottomSheet

Both are overlay containers with a backdrop.

- **Dialog** — center-screen, fades and scales in. Use for a short, focused decision that
  interrupts the flow (confirm/cancel, a single form). Named `Dialog` (not `Modal`) specifically to
  avoid shadowing React Native's own built-in `Modal`.
- **BottomSheet** — bottom-anchored, slides up, height driven by content up to 90% of the screen.
  Use for anything longer, browsable, or that benefits from a `TopNav`/`Dock` header-footer
  structure (an option picker, a detail view, a multi-field form). If the content would need its
  own internal scrolling, it's a BottomSheet, not a Dialog.

## Card vs ListItem (inside a List)

Both hold a leading element, a title, and secondary text.

- **ListItem** (inside **List**) — a *row in a set of peers* — settings, a menu, search results.
  Rows are visually light (no individual shadow/border) because the *List* container supplies the
  shared surface and the dividers between them.
- **Card** — a *standalone, self-contained unit* with its own shadow and rounded surface. Use when
  the content doesn't belong to a homogeneous list — a single trip summary, a promo, one dashboard
  tile sitting alongside other, differently-shaped content.

If you're about to render more than one of the same shape in a vertical stack with dividers between
them, that's `List`/`ListItem`, not a stack of `Card`s.

## SegmentedToggle vs UnderlineTabs

Same `options`/`value`/`onChange` API, same job (switch between a small set of views) — the
difference is purely visual weight.

- **SegmentedToggle** — a filled, recessed track with a sliding white thumb. Heavier visual weight;
  use when the choice is a primary, prominent control on the screen (e.g. Map/List view).
  - **UnderlineTabs** — left-aligned labels over a hairline rule with a sliding underline. Quieter;
  use for secondary navigation within a screen that already has a clear primary focus.

## Checkbox vs Switch vs Radio

All three are binary-ish controls; the difference is what the value means and how many can be true
at once.

- **Checkbox** — an independent on/off fact about *this one item* ("Remember this trip"). Any number
  of checkboxes on a screen can be checked at once, independently.
- **Switch** — an on/off *setting* that takes effect immediately (no separate "Save" step). Reach
  for Switch specifically when toggling it *does something right away*; reach for Checkbox when it's
  just recording a fact that a future action (a form submit) will act on.
- **Radio** — one selection from a *mutually exclusive* set (only one can be selected across a group
  of Radios sharing one consumer-held value). If checking one should un-check another, it's Radio,
  never Checkbox.

## EmptyState vs Banner

- **EmptyState** — fills the *entire* content area of a screen or section because there is
  *nothing else to show* (no results, no saved items, first run). Centered, icon-led, optionally one
  action.
- **Banner** — sits *alongside* other real content, describing a condition about that content or the
  screen in general. If the screen would otherwise be blank, use EmptyState; if it has content and
  you're adding a note above/around it, use Banner.
