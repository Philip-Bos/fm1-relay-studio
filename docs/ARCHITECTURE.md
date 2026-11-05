# Architecture

This page maps the code of **FM-1 Relay Studio**.

A static page of plain ES modules. Nothing is compiled or bundled. State lives in one object (`S` in `src/state.js`). Pages re-render from it with small DOM helpers.

```
index.html              page shell and the device-card template
styles/main.css         one stylesheet (dark hardware look, LCD accents)
src/
  main.js               entry point: transport wiring, page switching, animation loop, autosave
  state.js              S (app state), slot model, small selectors (out, prof, hasFl, …)
  session.js            save / restore / import / export of the session, .mid export
  lib/
    encoding.js         7-bit encodings: v14, pack7, u35, C strings, CRC-32
    smf.js              Standard MIDI File writer
  protocol/
    fl.js               FL SysEx protocol: framing, parsers, request builders, FlClient (queue + pushes)
  firmware/
    common.js           shared CC map, GM drum lanes, track helpers
    index.js            registry, detection, track layout, protocol level
    profiles/*.js       one data file per firmware
  device/
    fl-device.js        per-slot device operations: identify, sound, mixer, pattern pull/push, library, backup, WATCH
  midi/
    access.js           Web MIDI access, ports, audio inputs, the demo device
  dev/
    virtual-device.js   a software FM-1 (SLOOP-like) that answers the FL protocol: demo mode and tests
  music/
    theory.js           scales and chords
    drum-library.js     100 generated drum grooves
  sequencer/
    pattern.js          tracks and notes per slot, note scheduling, undo history
    clock.js            the MIDI clock master (24 PPQN, look-ahead scheduling)
    roll.js             piano roll (canvas): editing, drawing, ruler, velocity lane
    keyboard.js         on-screen piano, computer keys, external MIDI keyboards
    steps.js            notes ↔ firmware step patterns (pure, tested)
  pages/                one module per page; each exports a render function
  ui/dom.js             element helpers
tests/                  node --test suites (no browser needed)
tools/serve.mjs         zero-dependency dev server
```

## Timing

`clock.js` runs a 5 ms timer. Each tick it schedules clock pulses and the notes inside them up to 20 ms ahead, using `MIDIOutput.send(data, timestamp)`. Timer jitter therefore never reaches the clock. Each device has its own pulse counter, so devices can start and stop independently.

## Talking to a device

`FlClient` sends one request at a time and matches replies by command number. Push frames (CHANGED, RELOAD, STEP_CHANGED, TRACK_CHANGED) go to listeners whenever they arrive. Pages that follow the device (Sound, Mixer) turn on `WATCH` and stop it when you leave. A `PING` every second keeps WATCH alive.

Parameter ids move between firmware versions, so the app finds parameters by their **DESC label** (`findParam(s, /^LEN$/)`) and never hard-codes an id.

## Profiles

Firmware knowledge lives in data, not code paths. The UI reads `prof(s)` to decide which channels to use, which CC knobs to show, and whether to offer remote buttons, punch-in FX or kits. See [ADDING_A_FIRMWARE.md](ADDING_A_FIRMWARE.md).
