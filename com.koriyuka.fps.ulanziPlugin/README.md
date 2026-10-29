# System Monitor for Ulanzi Deck

Shows MSI Afterburner's live stats on Ulanzi Deck keys: FPS, frametime, min/avg/max,
1% and 0.1% lows, GPU and CPU temperature, usage, clock and power, VRAM, and RAM.

The plugin reads Afterburner's shared memory (`MAHMSharedMemory`) directly. Nothing
extra runs in the background, and no admin rights are needed.

## Requirements

- Windows 10 or 11 (64-bit)
- MSI Afterburner, running (RivaTuner Statistics Server comes with it)
- UlanziStudio. The plugin runs on UlanziStudio's own built-in Node.js, so you don't
  need to install Node, npm, or anything else.

## Install

1. Download `com.koriyuka.fps.ulanziPlugin.zip`.
2. Quit UlanziStudio (right-click its tray icon → Exit).
3. Open the zip and drag the `com.koriyuka.fps.ulanziPlugin` folder into
   `%APPDATA%\Ulanzi\UlanziDeck\Plugins`
   (paste that path into File Explorer's address bar to get there).
4. Start UlanziStudio and drag keys from the **System Monitor** category onto your deck.

To update, do the same and replace the old folder. To uninstall, delete it.

## Afterburner setup

Settings → **Monitoring** → tick every graph you want on the deck. The plugin
only sees sensors that are ticked there. FPS and frametime only have values while
a game is running.

For **1% low / 0.1% low**: RivaTuner → Setup → enable **Benchmark mode**, then
press the benchmark hotkey in game (F9 by default). RTSS → Setup → Statistics →
percentile buffer set to **ring** keeps them updating continuously.

**Faster updates:** the live **FPS** and **Frametime** pages read RivaTuner
(RTSS) directly, so they keep up with the RTSS overlay. Everything else, including
FPS min/avg/max and the lows, comes from Afterburner, which only refreshes once per
**Hardware polling period** (Settings → Monitoring, default 1000 ms). Lower it
(e.g. 250) if you want those to update faster too; it costs a little more CPU.
If RTSS isn't running, FPS falls back to Afterburner's copy.

## Keys

Every page shows one stat as a big number. Press the key to go to the next page;
the dots at the bottom show which page you're on.

| Key      | Pages, in order |
|----------|-----------------|
| FPS      | FPS, frametime, FPS avg, 1% low, 0.1% low, FPS min, FPS max |
| GPU      | Temp, usage, power, core clock, VRAM used, VRAM used by game, VRAM clock |
| CPU      | Temp, usage, clock, power |
| RAM      | RAM used, RAM used by game |
| Overview | FPS, 1% low, GPU temp, GPU usage, CPU temp, CPU usage, RAM used. Flips by itself every 5 s |

Numbers turn green / yellow / red against your thresholds (FPS and temperatures).
Each key's settings panel has the thresholds, the history graph, the refresh rate,
and **Auto page** (flip pages by itself; any key can use it, Overview has it on by default).

## Troubleshooting

- **Key says "MSI Afterburner not running"**: start Afterburner. The key recovers by itself within a second.
- **A value shows "—"**: that graph isn't ticked in Afterburner's Monitoring tab, or (for FPS stats) no game is running.
- **Second GPU**: set "GPU index" to 1 in the key's settings.
- **"System Monitor" doesn't appear in UlanziStudio**: check the folder sits directly in
  `Plugins` (`Plugins\com.koriyuka.fps.ulanziPlugin\manifest.json`), not one level deeper.

---

## For developers

Needs Node.js 20 (UlanziStudio ships 20.12.2, so match it).

```powershell
npm install
npm run smoke      # plugin against a fake UlanziStudio, every key must draw
npm run package    # -> dist/com.koriyuka.fps.ulanziPlugin.zip
```

`npm run package` copies only what the plugin needs at runtime (including
`node_modules`, since users won't run npm) into `dist/` and zips it with one
top-level `com.koriyuka.fps.ulanziPlugin/` folder. That zip is what you publish.
To check a build exactly as a user would get it, unzip it somewhere and run:

```powershell
node scripts/smoke-test.js <unzipped>\com.koriyuka.fps.ulanziPlugin "<UlanziStudio>\nodejs\node.exe"
```

The only native dependency is koffi's prebuilt Windows binary (no compiler needed);
the package step refuses to build if it's missing.

### Tools

| Command           | What it does |
|-------------------|--------------|
| `npm run sensors` | Lists every sensor Afterburner is publishing right now |
| `npm run rtss`    | For 5 s, shows the FPS from RTSS, from Afterburner, and what the deck would display (run it with a game open) |
| `npm run preview` | Renders every key layout to `preview/index.html` |
| `npm run smoke`   | Starts the plugin against a fake UlanziStudio and checks every key draws |
| `npm run package` | Builds the release zip in `dist/` |
| `npm run icons`   | Regenerates the action icons in `assets/icons/` |

### Files

```
plugin/app.js              main service: talks to UlanziStudio, runs the update loop
plugin/mahm-reader.js      reads MAHMSharedMemory (Afterburner) through koffi
plugin/rtss-reader.js      reads RTSSSharedMemoryV2 for live FPS and frametime
plugin/shared-memory.js    maps a named Windows shared-memory section read-only
plugin/sensor-collector.js maps Afterburner source IDs to named metrics, keeps history
plugin/display-manager.js  draws each key as an SVG image
plugin/settings.js         per-key defaults and validation
plugin/ulanzi-api/         Ulanzi Node SDK (Apache-2.0, from UlanziDeckPlugin-SDK)
libs/                      Ulanzi HTML SDK for the settings panel (Apache-2.0)
property-inspector/        settings panel
```
