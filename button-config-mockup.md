# Button Configuration Mockup

This is a low-risk layout sketch for the button configuration page before any structural refactor.

## Intent

Move the simulator-style button page to the center of the screen and make it the main editing surface.

Fields that stay visible on the page:

- Broker
- Long Press Repeat
- Delete Page
- Add Page

Everything else becomes an item-level popup when the user clicks a field on the simulator.

## Proposed Page Shape

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Button Configuration: Living Room Panel                         [Config #3]  │
│ Name: [ Living Room ]                                                        │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PAGE NAV:  < Prev   Page 1 of 4   Next >    [ + Add Page ]                  │
│  Simulate: [ On state ▼ ]                                                    │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐          │
│  │                              │  │                              │          │
│  │   simulator                  │  │                simulator     │          │
│  │   preview                    │  │                preview       │          │
│  │                              │  │                              │          │
│  └──────────────────────────────┘  └──────────────────────────────┘          │
|   Long repeat: [ X ]                Long repeat: [ X ]                       |
│   Broker:      [ Default ▼ ]        Broker:      [ Default ▼ ]               │
│                                                                              │
│  [ Delete Page ]                                                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Interaction Model

- Clicking a field inside the simulator opens a popup for that specific setting.
- The popup edits only one field group at a time.
- The simulator stays visible behind the popup so the user keeps context.
- The page selector and page navigation stay on the main page, not inside the popup.
- Add Page stays on the main page so a new page is a structural action, not a field edit.

## Popup Examples

### Example: Device / Capability popup

```text
┌──────────────────────────────────────────────┐
│ Edit Left Button Device                      │
├──────────────────────────────────────────────┤
│ Device:      [ Living Room Lamp ▼ ]          │
│ Capability:  [ onoff ▼ ]                     │
│ On text:     [ On ]                          │
│ Off text:    [ Off ]                         │
│ SVG on:      [ Edit SVG... ]                 │
│ SVG off:     [ Edit SVG... ]                 │
│                                              │
│ [ Cancel ]                          [ Save ] │
└──────────────────────────────────────────────┘
```

### Example: Text / Label popup

```text
┌──────────────────────────────────────────────┐
│ Edit Right Button Label                      │
├──────────────────────────────────────────────┤
│ Top label:   [ Scene ]                       │
│                                              │
│ [ Cancel ]                          [ Save ] │
└──────────────────────────────────────────────┘
```

### Example: Styling popup

```text
┌──────────────────────────────────────────────┐
│ Edit LEDs                                    │
├──────────────────────────────────────────────┤
│ Front LED on color:  [ #00ff88 ]           │
│ Front LED off color: [ #334455 ]           │
│ Wall LED on color:   [ #00ff88 ]           │
│ Wall LED off color:  [ #334455 ]           │
│                                              │
│ [ Cancel ]                          [ Save ] │
└──────────────────────────────────────────────┘
```

## Why This Helps

- The simulator becomes the thing the user edits, instead of a passive preview.
- The page is less vertically dense because most fields move into popups.
- Related controls stay grouped around the button they affect.
- The user can still see the page structure, page number, broker, and repeat behavior without drilling into a popup.

## Suggested Next Step

If this shape looks right, the next implementation pass can be:

1. Reuse the existing simulator rendering for the button page canvas.
2. Replace inline field blocks with clickable field chips.
3. Add a single generic popup component for the field groups.
4. Keep Add Page, Delete Page, Broker, and Long Press Repeat on the main page.