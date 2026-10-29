# System Monitor for Ulanzi Deck

Puts MSI Afterburner's live stats on Ulanzi Deck keys, one big number per page:
FPS, frametime, min / avg / max, 1% and 0.1% lows, GPU and CPU temperature, usage,
clock and power, VRAM, and RAM. Numbers turn green / yellow / red against your thresholds.

## Install

Needs Windows 10 or 11, MSI Afterburner running, and UlanziStudio. Nothing else to install.

1. Download `com.koriyuka.fps.ulanziPlugin.zip` from the [latest release](../../releases/latest).
2. Quit UlanziStudio (right-click its tray icon → Exit).
3. Open the zip and drag the `com.koriyuka.fps.ulanziPlugin` folder into
   `%APPDATA%\Ulanzi\UlanziDeck\Plugins`.
4. Start UlanziStudio and drag keys from the **System Monitor** category onto your deck.

Afterburner setup, every key's pages, troubleshooting, and developer notes are in
[the plugin's README](com.koriyuka.fps.ulanziPlugin/README.md).
