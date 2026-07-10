import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.envv', override: false });

import express from 'express';
import cors from 'cors';

import anthropicRouter from './backend/anthropic.js';
import telemedicineRouter from './backend/telemedicine/routes.js';
import subscriptionRouter from './backend/subscription.routes.js';
import { requireAuth, checkChatLimit } from './backend/middleware.js';

// Debug: check if key is loaded
console.log('🔑 OPENAI_API_KEY loaded:', process.env.OPENAI_API_KEY ? 'YES' : 'NO');
if (process.env.OPENAI_API_KEY) {
  console.log('   Prefix:', process.env.OPENAI_API_KEY.substring(0, 15) + '...');
}

const app = express();
const VERSION = '1.0.2';
console.log(`🚀 Zed Server ${VERSION} starting...`);
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://cenplbwpjycxotctvjmz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ADMIN_DASHBOARD_KEY = process.env.ADMIN_DASHBOARD_KEY || '';

// Enhanced startup logging for Vercel debugging
console.log('🌐 SUPABASE_URL:', SUPABASE_URL);
console.log('🔑 SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'Set (' + SUPABASE_SERVICE_ROLE_KEY.substring(0, 8) + '...)' : 'MISSING');
console.log('🔑 ADMIN_DASHBOARD_KEY:', ADMIN_DASHBOARD_KEY ? 'Set (' + ADMIN_DASHBOARD_KEY.substring(0, 3) + '...)' : 'MISSING');


app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY)
  });
});

// OpenAI proxy endpoint – matches the URL expected by ZedAI
app.post('/api/openai', async (req, res) => {
  try {
    console.log('➡️  Received request for /api/openai');
    console.log('🤖 AI Model requested:', req.body.model || 'gpt-4o');

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY is missing on the server'
      });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(req.body)  // Forward the entire body as-is
    });

    console.log('⬅️  OpenAI status:', response.status);

    const data = await response.json().catch(() => ({}));
    console.log('   Response data:', JSON.stringify(data).substring(0, 200) + '...');

    res.status(response.status).json(data);
  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({ error: error.message || 'Failed to reach OpenAI API' });
  }
});

app.post('/api/overpass', async (req, res) => {
  try {
    const hospitalFetch = async (url, options = {}) => {
      const { timeout = 12000, ...fetchOptions } = options;
      
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal
        });
        clearTimeout(id);
        return response;
      } catch (error) {
        clearTimeout(id);
        console.error(`❌ Fetch failed for ${url}:`, error.message);
        throw error;
      }
    };
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const requestedRadius = Number(req.body?.radius);
    const radius = Number.isFinite(requestedRadius)
      ? Math.min(Math.max(Math.round(requestedRadius), 500), 20000)
      : 5000;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Valid lat and lng are required.' });
    }

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

    const failures = [];

    for (const endpoint of endpoints) {
      try {
        const response = await hospitalFetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain; charset=UTF-8',
            'User-Agent': 'Zed Hospital Finder/1.0 (+https://zed-rho.vercel.app)',
            Referer: 'https://zed-rho.vercel.app/hospitals.html'
          },
          body: query
        });

        if (!response.ok) {
          const details = await response.text().catch(() => 'No details');
          failures.push(`${endpoint} -> ${response.status}: ${details.slice(0, 100)}`);
          continue;
        }

        const data = await response.json().catch(() => null);
        if (data && data.elements) {
          res.set('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
          return res.json(data);
        } else {
          failures.push(`${endpoint} -> Invalid JSON or missing elements`);
        }
      } catch (error) {
        failures.push(`${endpoint} -> ${error.name === 'AbortError' ? 'Timeout' : (error.message || 'Request failed')}`);
      }
    }

    const latDelta = radius / 111320;
    const lonDivider = Math.cos((lat * Math.PI) / 180) || 1;
    const lonDelta = radius / (111320 * Math.max(Math.abs(lonDivider), 0.2));
    const left = lng - lonDelta;
    const right = lng + lonDelta;
    const top = lat + latDelta;
    const bottom = lat - latDelta;
    const viewbox = `${left},${top},${right},${bottom}`;
    const nominatimBase = 'https://nominatim.openstreetmap.org/search';
    const nominatimHeaders = {
      'User-Agent': 'Zed Hospital Finder/1.0 (+https://zed-rho.vercel.app)',
      Referer: 'https://zed-rho.vercel.app/hospitals.html',
      Accept: 'application/json'
    };
    const nominatimQueries = [
      { q: 'hospital', tag: 'hospital' },
      { q: 'clinic', tag: 'clinic' }
    ];
    const nominatimResults = [];

    for (let index = 0; index < nominatimQueries.length; index += 1) {
      const { q, tag } = nominatimQueries[index];
      const params = new URLSearchParams({
        q,
        format: 'jsonv2',
        limit: '25',
        addressdetails: '1',
        extratags: '1',
        namedetails: '1',
        bounded: '1',
        viewbox
      });

      try {
        const response = await hospitalFetch(`${nominatimBase}?${params.toString()}`, {
          headers: nominatimHeaders
        });

        if (!response.ok) {
          const details = await response.text().catch(() => 'No details');
          failures.push(`Nominatim ${q} -> ${response.status}: ${details.slice(0, 100)}`);
        } else {
          const rows = await response.json().catch(() => []);
          const normalizedRows = Array.isArray(rows) ? rows.map((row) => ({ ...row, _zedTag: tag })) : [];
          nominatimResults.push(...normalizedRows);
        }
      } catch (error) {
        failures.push(`Nominatim ${q} -> ${error.name === 'AbortError' ? 'Timeout' : (error.message || 'Request failed')}`);
      }

      if (index < nominatimQueries.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
    }

    if (nominatimResults.length) {
      const seen = new Set();
      const elements = [];

      for (const place of nominatimResults) {
        const placeId = String(place.place_id || `${place.osm_type || 'node'}-${place.osm_id || Math.random()}`);
        const dedupeKey = `${place.osm_type || 'node'}:${place.osm_id || placeId}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const tags = {
          name: place.namedetails?.name || String(place.display_name || '').split(',')[0] || 'Unnamed hospital',
          phone: place.extratags?.phone || place.extratags?.['contact:phone'] || '',
          amenity: place._zedTag === 'clinic' ? 'clinic' : 'hospital'
        };

        const addr = place.address || {};
        if (addr.road) tags['addr:street'] = addr.road;
        if (addr.house_number) tags['addr:housenumber'] = addr.house_number;
        if (addr.city || addr.town || addr.village || addr.hamlet || addr.county) {
          tags['addr:city'] = addr.city || addr.town || addr.village || addr.hamlet || addr.county;
        }
        if (place.display_name) tags.display_name = place.display_name;

        elements.push({
          type: 'node',
          id: `nominatim-${placeId}`,
          lat: Number(place.lat),
          lon: Number(place.lon),
          tags
        });
      }

      res.set('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
      res.set('X-Zed-Source', 'nominatim');
      return res.json({ elements });
    }

    console.warn('⚠️ All hospital data providers failed:', failures);
    return res.status(502).json({
      error: 'All hospital data providers failed.',
      details: failures,
      version: VERSION
    });
  } catch (error) {
    console.error('❌ Overpass proxy error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to load hospital data',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      version: VERSION
    });
  }
});

function hasAdminSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function adminGuard(req, res, next) {
  if (!ADMIN_DASHBOARD_KEY) {
    return res.status(503).json({
      error: 'ADMIN_DASHBOARD_KEY is not configured on the server'
    });
  }
  const provided = req.header('x-admin-key');
  if (!provided || provided !== ADMIN_DASHBOARD_KEY) {
    return res.status(401).json({ error: 'Invalid admin key' });
  }
  next();
}

async function supabaseRest(path, options = {}) {
  const method = options.method || 'GET';
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Supabase REST error ${response.status}: ${errBody || 'Unknown error'}`);
  }

  return response.json().catch(() => []);
}

async function supabaseAuthAdmin(path, options = {}) {
  const method = options.method || 'GET';
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.msg || data?.message || `Supabase auth admin error ${response.status}`);
  }
  return data;
}

async function readTableSafe(path) {
  try {
    return await supabaseRest(path);
  } catch (error) {
    if (String(error.message || '').includes('42P01')) return [];
    throw error;
  }
}

async function readAppointmentsOverviewSafe(limit = 1000) {

  const datePath = `appointments?select=id,user_id,status,appointment_date,created_at&order=created_at.desc&limit=${limit}`;
  const atPath = `appointments?select=id,user_id,status,appointment_at,created_at&order=created_at.desc&limit=${limit}`;

  try {
    return await readTableSafe(datePath);
  } catch (error) {
    const msg = String(error?.message || '');
    if (msg.includes('42703') && msg.includes('appointment_date')) {
      return await readTableSafe(atPath);
    }
    throw error;
  }
}

async function listAllAuthUsers(maxPages = 10, perPage = 1000) {
  const users = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await supabaseAuthAdmin(`users?page=${page}&per_page=${perPage}`);
    const batch = Array.isArray(data?.users) ? data.users : [];
    users.push(...batch);
    if (batch.length < perPage) break;
  }
  return users;
}

async function getAuthUserById(userId) {
  if (!userId) return null;
  try {
    const data = await supabaseAuthAdmin(`users/${encodeURIComponent(userId)}`);
    return data?.user || data || null;
  } catch (_) {
    return null;
  }
}

function authNameParts(user) {
  const meta = user?.user_metadata || {};
  const first = meta.first_name || meta.given_name || null;
  const last = meta.last_name || meta.family_name || null;
  if (first || last) return { first_name: first, last_name: last };

  const full = meta.full_name || meta.name || null;
  if (typeof full === 'string' && full.trim()) {
    const parts = full.trim().split(/\s+/);
    return {
      first_name: parts[0] || null,
      last_name: parts.slice(1).join(' ') || null
    };
  }
  return { first_name: null, last_name: null };
}

function countBy(rows, key) {
  const map = {};
  (rows || []).forEach((row) => {
    const id = row?.[key];
    if (!id) return;
    map[id] = (map[id] || 0) + 1;
  });
  return map;
}

app.get('/api/admin/overview', adminGuard, async (req, res) => {
  try {
    if (!hasAdminSupabaseConfig()) {
      return res.status(503).json({
        error: 'SUPABASE_SERVICE_ROLE_KEY is missing. Set SUPABASE_SERVICE_ROLE_KEY to enable admin overview.'
      });
    }

    const [
      profiles,
      authUsers,
      chatSessions,
      chatMessages,
      vitals,
      symptoms,
      reports,
      tips,
      appointments,
      notifications,
      medicineScans,
      activityLogs
    ] = await Promise.all([
      // Reduced limits for Vercel/Serverless performance
      readTableSafe('profiles?select=id,first_name,last_name,age,gender,blood_group,updated_at&limit=1000'),
      listAllAuthUsers(5, 500), // Max 2500 users for overview
      readTableSafe('chat_sessions?select=id,user_id,title,created_at,updated_at&order=updated_at.desc&limit=1000'),
      readTableSafe('chat_messages?select=id,session_id,role,created_at&order=created_at.desc&limit=1000'),
      readTableSafe('vitals_log?select=id,user_id,recorded_at&order=recorded_at.desc&limit=1000'),
      readTableSafe('symptom_checks?select=id,user_id,area,severity,created_at&order=created_at.desc&limit=1000'),
      readTableSafe('medical_reports?select=id,user_id,file_name,analysis_type,analyzed_at&order=analyzed_at.desc&limit=1000'),
      readTableSafe('health_tips?select=id,user_id,category,generated_at&order=generated_at.desc&limit=1000'),
      readAppointmentsOverviewSafe(1000),
      readTableSafe('notifications?select=id,user_id,read,created_at&order=created_at.desc&limit=1000'),
      readTableSafe('medicine_scans?select=id,user_id,drug_name,scanned_at&order=scanned_at.desc&limit=1000'),
      readTableSafe('zed_activity_logs?select=id,user_id,event_type,event_label,page,metadata,created_at&order=created_at.desc&limit=2000')
    ]);


    const sessionOwner = {};
    chatSessions.forEach((s) => { if (s?.id) sessionOwner[s.id] = s.user_id; });

    const chatMessageByUser = {};
    chatMessages.forEach((m) => {
      const uid = sessionOwner[m.session_id];
      if (!uid) return;
      chatMessageByUser[uid] = (chatMessageByUser[uid] || 0) + 1;
    });

    const bySession = countBy(chatSessions, 'user_id');
    const byVitals = countBy(vitals, 'user_id');
    const bySymptoms = countBy(symptoms, 'user_id');
    const byReports = countBy(reports, 'user_id');
    const byTips = countBy(tips, 'user_id');
    const byAppointments = countBy(appointments, 'user_id');
    const byNotifications = countBy(notifications, 'user_id');
    const byMedicineScans = countBy(medicineScans, 'user_id');
    const byEvents = countBy(activityLogs, 'user_id');

    const userLastEvent = {};
    activityLogs.forEach((evt) => {
      if (!evt?.user_id || userLastEvent[evt.user_id]) return;
      userLastEvent[evt.user_id] = evt.created_at;
    });

    const profileById = {};
    (profiles || []).forEach((p) => { profileById[p.id] = p; });
    const authUserById = {};
    (authUsers || []).forEach((u) => { if (u?.id) authUserById[u.id] = u; });

    const allUserIds = new Set([
      ...Object.keys(profileById),
      ...Object.keys(byEvents),
      ...Object.keys(bySession),
      ...Object.keys(chatMessageByUser),
      ...Object.keys(byVitals),
      ...Object.keys(bySymptoms),
      ...Object.keys(byReports),
      ...Object.keys(byTips),
      ...Object.keys(byAppointments),
      ...Object.keys(byNotifications),
      ...Object.keys(byMedicineScans)
    ]);

    let users = Array.from(allUserIds).map((userId) => {
      const p = profileById[userId] || {};
      const auth = authUserById[userId] || {};
      const authNames = authNameParts(auth);
      const first_name = p.first_name || authNames.first_name || null;
      const last_name = p.last_name || authNames.last_name || null;
      return {
        id: userId,
        email: auth.email || null,
        first_name,
        last_name,
        age: p.age || null,
        gender: p.gender || null,
        blood_group: p.blood_group || null,
        updated_at: p.updated_at || null,
        last_event_at: userLastEvent[userId] || null,
        last_seen: userLastEvent[userId] || p.updated_at || null,
        stats: {
          events: byEvents[userId] || 0,
          chat_sessions: bySession[userId] || 0,
          chat_messages: chatMessageByUser[userId] || 0,
          vitals: byVitals[userId] || 0,
          symptoms: bySymptoms[userId] || 0,
          reports: byReports[userId] || 0,
          tips: byTips[userId] || 0,
          appointments: byAppointments[userId] || 0,
          notifications: byNotifications[userId] || 0,
          medicine_scans: byMedicineScans[userId] || 0
        }
      };
    });

    // Fallback: fetch missing auth users one-by-one so email is populated whenever possible.
    const missingEmailUsers = users.filter((u) => !u.email && u.id);
    if (missingEmailUsers.length) {
      const fetched = await Promise.all(
        missingEmailUsers.map((u) => getAuthUserById(u.id))
      );
      const fetchedById = {};
      fetched.forEach((u) => { if (u?.id) fetchedById[u.id] = u; });
      users = users.map((u) => {
        if (u.email) return u;
        const auth = fetchedById[u.id] || {};
        const names = authNameParts(auth);
        return {
          ...u,
          email: auth.email || null,
          first_name: u.first_name || names.first_name || null,
          last_name: u.last_name || names.last_name || null
        };
      });
    }

    const userIdentityById = {};
    users.forEach((u) => {
      const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || null;
      userIdentityById[u.id] = {
        user_name: name,
        user_email: u.email || null
      };
    });

    const recentActivity = (activityLogs || []).slice(0, 300).map((evt) => {
      const identity = userIdentityById[evt.user_id] || {};
      return {
        ...evt,
        user_name: identity.user_name || null,
        user_email: identity.user_email || null
      };
    });

    const metrics = {
      users: users.length,
      events: activityLogs.length,
      chat_sessions: chatSessions.length,
      chat_messages: chatMessages.length,
      vitals: vitals.length,
      symptoms: symptoms.length,
      reports: reports.length,
      tips: tips.length,
      appointments: appointments.length,
      notifications: notifications.length,
      medicine_scans: medicineScans.length,
      profiles: profiles.length
    };

    res.json({
      mode: 'server',
      generatedAt: new Date().toISOString(),
      metrics,
      users,
      recentActivity
    });
  } catch (error) {
    console.error('❌ Admin overview error:', error);
    // Be more specific in the error response to help debugging
    const errorMessage = error.message || 'Failed to build admin overview';
    res.status(500).json({ 
      error: errorMessage,
      details: error.toString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      hint: 'Check Vercel environment variables and Supabase connection. For large datasets, this endpoint may timeout.'
    });
  }
});


app.get('/api/admin/user/:userId', adminGuard, async (req, res) => {
  try {
    if (!hasAdminSupabaseConfig()) {
      return res.status(503).json({
        error: 'SUPABASE_SERVICE_ROLE_KEY is missing. Set SUPABASE_SERVICE_ROLE_KEY to enable admin detail.'
      });
    }

    const userId = encodeURIComponent(req.params.userId);
    const [
      profile,
      sessions,
      vitals,
      symptoms,
      reports,
      tips,
      appointments,
      scans,
      events
    ] = await Promise.all([
      readTableSafe(`profiles?select=*&id=eq.${userId}&limit=1`),
      readTableSafe(`chat_sessions?select=*&user_id=eq.${userId}&order=updated_at.desc&limit=100`),
      readTableSafe(`vitals_log?select=*&user_id=eq.${userId}&order=recorded_at.desc&limit=100`),
      readTableSafe(`symptom_checks?select=*&user_id=eq.${userId}&order=created_at.desc&limit=100`),
      readTableSafe(`medical_reports?select=*&user_id=eq.${userId}&order=analyzed_at.desc&limit=100`),
      readTableSafe(`health_tips?select=*&user_id=eq.${userId}&order=generated_at.desc&limit=100`),
      readTableSafe(`appointments?select=*&user_id=eq.${userId}&order=created_at.desc&limit=100`),
      readTableSafe(`medicine_scans?select=*&user_id=eq.${userId}&order=scanned_at.desc&limit=100`),
      readTableSafe(`zed_activity_logs?select=*&user_id=eq.${userId}&order=created_at.desc&limit=300`)
    ]);

    res.json({
      generatedAt: new Date().toISOString(),
      userId: req.params.userId,
      profile: Array.isArray(profile) ? profile[0] || null : null,
      sessions,
      vitals,
      symptoms,
      reports,
      tips,
      appointments,
      scans,
      events
    });
  } catch (error) {
    console.error('Admin user detail error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch user detail' });
  }
});

app.post('/api/admin/users/:userId/ban', adminGuard, async (req, res) => {
  try {
    if (!hasAdminSupabaseConfig()) {
      return res.status(503).json({
        error: 'SUPABASE_SERVICE_ROLE_KEY is missing. Set SUPABASE_SERVICE_ROLE_KEY to ban users.'
      });
    }

    const rawDuration = String(req.body?.duration || '').trim();
    const duration = rawDuration || '876000h';
    const userId = encodeURIComponent(req.params.userId);
    const user = await supabaseAuthAdmin(`users/${userId}`, {
      method: 'PUT',
      body: { ban_duration: duration }
    });

    res.json({
      message: `User banned for ${duration}`,
      duration,
      user
    });
  } catch (error) {
    console.error('Admin ban user error:', error);
    res.status(500).json({ error: error.message || 'Failed to ban user' });
  }
});

app.post('/api/admin/users/:userId/unban', adminGuard, async (req, res) => {
  try {
    if (!hasAdminSupabaseConfig()) {
      return res.status(503).json({
        error: 'SUPABASE_SERVICE_ROLE_KEY is missing. Set SUPABASE_SERVICE_ROLE_KEY to unban users.'
      });
    }

    const userId = encodeURIComponent(req.params.userId);
    const user = await supabaseAuthAdmin(`users/${userId}`, {
      method: 'PUT',
      body: { ban_duration: 'none' }
    });

    res.json({
      message: 'User unbanned',
      user
    });
  } catch (error) {
    console.error('Admin unban user error:', error);
    res.status(500).json({ error: error.message || 'Failed to unban user' });
  }
});


// ─────────────────────────────────────────────────────────────────
// ADD THIS ROUTE to your server.js  (paste after the /api/openai route)
// ─────────────────────────────────────────────────────────────────

// Calorie analysis — dedicated endpoint for food image scanning
// Accepts same payload as /api/anthropic but enforces max_tokens
app.post('/api/calorie', async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY is missing on the server' });
    }

    const { messages, model, max_tokens, system } = req.body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      model      || 'claude-opus-4-5',   // use Opus for best food ID accuracy
        max_tokens: max_tokens || 1200,
        system:     system     || '',
        messages:   messages.map(({ role, content }) => ({ role, content }))
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'API error');
    res.status(200).json(data);

  } catch (error) {
    console.error('Calorie scan error:', error);
    res.status(500).json({ error: error.message });
  }
});


app.delete('/api/admin/users/:userId', adminGuard, async (req, res) => {
  try {
    if (!hasAdminSupabaseConfig()) {
      return res.status(503).json({
        error: 'SUPABASE_SERVICE_ROLE_KEY is missing. Set SUPABASE_SERVICE_ROLE_KEY to delete users.'
      });
    }

    const shouldSoftDelete = String(req.query.soft || '').toLowerCase() === 'true';
    const userId = encodeURIComponent(req.params.userId);
    const authPath = shouldSoftDelete
      ? `users/${userId}?should_soft_delete=true`
      : `users/${userId}`;

    await supabaseAuthAdmin(authPath, { method: 'DELETE' });

    res.json({
      message: shouldSoftDelete ? 'User soft-deleted' : 'User deleted',
      soft: shouldSoftDelete
    });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
});

// Anthropic proxy endpoint
app.use('/api/anthropic', requireAuth, checkChatLimit, anthropicRouter);
app.use('/api/telemedicine', telemedicineRouter);
app.use('/api/subscription', subscriptionRouter);

// Explicit route for domain verification to bypass Vercel static dotfile limits
app.get('/.well-known/securescan-verify.txt', (req, res) => {
  res.type('text/plain');
  res.send(process.env.SECURESCAN_VERIFY_KEY || 'This is a placeholder for securescan-verify.txt. Please configure SECURESCAN_VERIFY_KEY in Vercel environment variables.');
});

// Serve static files from public directory
app.use(express.static('public', { dotfiles: 'allow' }));

// Catch-all for unmatched routes to help debug 500s/404s
app.get('*', (req, res) => {
  if (req.url === '/favicon.ico') {
    return res.status(404).end();
  }
  console.log('❓ Unmatched request:', req.url);
  res.status(404).json({ error: 'Not Found', url: req.url, version: VERSION });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🔥 Global error handler:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    version: VERSION
  });
});

// Debug: check if Anthropic key is loaded
console.log('🔑 ANTHROPIC_API_KEY loaded:', process.env.ANTHROPIC_API_KEY ? 'YES' : 'NO');
if (process.env.ANTHROPIC_API_KEY) {
  console.log('   Prefix:', process.env.ANTHROPIC_API_KEY.substring(0, 15) + '...');
}

// For Vercel deployment, export the app
export default app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Zed Server ${VERSION} running on http://localhost:${PORT}`);
  });
}
