#!/usr/bin/env node

// Simple test script to verify server functionality
import dotenv from 'dotenv';
import { Anthropic } from '@anthropic-ai/sdk';

dotenv.config();

console.log('🧪 Testing Zed Server Configuration...\n');

// Test 1: Check environment variables
console.log('1. Environment Variables:');
console.log(`   ✓ ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'Present' : 'Missing'}`);
console.log(`   ✓ PORT: ${process.env.PORT || '3000'}`);

// Test 2: Test Anthropic client initialization
console.log('\n2. Anthropic Client:');
try {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  console.log('   ✓ Anthropic client initialized successfully');
} catch (error) {
  console.log(`   ✗ Error initializing Anthropic client: ${error.message}`);
}

// Test 3: Test API key validation (basic check)
console.log('\n3. API Key Validation:');
if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
  console.log('   ✓ API key format appears valid');
} else {
  console.log('   ✗ API key format invalid or missing');
}

console.log('\n✅ Server configuration test complete!');
console.log('\nTo start the server, run: npm start');
console.log('To test the API endpoint, send a POST request to: http://localhost:3000/api/anthropic');