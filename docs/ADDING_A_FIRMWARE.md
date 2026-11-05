# Adding a firmware

Most firmwares need one data file: a **profile**. It tells the app how to recognise the firmware, which tracks sit on which MIDI channels, which CCs it documents, and the menu paths a user must set.

## 1. Write the profile

Create `src/firmware/profiles/<id>.js`:

```js
import { STANDARD_CC, synth, drums } from "../common.js";

export default {
  id: "myfw",                       // unique, lower case
  name: "MYFW",                     // shown on device cards
  author: "you",
  documented: "1.2.0",              // the version you checked these facts against
  links: {                          // any of: source, manual, editor, emulator, home (https only)
    source: "https://github.com/you/myfw",
  },
  detect: {
    info: /myfw/i,                  // matches the INFO version string (FL-protocol firmware)
    port: /myfw/i,                  // matches the USB MIDI port name
  },
  protocol: "fl",                   // "fl" if it answers F0 7D 46 4C INFO, else null
  tracks: [                         // or (info) => [...] to build them from INFO
    synth("LEAD", 1),
    drums("DRUMS", 10),             // GM lanes by default; pass your own [["KICK", 36], …]
  ],
  setup: [                          // shown on the Devices page, one line per step
    "Clock: MENU › CLOCK = USB.",
  ],
  cc: STANDARD_CC,                  // [{ cc, label, def, group, bipolar?, hint? }]
  ccUnverified: false,              // true shows a warning on the Controls page
  programChange: { label: "PRESET", note: "Program n loads preset n." }, // or null
};
```

Optional performance features, used by SLOOP:

- `remote: { setting, firstCc, buttons: [...] }` shows a pad grid that holds CC `firstCc + k` at 127 while a pad is pressed and sends 0 on release.
- `fx: { setting, pads: [{ note, white, label }] }` shows a keyboard of note-on/off pads.
- `kits: [...]` names Program Change values on the drum track.
- `extensions: {...}` gates the FL commands numbered 33 and up, which differ per fork. Read [FIRMWARES.md](FIRMWARES.md) first.

## 2. Register it

Import it in `src/firmware/index.js` and add it to `PROFILES`. Order matters: the first profile whose `detect` pattern matches wins, so place it before any profile it is a fork of (SLOOP before Felucca, for example).

## 3. Test it

```sh
npm test
```

`tests/profiles.test.js` checks every profile for unique ids, valid channels, CCs and lanes, and https links. If your firmware has an INFO quirk, add a parsing test to `tests/protocol.test.js` built from a real reply frame.

## 4. Document it

Add a section to [FIRMWARES.md](FIRMWARES.md) with the facts and **where they came from** (manual, source file and line). Add a row to the table in the README. Then open a pull request.

If the firmware has a SysEx protocol of its own (not FL), it needs a client like `src/protocol/fl.js` and a device module like `src/device/fl-device.js`. Open an issue first so we can agree on the shape.
