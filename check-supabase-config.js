#!/usr/bin/env node

// Diagnostic script to check Supabase configuration
import fetch from 'node-fetch';

console.log('🔍 Supabase Configuration Diagnostic\n');

// Test 1: Check if Supabase URL is accessible
console.log('1. Testing Supabase URL accessibility:');
const supabaseUrl = 'https://cenplbwpjycxotctvjmz.supabase.co';
console.log(`   URL: ${supabaseUrl}`);

try {
  const response = await fetch(`${supabaseUrl}/rest/v1/`, {
    method: 'GET',
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbnBsYndwanljeG90Y3R2am16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDE0NDgsImV4cCI6MjA4ODQ3NzQ0OH0.6lDMcolkeHre8VE7R823pMcx3uA6Rvw2C9XTiWtUvD8'
    }
  });
  
  if (response.ok) {
    console.log('   ✅ Supabase URL is accessible');
  } else {
    console.log(`   ❌ Supabase URL returned status: ${response.status}`);
  }
} catch (error) {
  console.log(`   ❌ Error accessing Supabase URL: ${error.message}`);
}

// Test 2: Check if auth endpoint is working
console.log('\n2. Testing Supabase Auth endpoint:');
try {
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: 'GET',
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbnBsYndwanljeG90Y3R2am16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDE0NDgsImV4cCI6MjA4ODQ3NzQ0OH0.6lDMcolkeHre8VE7R823pMcx3uA6Rvw2C9XTiWtUvD8',
      'Authorization': 'Bearer test-token'
    }
  });
  
  if (authResponse.status === 401) {
    console.log('   ✅ Auth endpoint is working (401 Unauthorized is expected)');
  } else {
    console.log(`   ⚠️ Auth endpoint returned unexpected status: ${authResponse.status}`);
  }
} catch (error) {
  console.log(`   ❌ Error testing auth endpoint: ${error.message}`);
}

// Test 3: Check if profiles table exists
console.log('\n3. Testing profiles table access:');
try {
  const profilesResponse = await fetch(`${supabaseUrl}/rest/v1/profiles`, {
    method: 'GET',
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlbnBsYndwanljeG90Y3R2am16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDE0NDgsImV4cCI6MjA4ODQ3NzQ0OH0.6lDMcolkeHre8VE7R823pMcx3uA6Rvw2C9XTiWtUvD8'
    }
  });
  
  if (profilesResponse.ok) {
    console.log('   ✅ Profiles table is accessible');
  } else if (profilesResponse.status === 404) {
    console.log('   ❌ Profiles table does not exist or is not accessible');
  } else {
    console.log(`   ⚠️ Profiles table returned status: ${profilesResponse.status}`);
  }
} catch (error) {
  console.log(`   ❌ Error testing profiles table: ${error.message}`);
}

console.log('\n📋 Common Supabase Authentication Issues:');
console.log('1. Ensure email authentication is enabled in Supabase dashboard');
console.log('2. Check that the anon key is correct and not expired');
console.log('3. Verify that CORS is configured to allow your domain');
console.log('4. Make sure the profiles table exists and has proper RLS policies');
console.log('5. Check that the auth schema is properly set up');

console.log('\n🔧 To fix authentication issues:');
console.log('1. Go to Supabase dashboard → Authentication → Settings');
console.log('2. Enable "Email" sign-in provider');
console.log('3. Configure email templates if needed');
console.log('4. Check API keys in Settings → API');
console.log('5. Verify RLS policies in Table Editor → profiles');