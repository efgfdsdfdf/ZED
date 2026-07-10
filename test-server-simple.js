#!/usr/bin/env node

// Simple test to verify server is running
import http from 'http';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/anthropic',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log('✅ Server is responding!');
  console.log('Status Code:', res.statusCode);
  
  res.on('data', (chunk) => {
    const response = chunk.toString();
    console.log('Response:', response.substring(0, 200) + '...');
  });
  
  res.on('end', () => {
    console.log('✅ Server test complete!');
  });
});

req.on('error', (err) => {
  console.log('❌ Server error:', err.message);
});

// Send a minimal request
req.write(JSON.stringify({
  model: 'Claude Sonnet 4.6',
  max_tokens: 1,
  messages: [{ role: 'user', content: 'test' }]
}));

req.end();

console.log('🧪 Testing server connectivity...');