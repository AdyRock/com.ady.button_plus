# Homey Button+ App Development Guidelines
- Homey capability `units` can be a string or localized object (`{ en: "%" }`). Always parse both.
- MQTT topic structure for panel display values: `buttonplus/<deviceId>/<capability>`.
- Display item On/Off SVGs and text overrides (`onSVG`, `offSVG`, `onText`, `offText`) apply to boolean capabilities.
- Windows workspace: Use CRLF line endings for new files.