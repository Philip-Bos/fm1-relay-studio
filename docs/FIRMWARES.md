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

## SLOOP 3 (isod89) — documented against 3.3.7

A rewrite of SLOOP from scratch, with its own entry in the firmware list. It is a public beta. Sources: [`app/midi.c`](https://github.com/isod89/sloop3-fm1/blob/main/app/midi.c), `fw/main.c` (`midi_in`, `midi_program`, `remote_cc`, `midi_fx`), `app/edproto.h` and `docs/GUIDE.md`.

- USB port name "FM-1 SLOOP 3", which is how the studio detects it.
- Its own SysEx editor protocol, `F0 7D 53 33 <cmd> <bytes packed 8 to 7> F7` (protocol 2), not FL. It doesn't answer FL INFO. Its INFO (command 1) answers with the protocol, the track count (5), the values per sound (48) and the version string ("3.3.7" on the unit this was checked on). The studio doesn't speak it yet, so the sound editor, SysEx mixer, pattern sync and library don't reach SLOOP 3. Everything over plain MIDI does.
- Tracks: SYN 1–4 on channels 1–4 and the drums on 10 (GLO › MIDI 4/6 › IN = TRACKS, the default). IN = SEL sends every channel to the selected track. On screen the drums are the 5th track.
- Clock: GLO › MIDI 4/6 › SYNC = **EXT**. The default INT ignores clock, START and STOP. With EXT it follows 24 PPQN, START, CONTINUE and STOP, and returns to its own tempo 0.5 s after the clock stops. CLK sends its own clock, only while SYNC is INT.
- Drums (GLO › 5/6 › DRUM): GM by default, with its own notes (36 kick, 35 kick 2, 38 snare, 39 clap, 42 hat, 46 open, 44 pedal, 37 rim, 40 snare 2, **41** low tom, 48 hi tom, 49 crash, 51 ride, 70 shaker, 63 conga, 56 bell). PADS puts the 16 sounds on notes 36–51.
- CCs (`midi_cc`, SLOOP 2.8's numbers): 1 the LFO to the pitch, 5 glide, 7 level, 10 pan, 71 resonance, 72 / 73 / 75 release / attack / decay, 74 the engine's cutoff (on engines without one, the track filter: 64 off), **76 LFO rate** (new), 91 / 93 / 94 reverb / chorus / delay sends, 64 sustain, 120 / 123 all notes off, 121 reset. 11 (expression) is gone. GLO + F#3 is MIDI LEARN (16 CCs).
- Program Change: the n-th factory sound (bank select CC 0 picks the next 128; bank 8 picks your 32 sounds). On the drum channel it picks a kit: 37 factory kits, USR1–4, USR3+4 and SYN1–4.
- REMOTE (GLO › 5/6): CC 102 + k presses button k, in SLOOP 2.8's order. FX CH (GLO › 5/6): notes 53–79 hold the 27 punch-ins, the same effects and order as 2.8.

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

## SHRUB (Xfer Records) — documented against V1.07

- Serum 1, pared down for the FM-1: one part, four voices, one filter shared by every voice. Beta. Source of every fact here: the [SHRUB guide](https://shrub.audio/guide) 1.0 ("MIDI and USB", "The presets", Appendix C).
- No FL editor protocol: it answers neither INFO nor the universal identity request (checked on a V1.07 unit). Its editor at shrub.audio talks to it on its own.
- USB port name "USB Composite Device" (seen on a V1.07 unit; the guide doesn't name it). That name isn't unique, so the profile sets `detect.genericPort`: the studio trusts it only when the device doesn't answer INFO. Pick the firmware on the device card if another firmware shows up as SHRUB.
- Channel: GLO › GLOBAL, page 3, KNOB 1 MIDI CH (OMNI, 1–16 or MPE). It is an FM-1 setting, not part of the preset. USB and the TRS MIDI IN behave the same.
- Clock: nothing to set. Clock, START, STOP, CONTINUE and song position move its transport. TEMPO follows the clock, so synced LFOs, the delay, the arp and the motion-sequencer lanes run at the studio's tempo. PLAY on the FM-1 takes the lead back.
- MIDI out: the notes from its keys, arp and chords, and clock with START / STOP while its own transport leads.
- CCs (Appendix C, the factory map; the editor's MIDI Learn or File › Load MIDI Map replaces it on the device): 5 glide, 7 level, 16–19 macros 1–4, 20 / 21 WT position A / B, 22 / 23 warp amount A / B, 24 / 25 level A / B, 26 sub, 27 noise, 28 / 29 detune A / B, 30 blend A, 31 filter mix, 70 drive, 71 resonance, 74 cutoff, 73 / 75 / 78 / 72 ENV 1 A / D / S / R, 80 ENV 2 to cutoff, 81 / 82 / 83 / 85 ENV 2 A / D / S / R, 76 / 77 / 86 / 87 LFO 1–4 rate, 79 FAT, 90 hyper, 91 reverb, 92 distortion, 93 chorus, 94 delay, 95 phaser, 102 flanger and 103 compressor mix, 104 distortion drive, 105 delay feedback, 106 / 107 reverb size / decay, 108 / 109 / 110 FX filter cutoff / resonance / mix, 111 / 112 EQ gain 1 / 2, 113 / 114 arp rate / gate. Also 64 sustain, 120 and 123 all notes off, 121 reset controllers. Every automatable parameter also has an NRPN (369); the guide doesn't list them.
- The guide gives no CC ranges or defaults. The profile's defaults are neutral guesses, so **RESET ALL TO DEFAULTS** on the Controls page moves a SHRUB patch away from its saved sound.
- Program Change picks the preset slot: 128 slots, 1–100 factory, 101–128 INIT. Program Change 0 is slot 1 (the studio's PRESET field is 1-based, so PRESET 5 is slot 5). Bank select isn't documented.

## Official M-VAVE firmware

A single FM part on channel 1. M-VAVE publishes the CC chart as a separate PDF for V15, which the app doesn't include. Use **Custom CC**.
