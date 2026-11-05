# Firmware support notes

What FM-1 Relay Studio knows about each firmware, and where that knowledge comes from. Check these notes when a firmware releases a new version. The profiles live in [`src/firmware/profiles`](../src/firmware/profiles).

The [Firmware Hub](https://thefirmwarehub.com/) lists dozens of FM-1 firmwares. Most are forks of **Felucca**. Many of those keep its MIDI behaviour and its SysEx editor protocol, so the app treats any device that answers that protocol as at least "FL-compatible".

## The FL editor protocol

SysEx `F0 7D 46 4C <cmd> <args…> F7` ("FL" after Felucca). The device answers one request at a time and holds a single incoming frame. Spec: Felucca's [`web/EDITOR_PROTOCOL.md`](https://github.com/hugelton/Felucca).

| Commands | Shared by | Used for |
| --- | --- | --- |
| 1 INFO, 2 GET, 3 SET, 4 DUMP, 5 DESC, 8 PRESET, 10 NAMES | all (v1) | detection, sound editor, presets |
| 6 / 7 STEP_GET / SET, 9 PROJECT | all (v1) | pattern sync, projects |
| 16–21 user presets, 22 WATCH, 23 / 24 / 26 pushes, 25 PING | v2 | library, live sync |
| 27 TRACK, 28 TRACK_MIX, 29 TRACK_DUMP, 30 TRACK_STEP | v3 | tracks, mixer, pattern sync |
| 31 TRACK_PARAM, 32 TRACK_CHANGED | v4 | pan per track, live mixer |
| 33 and above | **different per fork** | only through a profile's `extensions` |

Command numbers from 33 up mean different things on different forks. On SLOOP 34 is a backup list; on Skiff it is preferences. The app sends them only when the profile is the firmware that defines them (`flExtensions()` in `src/device/fl-device.js`).

INFO tails also differ. SLOOP appends its protocol version (5 … 12). Skiff appends `CHAIN_ROWS` and tagged blocks, including `49 01` with the full 14-bit `P_COUNT` / `P_E0` above 127. `parseInfo` handles both.

## SLOOP (isod89) — documented against 2.8.4

- Tracks: SYN 1–3 on channels 1–3, drums on 10 (GLO › MIDI). The drums are 16 lanes, one per white key (KICK 36 … COWBELL 56).
- Clock: GLO › SYSTEM › SYNC = USB. It follows 24 PPQN, START, CONTINUE and STOP, and falls back to its own tempo 0.5 s after the clock stops. GLO › MIDI 2 › IN = CLOCK takes the clock only.
- CCs (seq.c `MIDI_CC_MAP`): 5 glide, 7 level, 10 pan, 71 resonance, 72 / 73 / 75 release / attack / decay, 74 filter (64 = off), 91 / 93 / 94 reverb / chorus / delay sends, 11 expression, 64 sustain. On the drum channel 7, 91 and 94 set GLO › DRUMS LVL, REV and DLY.
- Program Change loads the n-th PRESETS sound; on the drum channel it loads kit n. CC 0 is bank select (2.8).
- REMOTE (GLO › MIDI 3): CC 102 + k presses button k, in this order: FX SEL ENV LFO EDIT GLO HOME SAVE ARP SEQ PLAY REC OCT− OCT+. Values of 64 and above press the button; values below release it.
- FX CH (GLO › MIDI 3): notes 53–79 (F3–G5) hold the 27 punch-in effects. The white keys hold the first 16, the black keys the 11 added in 2.6.
- Protocol extensions used: 33 DRUM_STEP (v5), 34 / 35 BK_LIST / BK_GET (v6, read-only backup).
- Not used yet: 36 BK_PUT (restore), 37–42 locks, nudges and fills, 68–76 FM6 / SYN kits, 77 LIVE.

## Felucca (Hügelton) — documented against 1.7.0

- Tracks 1–4 on channels 1–4. MENU › MIDI › MIDI IN = CH1-4. TRACK gives each track its own channel. The drum track is **4**, not 10.
- Clock: MENU › CLOCK › CLK = USB (or TRS).
- The standard CC map (#103) is the SLOOP list above without the remote and FX additions, plus mod wheel (1), expression (11), RPN pitch-bend range, sustain and All Notes Off. Program Change loads presets.
- Releases before 1.0 ignore CCs and Program Change.

## Skiff (illuminus5) — documented against 2.0.3

- Six tracks on channels 1–6 (MENU › MIDI › MIDI IN = CH1-6, or T1–T6 CHANNEL). Any track can run DRUM or DRUM-X.
- Clock: MENU › MIDI › CLOCK = USB.
- Standard CC map plus mod wheel, expression and sustain. Program Change loads presets.
- Its FL protocol has P_COUNT 143. The app reads parameters up to id 127, so some engine parameters are missing on the Sound page.

## JIANT (juanjiant-bit)

- Six tracks on channels 1–6 (MIDI IN ROUT = CH1-6). Built on Felucca, so the standard CC map is assumed but not confirmed by its docs.
- Clock: GLO › GLOBAL › CLOCK = USB. MENU › USB › AUDIO STEMS sends each track as its own USB audio channel.

## X0X (Charles Vestal) — documented against 0.10.3

- Parts on fixed default channels: 909 = 10, 808 = 11, 303A = 2, 303B = 3, BREAK = 4 (GLO › MIDI).
- 909: 36 kick, 38 snare, 37 rim, 39 clap, 42 closed hat, 46 open hat, 41 / 45 / 50 toms, 49 crash, 51 ride. The 808 adds 56 cowbell. BREAK: notes 36–43 play slices 1–8.
- It follows clock by itself. 303: overlapping notes slide, and velocity of 100 or more is an accent. No documented CCs or SysEx.
- The USB port is named "X0X FM-1", which is how the app detects it.

## ECHOFIELD (Philip Bos) — documented against 0.2.9

- A granular sampler: one voice, played from the keys (C4 = the sample's own pitch). No FL editor protocol; its companion app uses its own SysEx (0x70–0x7F in the update framing, `app/proto.c`).
- USB port name "ECHOFIELD FM-1" (`app/fm1.toml`), which is how the studio detects it.
- Channel: every channel unless GLO › MIDI CH picks one (`app/app.c` midi_in).
- Clock (0.2.9+): follows 24 PPQN, START, CONTINUE and STOP with nothing to set. START / STOP play and stop the endless sound. While the clock runs, PULSE steps on its 1/16, 1/8 or 1/4 (whichever is nearest the EVOLVE pace) and re-aligns every quarter note, and the delay time snaps to the nearest note value. It falls back to its own time 0.5 s after the clock stops.
- Before 0.2.9 it ignores all real-time messages. The studio therefore also sends CC 104 = 127 with START and 0 with STOP (the profile's `transport.playCc`).
- CCs (`app/params.c` PI[].cc, linear over each range): 7 level, 14 position, 15 texture, 16 scatter, 17 drift, 18 evolve, 19 pitch, 21 tape, 22 harmony, 23 width, 24 size, 25 density, 26 scan, 27 reverse, 28 tone, 29 drive, 30 / 31 pitch / size random, 71 resonance, 72 / 73 release / attack, 74 cutoff, 85 / 86 / 87 delay time / feedback / mix, 91 reverb, 92 reverb size, 93 shimmer, 94 damp. 102 picks the mode, 103 freeze, 104 play, 64 sustain. Program Change loads a preset.

## Official M-VAVE firmware

A single FM part on channel 1. M-VAVE publishes the CC chart as a separate PDF for V15, which the app doesn't include. Use **Custom CC**.
