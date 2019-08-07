[![GitHub release](https://img.shields.io/github/release/eez-open/studio.svg)](https://github.com/eez-open/studio/releases)
[![license](https://img.shields.io/github/license/eez-open/studio.svg)](https://github.com/eez-open/studio/blob/master/LICENSE.TXT)

### Ownership and License

The contributors are listed in CONTRIB.TXT. This project uses the GPL v3 license, see LICENSE.TXT.
EEZ Studio uses the [C4.1 (Collective Code Construction Contract)](http://rfc.zeromq.org/spec:22) process for contributions.
To report an issue, use the [EEZ Studio issue tracker](https://github.com/eez-open/studio/issues).

## Introduction

The EEZ Studio is an open source cross-platform modular visual tool aimed to address various programming and management tasks for [EEZ H24005](https://github.com/eez-open/psu-hw) programmable power supply and other test and measurement instruments that support SCPI.

### EEZ Studio Project Editor (ESP)

![ESP](images/esp_intro.png)

-   Modular visual development environment for designing TFT display screen decorations and defining user interaction (HMI)
-   Supported modules (project features):
    -   _Settings (General, Build, Configurations, Files)_
    -   _Actions_
    -   _Data_
    -   _Extentsion definitions_
    -   _GUI (Pages, Widgets, Styles, Fonts, Bitmaps)_
    -   _SCPI (command subsystems, commands and context sensitive help)_
    -   _Shortcuts_
-   Generate C++ code for HMI functionality that can be directly included in Arduino IDE and upload into the 32-bit Arduino Due board
-   _Instrument definition file_ (IDF) builder with context sensitive SCPI commands help (based on Keysight’s [Offline Command Expert command set](https://www.keysight.com/main/software.jspx?cc=US&lc=eng&ckey=2333687&nid=-11143.0.00&id=2333687) XML structure) suitable for EEZ Studio Workbench (ESW) and [Keysight Command Expert](https://www.keysight.com/en/pd-2036130/command-expert)
-   SCPI command help generator based on bookmarked HTML generated directly from .odt file using [EEZ WebPublish](https://github.com/eez-open/WebPublish) extension for OpenOffice/LibreOffice.

### EEZ Studio Workbench (ESW)

![ESW](images/esw_intro.png)

-   Dynamic environment where multiple instruments and other "widgets" can be placed and easily accessed
-   **Session oriented interaction with each SCPI instrument**
-   Support for serial (via USB) and TCP/IP communication
-   Direct import of ESP generated IDFs and **Keysight’s Offline Command Expert command** sets
-   **Built-in instrument extensions for Rigol 1000 series of DSO/MSO**
-   History of all activities with search/content filtering
-   Quick navigation via calendar ("heatmap") or sessions list view
-   Shortcuts (hotkeys and buttons) that can be user defined or come predefined from imported IDF. The shortcut can contain single or sequence of SCPI commands or Javascript code.
-   Javascript code for task automation (e.g. logfile, or programming list upload/download, etc.) can be also assigned to the shortcut
-   SCPI commands context sensitive help with search
-   File upload (instrument to PC) with image preview (e.g. screenshots)
-   File download (PC to instrument) automation for transferring instrument profiles
-   Simple arbitrary waveform editor (envelope and table mode)
-   Displaying measurement data as graphs

---

**Scheduled for future milestones:**

-   Support for other connections (i.e. VXI-11, USBTMC, IVI) using 3rd party open source
-   Instrument extensions for popular instruments from other vendors
-   Print and PDF export
-   (External) Data logger functionality
-   Protocol analyzer using 3rd party open source
-   Import/export of all working data (i.e. measurements, session history, shortcuts, settings, etc.) for archiving purposes or easier integration with e.g. [ELN](https://en.wikipedia.org/wiki/Electronic_lab_notebook)s

## Installation

### Linux

Download `eezstudio-linux-x64.tar.gz`, unpack and select `eezstudio`.

### Mac

Download `eezstudio-mac.zip`, unpack and move `eezstudio.app` to Applications.

### Windows

Download and start `EEZ_Studio_setup.exe`.

### Build and run from source (all operating systems)

-   Install `Node.JS 8.9.x` or newer
-   Install `node-gyp`, more information at https://github.com/nodejs/node-gyp#installation

```
sudo apt-get install build-essential libudev-dev
git clone https://github.com/eez-open/studio
cd studio
npm run build
npm start
```

### Build DEB package on Ubuntu

First: install dependecies:

```
sudo npm install -g electron-installer-debian
```

Then build the package:

```
npm run build
npm run build-installation
npm run build-deb
```

Or in one step:

```
npm run build-deb-all
```

Built DEB package is located in `installation/linux`.

### Build RPM package on Ubuntu

First, install dependecies:

```
sudo npm install -g electron-installer-redhat
sudo apt install rpm
```

Then build the package:

```
npm run build
npm run build-installation
npm run build-rpm
```

Or in one step:

```
npm run build-rpm-all
```

Built RPM package is located in `installation/linux`.

### Build Snap package on Ubuntu

```
sudo npm install -g electron-installer-snap
sudo apt install snapcraft
npm run build
npm run build-installation
npm run build-snap
```

Built Snap package is located in `installation/linux`.

### Build Linux installation using Docker

```
docker run --rm -ti \
 --env-file <(env | grep -iE 'DEBUG|NODE_|ELECTRON_|YARN_|NPM_|CI|CIRCLE|TRAVIS_TAG|TRAVIS|TRAVIS_REPO_|TRAVIS_BUILD_|TRAVIS_BRANCH|TRAVIS_PULL_REQUEST_|APPVEYOR_|CSC_|GH_|GITHUB_|BT_|AWS_|STRIP|BUILD_') \
 --env ELECTRON_CACHE="/root/.cache/electron" \
 --env ELECTRON_BUILDER_CACHE="/root/.cache/electron-builder" \
 -v ${PWD}:/project \
 -v ${PWD##*/}-node-modules:/project/node_modules \
 -v ~/.cache/electron:/root/.cache/electron \
 -v ~/.cache/electron-builder:/root/.cache/electron-builder \
 electronuserland/builder
```

Execute this inside docker container:

```
apt-get update
apt-get install libudev-dev libxss1 libasound2
yarn build2
```

Installation packages are located inside `builder-output` folder.

## USB TMC

### Windows

Download and start [Zadig](http://zadig.akeo.ie/). Select your device and click "Install WCID Driver" button.

### Linux

Follow instructions described [here](https://www.teuniz.net/DSRemote/) under "USB connection".

## FAQ

### Where is database file located?

-   Linux: `~/.config/eezstudio/storage.db`
-   Mac: `~/Library/Application\ Support/eezstudio/storage.db`
-   Windows: `%appdata%\eezstudio\storage.db`

Creating database someplace else can be done from ESW Settings.

### Where are installed extensions stored?

-   Linux: `~/.config/eezstudio/extensions`
-   Mac: `~/Library/Application\ Support/eezstudio/extensions`
-   Windows: `%appdata%\eezstudio\extensions`
