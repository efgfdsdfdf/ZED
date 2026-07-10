
import fetch from 'node-fetch';

async function test() {
  const lat = 40.7128;
  const lng = -74.0060;
  const radius = 5000;

  console.log("Testing Nominatim...");
  const latDelta = radius / 111320;
  const lonDivider = Math.cos((lat * Math.PI) / 180) || 1;
  const lonDelta = radius / (111320 * Math.max(Math.abs(lonDivider), 0.2));
  const left = lng - lonDelta;
  const right = lng + lonDelta;
  const top = lat + latDelta;
  const bottom = lat - latDelta;
  const viewbox = `${left},${top},${right},${bottom}`;

  const nominatimBase = 'https://nominatim.openstreetmap.org/search';
  const params = new URLSearchParams({
    q: 'hospital',
    format: 'jsonv2',
    limit: '25',
    bounded: '1',
    viewbox
  });

  try {
    const response = await fetch(`${nominatimBase}?${params.toString()}`, {
      headers: {
        'User-Agent': 'Zed Hospital Finder/1.0 (+https://zed-rho.vercel.app)',
      },
      timeout: 10000
    });
    console.log(`Nominatim Status: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`Found ${data.length} results from Nominatim`);
    } else {
      console.log(`Nominatim Error: ${await response.text()}`);
    }
  } catch (error) {
    console.error(`Nominatim Failed: ${error.message}`);
  }
}

test();
