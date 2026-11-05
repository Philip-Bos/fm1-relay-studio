# Contributing

Thanks for helping. Owners of the FM-1 and of its many firmwares are the people who make this better.

## Easiest ways to help

- **Test with your firmware** and report what works and what doesn't. Use the *Firmware report* issue template and paste the version string shown on the device card.
- **Add or fix a firmware profile.** It is usually one data file: see [docs/ADDING_A_FIRMWARE.md](docs/ADDING_A_FIRMWARE.md).
- **Correct a menu path or CC number** in a profile. Cite the manual or source line in your PR.

## Working on the code

```sh
npm start   # http://localhost:4173 (add ?demo for the virtual device)
npm test
```

- No dependencies and no build step. Keep it that way unless there's a strong reason; open an issue first.
- Match the surrounding style: small functions, short names in hot paths, comments that explain *why*.
- Logic that can be pure (protocol parsing, step conversion, encodings) belongs in modules without DOM access, with a test in `tests/`.
- Don't send SysEx commands numbered 33 or above unless the profile says the firmware defines them. They differ between forks.
- Never send anything that writes the firmware or update area. Only the documented editor commands are allowed.

## Pull requests

1. Fork, branch, change, `npm test`.
2. Describe what you changed and how you tested it: on which device and firmware version, or with `?demo`.
3. Keep PRs focused. A profile fix and a UI change are two PRs.

By contributing you agree that your work is released under the [MIT licence](LICENSE).
