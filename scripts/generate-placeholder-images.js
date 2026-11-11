const fs = require('fs');
const path = require('path');

const venues = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'venues-seed.json'), 'utf8'));
const outDir = path.join(__dirname, '..', 'assets', 'venues');

const palettes = [
  ['#7c3aed', '#c026d3'],
  ['#0ea5e9', '#22d3ee'],
  ['#f59e0b', '#ef4444'],
  ['#16a34a', '#84cc16'],
  ['#db2777', '#f97316'],
  ['#4f46e5', '#06b6d4'],
  ['#dc2626', '#f59e0b'],
  ['#0891b2', '#7c3aed']
];

function initials(name) {
  return name
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

venues.forEach((venue, i) => {
  const [c1, c2] = palettes[i % palettes.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="400" height="260" fill="url(#g)"/>
  <circle cx="330" cy="40" r="70" fill="rgba(255,255,255,0.08)"/>
  <circle cx="40" cy="230" r="90" fill="rgba(255,255,255,0.08)"/>
  <text x="200" y="145" font-family="Segoe UI, Arial, sans-serif" font-size="64" font-weight="700"
        fill="rgba(255,255,255,0.92)" text-anchor="middle" dominant-baseline="middle">${initials(venue.name)}</text>
  <text x="200" y="225" font-family="Segoe UI, Arial, sans-serif" font-size="15" letter-spacing="2"
        fill="rgba(255,255,255,0.75)" text-anchor="middle">PLACEHOLDER SLIKA</text>
</svg>`;
  fs.writeFileSync(path.join(outDir, `${venue.slug}.svg`), svg);
});

console.log(`Generisano ${venues.length} placeholder slika u assets/venues/`);
