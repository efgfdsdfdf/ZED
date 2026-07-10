
import fetch from 'node-fetch';

async function test() {
  const lat = 40.7128;
  const lng = -74.0060;
  const radius = 5000;

  const query = `[out:json][timeout:25];(
    node["amenity"~"^(hospital|clinic)$"](around:${radius},${lat},${lng});
    way["amenity"~"^(hospital|clinic)$"](around:${radius},${lat},${lng});
    relation["amenity"~"^(hospital|clinic)$"](around:${radius},${lat},${lng});
    node["healthcare"~"^(hospital|clinic)$"](around:${radius},${lat},${lng});
    way["healthcare"~"^(hospital|clinic)$"](around:${radius},${lat},${lng});
    relation["healthcare"~"^(hospital|clinic)$"](around:${radius},${lat},${lng});
  );out center tags;`;

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint}...`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain; charset=UTF-8',
        },
        body: query,
        timeout: 10000
      });

      console.log(`Status: ${response.status}`);
      if (response.ok) {
        const data = await response.json();
        console.log(`Found ${data.elements?.length} elements`);
        return;
      } else {
        const text = await response.text();
        console.log(`Error: ${text.slice(0, 100)}`);
      }
    } catch (error) {
      console.error(`Failed: ${error.message}`);
    }
  }
}

test();
