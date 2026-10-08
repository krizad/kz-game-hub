import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Original code-authored vector scenes. No external images, fonts or reference cards.
const destination = fileURLToPath(
  new URL('../docs/archive/cluecanvas-vector-deck/', import.meta.url),
);
mkdirSync(destination, { recursive: true });

const motifs = {
  key: '<circle cx="35" cy="40" r="22" fill="none"/><path d="M55 40h62v16h-16v16H83V56H55"/>',
  ladder: '<path d="M30 10v115M95 10v115M30 28h65M30 50h65M30 72h65M30 94h65" fill="none"/>',
  umbrella:
    '<path d="M5 55Q62-25 120 55Q102 42 82 55Q62 42 43 55Q23 42 5 55Z"/><path d="M62 55v50q0 23 25 10" fill="none"/>',
  book: '<path d="M62 25Q30 0 5 14v82q30-12 57 12 30-24 57-12V14Q92 0 62 25Z"/><path d="M62 25v82M20 34l27 8M20 55l27 8M78 42l27-8M78 63l27-8" fill="none"/>',
  balloon:
    '<ellipse cx="62" cy="40" rx="36" ry="44"/><path d="M62 84l-10 16h20ZM62 101q-30 10 0 25t-5 30" fill="none"/>',
  window: '<path d="M15 115V45a47 47 0 0 1 94 0v70Z"/><path d="M62 0v115M15 58h94" fill="none"/>',
  bridge:
    '<path d="M0 105h124M10 95V25M114 95V25M10 30q52 65 104 0M28 52v43M47 65v30M77 65v30M97 52v43" fill="none"/>',
  boat: '<path d="M3 95h118l-27 25H28Z"/><path d="M62 5v90L8 80ZM71 22l40 57H71Z"/>',
  mountain:
    '<path d="M0 120L46 10l34 71 20-42 24 81Z"/><path d="M31 45l15-35 17 35-17-7Z" fill="#fff7e8"/>',
  lantern:
    '<path d="M31 25h62l8 75H23ZM30 105h65M40 13q23-26 46 0M62 49q-30 35 0 40 30-5 0-40Z"/><path d="M20 30h85" fill="none"/>',
  teapot:
    '<ellipse cx="57" cy="77" rx="38" ry="34"/><path d="M26 64L2 43l6 35 19 12M90 65q43-35 25 17L92 95M25 40h64M55 28v12" fill="none"/>',
  moon: '<path d="M88 5C-17 0-25 130 91 118 27 101 20 34 88 5Z"/>',
  hourglass:
    '<path d="M20 5h84M20 120h84M28 5q0 42 34 57-34 22-34 58M96 5q0 42-34 57 34 22 34 58" fill="none"/><path d="M40 96l22-22 23 22Z"/>',
  tree: '<path d="M62 55v72M62 98L37 77M62 82l24-20" fill="none"/><circle cx="62" cy="35" r="29"/><circle cx="31" cy="57" r="26"/><circle cx="94" cy="54" r="27"/>',
  cloud:
    '<path d="M25 85C-8 85-4 40 25 42 19 4 77-6 83 35c45-10 57 50 16 50Z"/><path d="M32 101l-6 22M62 101l-6 22M93 101l-6 22" fill="none"/>',
  telescope:
    '<path d="M14 45l70-30 15 30-70 30ZM62 63v58M62 82l-28 39M62 82l28 39"/><path d="M99 15l13-5 17 36-14 6Z"/>',
  feather:
    '<path d="M20 115C-10 55 17-5 110 5 109 95 77 120 20 115Z"/><path d="M10 126L95 21M28 107l-8-29M47 86l35 4M66 62l-8-27" fill="none"/>',
  door: '<path d="M25 120V35a37 37 0 0 1 74 0v85Z"/><path d="M39 120V35a23 23 0 0 1 46 0v85" fill="none"/><circle cx="72" cy="77" r="5" fill="#fff7e8"/>',
  stairs:
    '<path d="M4 120V96h28V72h28V48h28V24h30v96Z"/><path d="M4 96h28M32 72h28M60 48h28" fill="none"/>',
  compass:
    '<circle cx="62" cy="63" r="53" fill="none"/><path d="M62 14l20 49-20 49-20-49Z"/><path d="M14 63h28M82 63h28" fill="none"/>',
};
const palettes = [
  ['#F2D7B6', '#BC6452', '#2C5559', '#E8B354'],
  ['#D6E7DA', '#D18B51', '#355769', '#ECC577'],
  ['#D9DDEE', '#AD6881', '#424F72', '#BBA962'],
  ['#FAE4C9', '#668A83', '#5F4564', '#E09557'],
];
const subjects = Object.keys(motifs);
const definitions = subjects
  .map(
    (name) =>
      `<g id="${name}" stroke="currentColor" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">${motifs[name]}</g>`,
  )
  .join('');
const manifest = [];
for (let setting = 0; setting < 4; setting++) {
  for (let subject = 0; subject < subjects.length; subject++) {
    const number = setting * subjects.length + subject + 1;
    const [paper, accent, ink, sun] = palettes[(subject + setting) % palettes.length];
    const main = subjects[subject];
    const companion = subjects[(subject * 7 + setting * 3 + 5) % subjects.length];
    const sky = [
      `<circle cx="224" cy="86" r="39" fill="${sun}"/><path d="M0 265Q80 185 154 245T300 232V420H0Z" fill="${accent}"/>`,
      `<path d="M0 180L100 80l110 113 90-78v305H0Z" fill="${accent}"/><path d="M0 295Q90 245 150 290t150-4v134H0Z" fill="${sun}"/>`,
      `<path d="M0 284q60-48 120 0t120 0t120 0v136H0Z" fill="${accent}"/><path d="M0 330q50-24 100 0t100 0t100 0" stroke="${ink}" stroke-width="6" fill="none"/><circle cx="66" cy="77" r="32" fill="${sun}"/>`,
      `<path d="M0 355V258h39v-55h55v77h40v-91h43v-53h50v122h73v97Z" fill="${accent}"/><path d="M39 280h20v25H39M154 224h18v30h-18M241 302h21v26h-21" fill="${sun}"/>`,
    ][setting];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420"><defs>${definitions}</defs><rect width="300" height="420" fill="${paper}"/>${sky}<path d="M25 30h72M25 39h42M221 380h52M235 389h38" stroke="${ink}" stroke-width="3" opacity=".35"/><circle cx="150" cy="220" r="78" fill="${paper}" opacity=".9"/><g color="${ink}" fill="${sun}" transform="translate(77 148) scale(1.18)"><use href="#${main}"/></g><g color="${ink}" fill="${accent}" transform="translate(206 48) scale(.46)"><use href="#${companion}"/></g><path d="M35 338q42-28 66 2M176 356q30-25 58 0" fill="none" stroke="${ink}" stroke-width="3" stroke-dasharray="6 6"/><rect x="8" y="8" width="284" height="404" rx="18" fill="none" stroke="${ink}" stroke-width="3"/></svg>\n`;
    const filename = `card_${String(number).padStart(3, '0')}.svg`;
    writeFileSync(destination + filename, svg);
    manifest.push({
      filename,
      subject: main,
      companion,
      setting: ['hills', 'valley', 'water', 'city'][setting],
    });
  }
}
writeFileSync(
  destination + 'manifest.json',
  JSON.stringify(
    {
      title: 'Cluecanvas original vector deck',
      source: 'scripts/generate-cluecanvas-deck.mjs',
      created: '2026-10-08',
      provenance:
        'Code-authored geometric illustrations; no external image files or fonts used. This records the creation method, not a legal clearance.',
      cards: manifest,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Created ${manifest.length} vector scene cards.`);
