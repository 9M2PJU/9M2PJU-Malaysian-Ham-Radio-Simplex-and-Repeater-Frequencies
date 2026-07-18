# Malaysian Amateur Radio Frequency Database

### The #1 curated frequency database for Malaysian amateur radio operators and PMR users

A meticulously curated, open-source collection of **206 Malaysian amateur radio frequencies** — covering simplex, repeaters, APRS, and PMR446 — optimized for modern viewing and seamless programming via CHIRP.

[![Ham Radio](https://img.shields.io/badge/Ham%20Radio-9M2PJU-00f3ff?style=for-the-badge&logo=radio&logoColor=black)](https://hamradio.my)
[![Malaysia](https://img.shields.io/badge/Malaysia-🇲🇾-bc13fe?style=for-the-badge)](https://frequency.hamradio.my)
[![License](https://img.shields.io/badge/License-GPL%203.0-0aff68?style=for-the-badge)](LICENSE)
[![Live Site](https://img.shields.io/badge/Live-frequency.hamradio.my-blue?style=for-the-badge)](https://frequency.hamradio.my)

---

## Live Website

**Browse the database:** [https://frequency.hamradio.my](https://frequency.hamradio.my)

The website is a Progressive Web App (PWA) with:

- **Searchable interface** — find frequencies by callsign, location, or tone
- **Geolocation sorting** — find repeaters near you
- **Card and table views** — flexible browsing
- **CHIRP CSV download** — program your radio in minutes
- **Offline support** — works without internet after first visit
- **Mobile optimized** — designed for field use

---

## Pages

| Page | Description |
|------|-------------|
| [Home](https://frequency.hamradio.my) | Searchable frequency database with filters |
| [FAQ](https://frequency.hamradio.my/faq.html) | Frequently asked questions about Malaysian ham radio |
| [CHIRP Guide](https://frequency.hamradio.my/chirp-guide.html) | Step-by-step CHIRP programming tutorial |
| [PMR446 Guide](https://frequency.hamradio.my/pmr446-guide.html) | License-free PMR446 channel guide |
| [Bands Guide](https://frequency.hamradio.my/bands-guide.html) | VHF, UHF, and HF band plans for Malaysia |
| [About](https://frequency.hamradio.my/about.html) | About the project and 9M2PJU |

---

## Frequency Coverage

| Band | Coverage | Channels | Type |
|------|----------|----------|------|
| **VHF** | 144–148 MHz | 100+ | Amateur Radio (2m) |
| **UHF** | 430–440 MHz | 30+ | Amateur Radio (70cm) |
| **PMR446** | 446 MHz | 16 | License-free (PMR446) |
| **Repeaters** | Various | 60+ | Linked Systems (MARTS, ASTRA) |
| **APRS** | 144.390 MHz | 1 | Packet Radio |

### Coverage by State

The database includes repeaters from every Malaysian state:

- **Kuala Lumpur & Selangor** — Bukit Lanjan (9M2RKL, 9M2RKK)
- **Pahang** — Gunung Ulu Kali, Bukit Brinchang, Cameron Highlands
- **Penang** — Bukit Bendera (Penang Hill)
- **Melaka** — Bukit Beruang, Gunung Ledang
- **Johor** — Gunung Pulai, Johor Bahru
- **Kedah** — Gunung Jerai, Gunung Keriang
- **Perak** — Bukit Larut, Lenggong, Taiping
- **Perlis** — Kangar
- **Terengganu** — Marang, Besut, Kijal
- **Kelantan** — Kota Bharu, Tumpat, Gua Musang
- **Sabah** — Kota Kinabalu, Gunung Kinabalu, Sandakan
- **Sarawak** — Kuching, Miri, Borneo Highlands

---

## Quick Start

### Option 1: Use the Website

Visit [frequency.hamradio.my](https://frequency.hamradio.my) to search and browse frequencies online.

### Option 2: Program Your Radio with CHIRP

1. **Download** the `9M2PJU.csv` file from the website
2. **Install** [CHIRP](https://chirp.danplanet.com) on your computer
3. **Connect** your radio via USB programming cable
4. **Import** the CSV into CHIRP (File > Import)
5. **Upload** to your radio (Radio > Upload To Radio)

See the detailed [CHIRP Programming Guide](https://frequency.hamradio.my/chirp-guide.html).

### Option 3: Clone the Repository

```bash
git clone https://github.com/9M2PJU/9M2PJU-Malaysian-Ham-Radio-Simplex-and-Repeater-Frequencies.git
```

---

## Supported Radios

The 9M2PJU CSV file works with any CHIRP-supported radio, including:

- **Baofeng:** UV-5R, UV-82, BF-F8HP, UV-K5
- **Yaesu:** FT-60R, FT-65R, FT-70DR, VX-6R
- **Icom:** IC-V80, IC-T70, ID-51
- **Kenwood:** TH-F6A, TH-G71
- **Wouxun:** KG-UV8D, KG-UV9D

See the [CHIRP Supported Radios list](https://chirp.danplanet.com/projects/chirp/wiki/Supported_Radios) for the complete list.

---

## Features

- **206 curated frequencies** — verified simplex, repeater, APRS, and PMR446 channels
- **CHIRP-compatible CSV** — direct import, no manual entry
- **GPS coordinates** — every repeater includes lat/lon with Google Maps links
- **CTCSS/DCS tones** — all access tones listed for each repeater
- **MARTS & ASTRA linking** — network information for linked repeaters
- **DMR support** — digital repeaters connected to Brandmeister Network
- **PWA** — installable, works offline, mobile-optimized
- **Open source** — GPL-3.0 licensed, community-driven

---

## Building from Source

The site uses [Tailwind CSS](https://tailwindcss.com) and a custom build script for SEO pre-rendering.

```bash
# Install dependencies
npm install

# Build CSS + pre-render SEO content from CSV
npm run build

# Watch CSS changes during development
npm run watch
```

The `build.js` script reads `9M2PJU.csv` and injects pre-rendered HTML tables and JSON-LD structured data into `index.html` for search engine optimization.

---

## Automated Repeater Updates

Repeater frequencies and locations are automatically synced from [RepeaterBook](https://www.repeaterbook.com) on the 1st of each month via a GitHub Actions workflow (`.github/workflows/update-repeaterbook.yml`). The workflow can also be triggered manually from the **Actions** tab.

### Setup

Add a repository secret named **`REPEATERBOOK_EUID`** with your RepeaterBook numeric user ID:

1. Go to **Settings → Secrets and variables → Actions → New repository secret**
2. Name: `REPEATERBOOK_EUID`
3. Value: your euid (the number in your RepeaterBook download URL, e.g. `104805`)

The workflow downloads the CSV from:

```
https://www.repeaterbook.com/repeaters/downloads/csv/index2.php?euid=<EUID>&func=route
```

merges it into `9M2PJU.csv` via `scripts/merge_repeaterbook.js`, regenerates `index.html`, and commits any changes directly to `main`.

### Manual merge

You can also run the merge locally against a downloaded RepeaterBook CSV:

```bash
node scripts/merge_repeaterbook.js ~/Downloads/RB_*.csv
node build.js   # regenerate SEO HTML
```

The merge script is idempotent — running it twice on the same data produces no changes.

---

## License

Licensed under the **GNU General Public License 3.0**. See [LICENSE](LICENSE) for details.

Operate with awareness of local amateur radio regulations — this database is for educational and reference use. A valid AROC license is required to transmit on amateur radio bands in Malaysia.

---

## About 9M2PJU

**9M2PJU** is a Malaysian amateur radio operator and the creator of this frequency database. The project began as a personal reference and grew into a community resource used by operators across Malaysia.

- Website: [hamradio.my](https://hamradio.my)
- Frequency Database: [frequency.hamradio.my](https://frequency.hamradio.my)
- GitHub: [9M2PJU](https://github.com/9M2PJU)

---

## 73 de 9M2PJU

Happy programming and clear skies!
