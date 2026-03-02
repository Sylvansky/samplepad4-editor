# SamplePad 4 Kit Mapper

Lightweight desktop app for creating Alesis SamplePad 4 compatible `.KIT` files on Windows.

It is built specifically for the SamplePad 4 file format (`3200` bytes), using a known-good `.KIT` as template and only editing pad-to-WAV mappings plus checksum.

## What it does

- Loads a working SamplePad 4 template kit (for example your `USER_001.KIT`)
- Scans your SD card for `.wav` files
- Lets you map 6 pad inputs (4 pads + 2 triggers) to WAV stems
- One-click copies mapped WAVs to `RENAMED_WAVS/` using device-safe suggested 8-char names
- Saves a new `.KIT` file that keeps the original template structure intact

## Install

From this folder:

```bash
npm install
```

## Run (development)

```bash
npm start
```

## Build Windows installer

Run this on Windows:

```bash
npm run dist:win
```

Installer output will be in `dist/`.

## Recommended workflow with your SD card

1. Back up your SD card first.
2. Open app.
3. Select SD card root folder.
4. Select template `.KIT` (use your known-good `USER_001.KIT`).
5. Map each pad to a WAV stem.
6. Save as a new file in `KITS/` (for example `USER_002.KIT`).
7. Eject card safely and test on hardware.

## Compatibility notes

- WAV stem names are sanitized to letters/numbers/underscore and truncated to 8 chars for device compatibility.
- This app does not try to rewrite unknown metadata blocks; it preserves template bytes except mapping fields and checksum.
