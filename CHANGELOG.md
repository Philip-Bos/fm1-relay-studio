# Changelog

## 2.0.0 — 2026-11-04

The first open-source release of FM-1 Relay Studio.

### Added
- **ECHOFIELD** profile: port-name detection, its CC map, and CC 104 sent with START / STOP so versions without clock support still start and stop with the rest.
- **Firmware profiles** for SLOOP, Felucca, Skiff, JIANT and X0X, plus generic FL and plain-MIDI fallbacks. Each has its channels, CC map, Program Change behaviour, menu-path setup steps and links.
- **Setup panel** on the Devices page with the selected firmware's exact settings and what the app can do with it.
- **Mixer** page: per-track level, pan and mute on the device over SysEx, following the device live, with a CC 7/10 fallback.
- **Controls** page: the documented CC map per track, Program Change and bank, drum kits, pitch bend, sustain, custom CC for MIDI LEARN, and panic. For SLOOP, its remote buttons and the 27 punch-in effects.
- **Library** page: device projects 1–4, 32 user presets (load, store, erase), a full read-only SLOOP backup to a file, and session import and export.
- **Pattern sync**: pull the device's own step pattern into the piano roll, or push the roll to the device. On SLOOP this keeps drum levels and ratchets.
- **Live sync** on the Sound page: knob turns on the FM-1 move the sliders.
- Value formatting per parameter type; double-click a control to reset it.
- **Export .mid** of a device's pattern.
- **Session autosave**: devices are remembered by port name, along with patterns and tempo.
- Tap tempo; page addresses in the URL (`#mixer`) with back and forward.
- **Virtual demo device** (`?demo`) that answers the FL protocol, for trying the app and for tests.
- Test suite (`npm test`), CI, contributor docs.

### Fixed
- Felucca's tracks are on channels 1–4 (drums on 4), not 10.
- Drum grids use the firmware's own lanes (X0X 909, 808 and BREAK slices) instead of one fixed list.
- Keyboard shortcuts for the roll and the computer keys only act on the Sequencer page.

## 1.x

The original single-file FM-1 Relay: clock master, piano-roll sequencer with the drum library, SysEx sound editor and multitrack recorder.
