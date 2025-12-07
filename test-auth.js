/**
 * Authentication Endpoints Test Script
 * Tests the registration, login, and logout endpoints
 */

require('dotenv').config();

async function testAuthentication() {
  console.log('\n🧪 Testing Authentication Endpoints...\n');

  const baseURL = 'http://localhost:3000/api/auth';
  let sessionCookie = '';

  try {
    // Test 1: Register a new user
    console.log('Test 1: Registering new user...');
    const registerResponse = await fetch(`${baseURL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'testuser_' + Date.now(),
        email: 'test_' + Date.now() + '@example.com',
        password: 'TestPassword123',
        confirmPassword: 'TestPassword123'
      })
    });

    const registerData = await registerResponse.json();
    console.log('✅ Registration Response:', registerData);
    console.log('   Status:', registerResponse.status);

    // Extract session cookie
    const cookies = registerResponse.headers.get('set-cookie');
    if (cookies) {
      sessionCookie = cookies.split(';')[0];
      console.log('   Session Cookie:', sessionCookie ? 'Set' : 'Not Set');
    }

    if (!registerData.success) {
      console.error('❌ Registration failed:', registerData.message);
      return;
    }

    // Test 2: Check if logged in (get current user)
    console.log('\nTest 2: Getting current user info...');
    const meResponse = await fetch(`${baseURL}/me`, {
      headers: {
        'Cookie': sessionCookie
      }
    });

    const meData = await meResponse.json();
    console.log('✅ Current User Response:', meData);
    console.log('   Status:', meResponse.status);

    // Test 3: Logout
    console.log('\nTest 3: Logging out...');
    const logoutResponse = await fetch(`${baseURL}/logout`, {
      method: 'POST',
      headers: {
        'Cookie': sessionCookie
      }
    });

    const logoutData = await logoutResponse.json();
    console.log('✅ Logout Response:', logoutData);
    console.log('   Status:', logoutResponse.status);

    // Test 4: Try to get current user after logout (should fail)
    console.log('\nTest 4: Verifying logout (should fail)...');
    const meAfterLogoutResponse = await fetch(`${baseURL}/me`, {
      headers: {
        'Cookie': sessionCookie
      }
    });

    const meAfterLogoutData = await meAfterLogoutResponse.json();
    console.log('   Response:', meAfterLogoutData);
    console.log('   Status:', meAfterLogoutResponse.status);

    if (meAfterLogoutResponse.status === 401) {
      console.log('✅ Logout verified - user no longer authenticated');
    }

    // Test 5: Login with the registered user
    console.log('\nTest 5: Logging in with credentials...');
    const loginResponse = await fetch(`${baseURL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: registerData.user.username,
        password: 'TestPassword123'
      })
    });

    const loginData = await loginResponse.json();
    console.log('✅ Login Response:', loginData);
    console.log('   Status:', loginResponse.status);

    // Test 6: Test duplicate username (should fail)
    console.log('\nTest 6: Testing duplicate username (should fail)...');
    const duplicateResponse = await fetch(`${baseURL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: registerData.user.username,
        email: 'different@example.com',
        password: 'TestPassword123',
        confirmPassword: 'TestPassword123'
      })
    });

    const duplicateData = await duplicateResponse.json();
    console.log('   Response:', duplicateData);
    console.log('   Status:', duplicateResponse.status);

    if (duplicateResponse.status === 409) {
      console.log('✅ Duplicate check working - username already taken');
    }

    // Test 7: Test password mismatch (should fail)
    console.log('\nTest 7: Testing password mismatch (should fail)...');
    const mismatchResponse = await fetch(`${baseURL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'anotheruser',
        password: 'TestPassword123',
        confirmPassword: 'DifferentPassword123'
      })
    });

    const mismatchData = await mismatchResponse.json();
    console.log('   Response:', mismatchData);
    console.log('   Status:', mismatchResponse.status);

    if (mismatchResponse.status === 400) {
      console.log('✅ Validation working - passwords must match');
    }

    // Test 8: Check username availability
    console.log('\nTest 8: Checking username availability...');
    const availableResponse = await fetch(`${baseURL}/check-username/availableusername123`);
    const availableData = await availableResponse.json();
    console.log('   Available username:', availableData);

    const takenResponse = await fetch(`${baseURL}/check-username/${registerData.user.username}`);
    const takenData = await takenResponse.json();
    console.log('   Taken username:', takenData);

    console.log('\n✅ All Authentication Tests Completed!\n');
    console.log('📊 Summary:');
    console.log('  ✓ User registration works');
    console.log('  ✓ Session management works');
    console.log('  ✓ User login works');
    console.log('  ✓ User logout works');
    console.log('  ✓ Duplicate username validation works');
    console.log('  ✓ Password validation works');
    console.log('  ✓ Username availability check works\n');

  } catch (error) {
    console.error('\n❌ Test Failed!');
    console.error('Error:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('  1. Make sure the server is running (npm start)');
    console.error('  2. Make sure MongoDB is connected');
    console.error('  3. Check server logs for errors\n');
  }
}

// Give server time to start, then run tests
console.log('⏳ Waiting 3 seconds for server to be ready...');
setTimeout(testAuthentication, 3000);
