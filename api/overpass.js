export default async function handler(req, res) {
  // Set CORS headers for Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { lat, lng, radius = 5000 } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing latitude or longitude' });
    }

    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"="hospital"](around:${radius},${lat},${lng});
        way["amenity"="hospital"](around:${radius},${lat},${lng});
        relation["amenity"="hospital"](around:${radius},${lat},${lng});
        node["amenity"="clinic"](around:${radius},${lat},${lng});
        way["amenity"="clinic"](around:${radius},${lat},${lng});
        relation["amenity"="clinic"](around:${radius},${lat},${lng});
        node["healthcare"="hospital"](around:${radius},${lat},${lng});
        way["healthcare"="hospital"](around:${radius},${lat},${lng});
        relation["healthcare"="hospital"](around:${radius},${lat},${lng});
      );
      out center;
    `;

    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    
    // Using native fetch (available in Node.js 18+)
    const response = await fetch(overpassUrl, {
      method: 'POST',
      body: `data=${encodeURIComponent(overpassQuery)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'ZedHospitalFinder/1.0 (https://your-domain.com)'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Overpass API error status:', response.status);
      return res.status(response.status).json({ 
        error: 'Overpass API error', 
        details: errorText 
      });
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
}