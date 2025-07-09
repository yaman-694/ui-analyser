#!/usr/bin/env node

/**
 * Test script for credits system
 * 
 * This script tests the credits endpoints to verify that the system works correctly.
 * 
 * Usage:
 *   - Set API_URL and AUTH_TOKEN in the environment or edit constants below
 *   - Run the script with 'node credits-test.js'
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your_auth_token_here';
const API_VERSION = process.env.API_VERSION || 'v1';

async function fetchWithAuth(endpoint, method = 'GET', body = null) {
  const headers = {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  };
  
  const options = {
    method,
    headers
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(`${API_URL}/api/${API_VERSION}${endpoint}`, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    console.error('Error in fetch:', error);
    return { status: 500, error };
  }
}

async function runTests() {
  console.log('🧪 Starting credits system tests...');
  console.log('=================================');
  
  try {
    // Test 1: Get current credits
    console.log('\n📊 TEST 1: Getting current credits...');
    const creditsResponse = await fetchWithAuth('/ai/credits');
    
    if (creditsResponse.status === 200) {
      const { data } = creditsResponse.data;
      console.log('✅ Success! Current credits:', data.credits);
      console.log(`   Plan: ${data.plan}`);
      console.log(`   Max daily credits: ${data.maxDailyCredits}`);
      console.log(`   Next refresh: ${new Date(data.nextCreditRefresh).toLocaleString()}`);
    } else {
      console.log('❌ Failed to get credits:', creditsResponse.data.error || creditsResponse.error);
    }
    
    // Test 2: Use 1 credit
    console.log('\n💸 TEST 2: Using 1 credit...');
    const useResponse = await fetchWithAuth('/ai/credits/use', 'POST', { amount: 1 });
    
    if (useResponse.status === 200) {
      const { data } = useResponse.data;
      console.log('✅ Success! Used 1 credit.');
      console.log(`   Remaining credits: ${data.remainingCredits}`);
    } else if (useResponse.status === 402) {
      console.log('❌ Insufficient credits:', useResponse.data.message);
    } else {
      console.log('❌ Failed to use credit:', useResponse.data.error || useResponse.error);
    }
    
    // Test 3: Generate a comment (uses credits)
    console.log('\n💬 TEST 3: Generating a comment (uses credits)...');
    const commentResponse = await fetchWithAuth('/ai/generate-comment', 'POST', {
      post: 'Just finished building a credits system for my API!'
    });
    
    if (commentResponse.status === 200) {
      const { data } = commentResponse.data;
      console.log('✅ Success! Comment generated.');
      console.log(`   Remaining credits: ${data.remainingCredits}`);
      console.log(`   Comment: "${data.comment.substring(0, 50)}..."`);
    } else if (commentResponse.status === 402) {
      console.log('❌ Insufficient credits:', commentResponse.data.message);
    } else {
      console.log('❌ Failed to generate comment:', commentResponse.data.error || commentResponse.error);
    }
    
    // Test 4: Verify credits were consumed
    console.log('\n🔄 TEST 4: Verifying credits were consumed...');
    const finalCreditsResponse = await fetchWithAuth('/ai/credits');
    
    if (finalCreditsResponse.status === 200) {
      const { data } = finalCreditsResponse.data;
      console.log('✅ Success! Current credits:', data.credits);
    } else {
      console.log('❌ Failed to verify credits:', finalCreditsResponse.data.error || finalCreditsResponse.error);
    }
    
  } catch (error) {
    console.error('⚠️ Error running tests:', error);
  }
  
  console.log('\n=================================');
  console.log('🏁 Tests completed!');
}

runTests();
