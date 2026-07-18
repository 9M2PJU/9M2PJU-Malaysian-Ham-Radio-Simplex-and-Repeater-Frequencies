/**
 * build.js — Pre-renders CSV frequency data into static HTML for SEO.
 *
 * Why: The original site loads all frequency data via JavaScript (PapaParse
 * fetching 9M2PJU.csv at runtime). Search engine crawlers that don't execute
 * JS see an empty page. This script reads the CSV at build time and injects
 * a fully rendered semantic HTML table + JSON-LD structured data into
 * index.html so crawlers can index every frequency, repeater, and location.
 *
 * Usage: node build.js
 */

const fs = require('fs');
const path = require('path');

const CSV_FILE = path.join(__dirname, '9M2PJU.csv');
const HTML_FILE = path.join(__dirname, 'index.html');
const SITEMAP_FILE = path.join(__dirname, 'sitemap.xml');
const BASE_URL = 'https://frequency.hamradio.my';

// ── CSV parser (minimal, handles quoted fields with commas) ──────────────
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (char === '\r') {
        // skip
      } else {
        field += char;
      }
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function csvToObjects(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).filter(r => r.length === headers.length).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i]; });
    return obj;
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseNumber(value) {
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}

function formatFreq(value) {
  const f = parseFloat(value);
  return isNaN(f) ? '-' : f.toFixed(5).replace(/\.?0+$/, '') || f.toString();
}

function getBand(freq) {
  const f = parseNumber(freq);
  if (f >= 446 && f <= 446.2) return 'PMR';
  if (f < 300) return 'VHF';
  return 'UHF';
}

function getCategory(row) {
  const f = parseNumber(row.Frequency);
  const o = parseNumber(row.Offset);
  if (f >= 446 && f <= 446.2) return 'PMR';
  if (o === 0) return 'Simplex';
  return 'Repeaters';
}

function extractLocation(comment) {
  if (!comment) return '';
  const m = comment.match(/near\s+(.+?)(?:,\s*None|$)/i);
  return m ? m[1].trim() : '';
}

// ── Generate pre-rendered HTML table for all frequencies ─────────────────
function generateSeoTable(rows) {
  const groups = { Repeaters: [], Simplex: [], PMR: [] };
  rows.forEach(r => {
    const cat = getCategory(r);
    if (groups[cat]) groups[cat].push(r);
  });

  const sections = [];

  for (const cat of ['Repeaters', 'Simplex', 'PMR']) {
    const groupRows = groups[cat];
    if (groupRows.length === 0) continue;

    const title = cat === 'PMR'
      ? 'PMR446 Frequencies Malaysia (446 MHz)'
      : cat === 'Repeaters'
        ? 'Malaysian Amateur Radio Repeaters'
        : 'Simplex Frequencies Malaysia';

    const rowsHtml = groupRows.map(r => {
      const freq = formatFreq(r.Frequency);
      const offset = parseNumber(r.Offset);
      const offsetText = offset !== 0 ? `${r.Duplex || '-'}${offset} MHz` : 'Simplex';
      const tone = r.Tone ? `${r.Tone} ${r.rToneFreq || ''}`.trim() : '-';
      const band = getBand(r.Frequency);
      const location = extractLocation(r.Comment) || r.Comment || r.Name || '-';
      const lat = r.Latitude || '';
      const lon = r.Longitude || '';
      const mapsLink = lat && lon
        ? `<a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}" target="_blank" rel="noopener">${escapeHtml(location)}</a>`
        : escapeHtml(location);

      return `        <tr>
          <td>${escapeHtml(r.Name || '-')}</td>
          <td>${freq} MHz</td>
          <td>${band}</td>
          <td>${offsetText}</td>
          <td>${escapeHtml(tone)}</td>
          <td>${escapeHtml(r.Mode || 'FM')}</td>
          <td>${mapsLink}</td>
        </tr>`;
    }).join('\n');

    sections.push(`    <section>
      <h2>${title}</h2>
      <p>${groupRows.length} ${cat === 'PMR' ? 'PMR446 channels' : cat === 'Repeaters' ? 'repeater entries' : 'simplex channels'} for Malaysian amateur radio operators.</p>
      <table>
        <thead>
          <tr><th>Name / Callsign</th><th>Frequency</th><th>Band</th><th>Offset</th><th>Tone (CTCSS)</th><th>Mode</th><th>Location</th></tr>
        </thead>
        <tbody>
${rowsHtml}
        </tbody>
      </table>
    </section>`);
  }

  return sections.join('\n\n');
}

// ── Generate JSON-LD structured data ─────────────────────────────────────
function generateJsonLd(rows) {
  const repeaters = rows.filter(r => {
    const f = parseNumber(r.Frequency);
    const o = parseNumber(r.Offset);
    return o !== 0 && !(f >= 446 && f <= 446.2);
  });

  const dataset = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    'name': 'Malaysian Amateur Radio Frequency Database',
    'description': 'A curated, searchable collection of simplex, repeater, and PMR446 frequencies for Malaysian amateur radio operators. CHIRP-compatible CSV download available.',
    'url': `${BASE_URL}/`,
    'creator': {
      '@type': 'Person',
      'name': '9M2PJU',
      'url': 'https://hamradio.my'
    },
    'license': 'https://www.gnu.org/licenses/gpl-3.0.html',
    'isAccessibleForFree': true,
    'keywords': ['ham radio', 'amateur radio', 'Malaysia', 'repeater', 'simplex', 'PMR446', 'VHF', 'UHF', 'CHIRP', '9M2PJU', 'frequency database'],
    'distribution': {
      '@type': 'DataDownload',
      'encodingFormat': 'text/csv',
      'contentUrl': `${BASE_URL}/9M2PJU.csv`
    },
    'temporalCoverage': '2024/' + new Date().getFullYear(),
    'spatialCoverage': {
      '@type': 'Place',
      'name': 'Malaysia',
      'geo': {
        '@type': 'GeoCoordinates',
        'latitude': 3.1390,
        'longitude': 101.6869
      }
    }
  };

  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': 'Malaysian Amateur Radio Frequency Database',
    'url': `${BASE_URL}/`,
    'logo': `${BASE_URL}/icon-512x512.png`,
    'founder': {
      '@type': 'Person',
      'name': '9M2PJU',
      'url': 'https://hamradio.my'
    },
    'areaServed': 'Malaysia',
    'sameAs': [
      'https://github.com/9M2PJU/9M2PJU-Malaysian-Ham-Radio-Simplex-and-Repeater-Frequencies'
    ]
  };

  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': [
      {
        '@type': 'Question',
        'name': 'What frequencies do Malaysian ham radio operators use?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Malaysian amateur radio operators use VHF (144–148 MHz) and UHF (430–440 MHz) bands for simplex and repeater operation. This database contains over 180 curated frequencies including repeaters, simplex channels, APRS, and PMR446.'
        }
      },
      {
        '@type': 'Question',
        'name': 'How do I program my walkie talkie with Malaysian frequencies?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Download the 9M2PJU.csv file from this site and import it into CHIRP radio programming software. CHIRP supports Baofeng, Yaesu, Icom, Kenwood, and Wouxun radios. Connect your radio via programming cable, open CHIRP, import the CSV, and upload to your device.'
        }
      },
      {
        '@type': 'Question',
        'name': 'What is the APRS frequency in Malaysia?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'The APRS (Automatic Packet Reporting System) frequency in Malaysia is 144.390 MHz, which is the same as the global APRS standard.'
        }
      },
      {
        '@type': 'Question',
        'name': 'What are PMR446 frequencies in Malaysia?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'PMR446 in Malaysia uses 16 channels from 446.00625 MHz to 446.19375 MHz with 12.5 kHz spacing. These are license-free channels for personal use with a maximum power of 0.5W.'
        }
      },
      {
        '@type': 'Question',
        'name': 'Do I need a license to operate amateur radio in Malaysia?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Yes, you need an Amateur Radio Operating Certificate (AROC) issued by the Malaysian Communications and Multimedia Commission (MCMC). PMR446 channels are license-free for personal use.'
        }
      },
      {
        '@type': 'Question',
        'name': 'What CTCSS tone do Malaysian repeaters use?',
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': 'Malaysian repeaters use various CTCSS tones. Common tones include 88.5 Hz, 203.5 Hz, 103.5 Hz, and 118.8 Hz. Each repeater in the database lists its specific required tone for access.'
        }
      }
    ]
  };

  // Build a list of repeater entities for structured data
  const repeaterItems = repeaters.slice(0, 30).map(r => {
    const freq = formatFreq(r.Frequency);
    const item = {
      '@type': 'Thing',
      'name': r.Name,
      'description': `${r.Name} — Malaysian amateur radio repeater at ${freq} MHz${r.Comment ? '. ' + r.Comment : ''}`
    };
    return item;
  });

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': 'Malaysian Amateur Radio Repeaters',
    'itemListElement': repeaterItems.map((item, i) => ({
      '@type': 'ListItem',
      'position': i + 1,
      'item': item
    }))
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': 'Malaysian Amateur Radio Frequency Database',
    'url': `${BASE_URL}/`,
    'description': 'Curated simplex, repeater, and PMR446 frequencies for Malaysian amateur radio operators.',
    'potentialAction': {
      '@type': 'SearchAction',
      'target': `${BASE_URL}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };

  return [website, organization, dataset, faq, itemList];
}

// ── Generate sitemap.xml ─────────────────────────────────────────────────
function generateSitemap(pages) {
  const today = new Date().toISOString().split('T')[0];
  const urls = pages.map(p => `  <url>
    <loc>${BASE_URL}/${p.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.freq || 'monthly'}</changefreq>
    <priority>${p.priority || '0.8'}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

// ── Main: inject pre-rendered content into index.html ────────────────────
function buildIndex() {
  const csvText = fs.readFileSync(CSV_FILE, 'utf-8');
  const rows = csvToObjects(csvText).filter(r => r.Name || r.Frequency);
  const html = fs.readFileSync(HTML_FILE, 'utf-8');

  const seoTable = generateSeoTable(rows);
  const jsonLdBlocks = generateJsonLd(rows);

  // Build JSON-LD script tags
  const jsonLdHtml = jsonLdBlocks
    .map(data => `  <script type="application/ld+json">\n${JSON.stringify(data, null, 2)}\n  </script>`)
    .join('\n');

  // Build the SEO content section — visible to crawlers, hidden visually
  // (JS app replaces #output with interactive content)
  const seoSection = `
  <!-- SEO: Pre-rendered frequency data for search engine crawlers -->
  <!-- The interactive JS app replaces #output; this content ensures crawlers
       and no-JS users can see all frequency data. -->
  <section id="seo-content" class="sr-only" aria-label="Complete Malaysian amateur radio frequency listing">
    <h2>Complete Malaysian Amateur Radio Frequency List</h2>
    <p>
      The Malaysian Amateur Radio Frequency Database by 9M2PJU is a curated,
      searchable collection of ${rows.length} frequencies for amateur radio
      operators in Malaysia. It covers VHF (144–148 MHz), UHF (430–440 MHz),
      and PMR446 (446 MHz) bands, including repeater channels with CTCSS/DCS
      tones, simplex calling channels, APRS (144.390 MHz), and all 16 PMR446
      license-free channels. The database is CHIRP-compatible and can be
      downloaded as a CSV file for direct programming of Baofeng, Yaesu, Icom,
      Kenwood, and Wouxun radios.
    </p>
    <p>
      Malaysian repeaters listed include stations in Kuala Lumpur, Selangor,
      Pahang, Penang, Melaka, Johor, Kedah, Perak, Perlis, Terengganu,
      Kelantan, Sabah, and Sarawak. Major repeater sites include Bukit Lanjan,
      Gunung Ulu Kali, Bukit Brinchang, Gunung Ledang, Bukit Bendera (Penang
      Hill), Gunung Jerai, Gunung Kinabalu, and Borneo Highlands. Repeaters
      are linked via MARTS (Malaysian Amateur Radio Transmitters' Society) and
      ASTRA Transnasional linking networks.
    </p>
${seoTable}
    <h2>How to Use This Database</h2>
    <p>
      Use the search box to find frequencies by callsign, location, or tone.
      Filter by band (VHF, UHF) or type (Simplex, Repeaters). Click "Near Me"
      to sort repeaters by distance from your location. Download the CSV file
      and import it into <a href="https://chirp.danplanet.com" rel="noopener">CHIRP</a>
      radio programming software to program your walkie-talkie or mobile radio.
      See our <a href="chirp-guide.html">CHIRP programming guide</a> for
      step-by-step instructions.
    </p>
    <p>
      For license-free personal use, see our <a href="pmr446-guide.html">PMR446
      guide</a>. For information on amateur radio bands in Malaysia, see our
      <a href="bands-guide.html">Malaysian ham radio bands guide</a>. For
      frequently asked questions, visit our <a href="faq.html">FAQ page</a>.
      To learn more about this project, visit the <a href="about.html">about
      page</a>.
    </p>
  </section>

  <!-- JSON-LD Structured Data for SEO -->
${jsonLdHtml}
`;

  // Check if there's already an SEO section and replace it
  let newHtml;
  const seoMarkerStart = '<!-- SEO: Pre-rendered frequency data';
  const seoMarkerEnd = '<!-- /SEO -->';

  if (html.includes(seoMarkerStart)) {
    // Replace existing SEO section
    const startIdx = html.indexOf(seoMarkerStart);
    // Find the start of the line (go back to find the indentation)
    const lineStart = html.lastIndexOf('\n', startIdx) + 1;
    const endIdx = html.indexOf(seoMarkerEnd);
    if (endIdx !== -1) {
      const afterEnd = html.indexOf('\n', endIdx) + 1;
      newHtml = html.substring(0, lineStart) + seoSection + '  <!-- /SEO -->\n' + html.substring(afterEnd);
    } else {
      newHtml = html;
    }
  } else {
    // Insert SEO section before the <!-- Toast Container --> comment
    const insertPoint = '  <!-- Toast Container -->';
    if (html.includes(insertPoint)) {
      newHtml = html.replace(insertPoint, seoSection + '  <!-- /SEO -->\n\n' + insertPoint);
    } else {
      // Fallback: insert before </body>
      newHtml = html.replace('</body>', seoSection + '  <!-- /SEO -->\n</body>');
    }
  }

  // Also add geo meta tags if not present
  if (!newHtml.includes('name="geo.region"')) {
    const geoTags = `  <meta name="geo.region" content="MY" />
  <meta name="geo.placename" content="Malaysia" />
  <meta name="geo.position" content="3.1390;101.6869" />
  <meta name="ICBM" content="3.1390, 101.6869" />
`;
    // Insert after the twitter:image meta tag
    newHtml = newHtml.replace(
      '  <meta name="twitter:image" content="https://frequency.hamradio.my/my_flag_round.svg" />',
      '  <meta name="twitter:image" content="https://frequency.hamradio.my/my_flag_round.svg" />\n' + geoTags
    );
  }

  fs.writeFileSync(HTML_FILE, newHtml, 'utf-8');
  console.log(`✓ index.html updated with ${rows.length} pre-rendered frequencies and JSON-LD structured data`);
}

// ── Run ──────────────────────────────────────────────────────────────────
buildIndex();

// Generate sitemap with all pages
const pages = [
  { path: '', freq: 'weekly', priority: '1.0' },
  { path: 'faq.html', freq: 'monthly', priority: '0.9' },
  { path: 'about.html', freq: 'monthly', priority: '0.7' },
  { path: 'chirp-guide.html', freq: 'monthly', priority: '0.9' },
  { path: 'pmr446-guide.html', freq: 'monthly', priority: '0.9' },
  { path: 'bands-guide.html', freq: 'monthly', priority: '0.9' },
];
fs.writeFileSync(SITEMAP_FILE, generateSitemap(pages), 'utf-8');
console.log(`✓ sitemap.xml updated with ${pages.length} pages`);
