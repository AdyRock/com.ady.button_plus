# Button +

Turn your Homey setup into a smarter, cleaner control center for the things you use every day.

Button + makes it easy to build custom physical control panels that feel like a premium smart-home dashboard instead of a jumble of toggles and pages. With a Button + panel, you can put the controls you actually use in one place, show live status at a glance, and make your home feel more polished and intuitive.

## Why Button + is worth it

- One-touch control for your most important devices and scenes
- Quick visual feedback with custom labels, status text and live display values
- A cleaner wall-mounted smart-home experience without digging through menus
- Flexible layouts for buttons, displays and grouped panels
- Faster daily use for routines like lighting, climate, security and media
- A modern, customisable look that blends into your home and hardware setup

## Quick setup

1. Install the app on your Homey.
2. Open the Button + App settings / Configuration page in Homey.

The configuration page waits for both the saved button configurations and the Homey device list before building the button controls. Configuration tabs show a loading indicator while waiting for their saved settings, devices and brokers, which can take longer on slower Homeys. Device and broker responses can arrive in either order without interrupting initialization. Request errors are shown in a Homey alert and replace the loading indicator with an error message.

Select **Show me how** beside the book-shaped help button on any settings tab to start a guided tour. An animated pointer highlights each control while a popup explains it. Steps advance automatically after reading time; use **Back**, **Next**, **Pause / Resume**, or **Close** to control the tour, or press **Escape** to exit. Tours only explain visible controls and never change, save, import, or send settings. Close the tour to use the controls. Switching pages ends the tour. Reduced-motion users start with automatic progression paused and a non-animated pointer; switching away from the app also pauses progression.

The button tour starts with the page controls and configuration selector, then highlights the simulated button's title, value or icon, LEDs, STD / ADV mode switch, BUTTON action mappings, and setup wizard separately before explaining extra settings, copying, and saving. In STD mode, a demonstration BUTTON pill appears only during its tour step and is removed when leaving that step or closing the tour, without changing the button's mode or settings. The pill remains visible through simulator live refreshes, including while the tour is paused.

There are three main configuration areas in the app:

- Button bar configurations
- Display configurations
- Group configurations

Each configuration area has a set of slots for building your panel layouts. The button bar configurations are used for the control buttons, the display configurations are used for the panel display, and the group configurations let you combine them into a complete Button + panel setup.

## Setting up button bar configurations

1. Select Button bar Configurations from the first drop list.
2. Select a configuration number to edit. This number can later be assigned to a Button+ panel.
3. Under Left button bar are the options for the button on the left side of the Button+ button bar.
4. Select a Homey device that you want to control from the drop list. The panels support boolean capabilities, although filtering is still being improved.
5. Select a capability from the drop list.
6. Enter a Top Label (optional). This is displayed in green on the button display.
7. Enter a Label. This is shown in white and larger on the button display, just below the Top Text.
8. Repeat the steps for the Right button bar.
9. Click on the Save Configurations button.

For boolean capabilities, click the button's value area to choose Text or SVG and edit the On/Off values. These controls also remain available for imported configurations whose devices are missing from the current Homey. Dim levels and other known non-boolean capabilities use their own value display instead.

### Advanced steps and LEDs

Signed step values such as `+1` and `-1` keep their configured direction, including at capability limits. A button only uses stored direction and automatically reverses at a limit when it has an explicit direction action, such as **Toggle direction**. Direction controls affect that button, not other buttons controlling the same device.

The wizard preserves your LED colours, including black (`#000000`) to keep LEDs dark. The thermostat preset follows the device's `onoff` capability when available, rather than using the temperature as LED brightness. You can select a different LED source in the LED settings. Set both On and Off colours to black for each LED you want disabled. Removing an LED source clears its previous state when the configuration is applied.

### Button event Flow triggers

Homey's **Advanced Flow** editor is separate from the button's **STD / ADV** setting. STD keeps single-click actions immediate and does not detect double-clicks. Use button ADV mode for separate Clicked, Double Clicked and Long Pressed handling, in either standard or Advanced Homey Flows. A double-click action can be **Flow trigger** only; a selected target device with no action capability must not prevent the Flow event.

- **Pressed** fires immediately at the start of a physical gesture, before the app knows whether it will become a single click, double-click or long press. In ADV mode it fires once per gesture, not again for the second click within the double-click window. Use it for immediate feedback or starting an action; it is not an exclusive single-click trigger.
- **Clicked** in ADV mode fires only for a short single press, after the 350 ms double-click window following release. A double-click or long press cancels the pending single-click action and Clicked trigger.
- **Double Clicked** fires when a second press arrives within 350 ms of the first release. It suppresses the pending Clicked and Released events on the configuration/connector event cards.
- **Long Pressed** fires when the panel reports a hold, with repeat events according to the repeat settings. The repeat-count token starts at `0`.
- **Released** fires after letting go, subject to the release-event setting. On configuration/connector event cards it can wait for click resolution and is suppressed for a recognized double-click. The older dedicated release card reports physical releases independently.

Pressed and Released can therefore both occur during a single click or long press, but at different times: button-down versus button-up. The On/Off button-state triggers describe the logical button state, not the physical press/release edges. Choose **Clicked**, rather than Pressed, when a Flow must run only for a single short click.

### Synchronizing button state from Flows

Use **Turn button on** and **Turn button off** to reflect an external state, such as the selected TV source. These actions update the button's stored state, On/Off text or SVG, and LED colours without simulating a press, controlling its assigned device, or firing button On/Off or Clicked Flow triggers. Physical presses and Homey device controls still run their normal actions and triggers.

The page number matches the configuration settings: `0` is Default, `1` is page 1, and so on. Leave it blank or use `-1` to update every configured page. Updating an inactive page changes that page's feedback and stored state without changing the current page's Homey button state. In advanced mode, explicitly configured LED and display sources keep control of their respective outputs.

For a Flow-managed TV source selector, leave the source buttons' basic device set to **None**, use button triggers to choose the source, and use these state actions to synchronize all source buttons when the selection changes. This avoids feeding status updates back into the source-selection Flow. Existing Flows that relied on these actions to simulate a click must invoke the desired device or scene actions explicitly instead.

## Setting up display configurations

1. Select Display Configurations from the first drop list.
2. Select a configuration number to edit. This can later be assigned to a Button+ display.
3. Click on New Display Item.
4. Select a Device.
5. Select a Capability.
6. Edit the Label if required.
7. Edit the Units if required. This is only text and does not change the values sent to the display.
8. Enter the X and Y positions. These are a percentage of the display width and height.
9. Enter a width. This is again a percentage of the display width.
10. Enter a Rounding value. 0 = whole numbers (integer), 1 = 1 decimal place, etc.
11. Select a Font Size from the list.
12. Add more display items as required.
13. Click on Save Configurations.

### Numeric value scaling

Numeric Homey capabilities and Logic variables have an optional **Value multiplier** in display items and button display bindings. Use `100` to display a fraction such as `0.10` as `10`, or `0.001` to display `1500 W` as `1.5 kW`. Set the unit text separately and choose enough decimal places in Rounding for display items. Variable scaling only changes the displayed value; it does not write back to the variable.

Advanced numeric button actions have their own multiplier. Their absolute values and signed increments are divided by this factor before writing to Homey. For example, a multiplier of `100` and an increment of `+10` increase the native capability by `0.10`. Use matching display and action multipliers when controlling the same value.

Leave the multiplier blank to keep existing behaviour. The field is hidden for dim and blind-position capabilities, which already convert percentages automatically, and for non-numeric values and custom MQTT. Only positive, finite multipliers are supported.

## Setting up groups

Groups are the easiest way to define a complete physical Button + panel. A group represents one finished panel layout and can combine:

- one display configuration
- one or more button bar / connector configurations
- a custom name for the panel

To set up a group:

1. Open the Group Configurations tab in the app settings.
2. Select an existing group or click the + button to create a new one.
3. Give the group a name such as Living Room Panel or Main Hallway Panel.
4. Choose the display configuration to assign to that group.
5. Assign one or more connector/button configurations to the group.
6. Use the preview area to review the full panel layout before saving.
7. Duplicate or delete groups as needed if you want multiple panel layouts.

The **Preview** / **Configure** toggle is at the left of the Help icon row. Page navigation shares a row with the add, delete and duplicate icons on wider screens, and wraps below them on narrow screens.

This is useful when you want different physical panels in different rooms or for different purposes while reusing the same display and button presets.

## Adding a device to Homey

1. Select the New Device option in Homey.
2. Select Button button bar.
3. Click on Connect.
4. You should then see the device listed, so select it and continue. The app currently uses the Name found under the General settings to identify the button bar. If the Button + is not found, you can try to add it manually by selecting the Manual option and entering the IP address.
5. The device will be added to Homey.

## Using the Homey device

1. Open the device in Homey.
2. Open the second tab to view a list of configurations for the display and each connector.
3. Select the Display or a Connector number from the top drop list. Homey currently draws the Configuration list over the drop list, so it can be a pain to select what you want.
4. Select a Configuration number to apply to the Display / button bar connector.
5. The configuration is uploaded to the simulator, but you need to refresh the simulator to make it take effect. There is a button to the right of the Virtual Id to refresh the page.
6. You should now see the information you selected in the configuration displayed on the button bar.
7. You can click on the buttons in the mini displays to toggle the capability in Homey.

The app has a built-in MQTT broker, so no setup is required for that. However, it is possible to add one or more external MQTT brokers in the app settings page.
