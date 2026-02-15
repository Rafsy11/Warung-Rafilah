/**
 * Remember Device Feature - Testing & Demo Script
 * Run this in browser console to test the feature
 */

console.log('=== Remember Device Feature Test Suite ===\n');

// Test 1: Check DeviceManager initialization
console.log('TEST 1: Check DeviceManager');
console.log('Status:', window.deviceManager ? '✓ Loaded' : '✗ Not loaded');
console.log('Window property:', window.deviceManager);
console.log('');

// Test 2: Check localStorage keys
console.log('TEST 2: Check localStorage Keys');
const keys = {
    'warung_device_token': localStorage.getItem('warung_device_token'),
    'warung_device_id': localStorage.getItem('warung_device_id'),
    'warung_token_expiry': localStorage.getItem('warung_token_expiry'),
    'warung_user_data': localStorage.getItem('warung_user_data')
};
console.log('localStorage state:', keys);
console.log('');

// Test 3: Check token validity
console.log('TEST 3: Token Validity Check');
console.log('Has valid token?', window.deviceManager.isTokenValid());
console.log('Token expiry days remaining:', window.deviceManager.getTokenExpiryDays());
console.log('');

// Test 4: Check user data
console.log('TEST 4: User Data');
const userData = window.deviceManager.getUserData();
console.log('User data:', userData);
if (userData) {
    console.log('Logged in as:', userData.username);
}
console.log('');

// Test 5: Check device info
console.log('TEST 5: Device Information');
const deviceInfo = window.deviceManager.getDeviceInfo();
console.log('Device name:', deviceInfo.name);
console.log('Device type:', deviceInfo.type);
console.log('User agent:', navigator.userAgent);
console.log('');

// Test 6: Full debug info
console.log('TEST 6: Full Debug Information');
const debugInfo = window.deviceManager.debugInfo();
console.log('Debug Info:', debugInfo);
console.log('');

// Test 7: Device ID
console.log('TEST 7: Device ID');
console.log('Device ID:', window.deviceManager.getDeviceId());
console.log('');

// Test 8: Manual validation (async)
console.log('TEST 8: Manual Server Validation');
console.log('Run: await window.deviceManager.validateDeviceToken()');
console.log('');

// HELPER FUNCTIONS FOR TESTING

// Function 1: Simulate successful login
window.testLogin = async function() {
    console.log('--- SIMULATING LOGIN ---');
    
    // Mock response dari server
    const mockResponse = {
        device_token: 'mock_token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        user: {
            id: 1,
            username: 'testuser',
            email: 'test@example.com',
            nama_lengkap: 'Test User'
        }
    };
    
    console.log('Mock device token:', mockResponse.device_token);
    
    // Save token
    window.deviceManager.saveDeviceToken(
        mockResponse.device_token,
        mockResponse.user,
        mockResponse.token_expires_at
    );
    
    console.log('Device token saved!');
    console.log('Check localStorage:', window.deviceManager.debugInfo());
};

// Function 2: Clear token
window.testClearToken = function() {
    console.log('--- CLEARING TOKEN ---');
    window.deviceManager.clearDeviceToken();
    console.log('Token cleared!');
    console.log('Current state:', window.deviceManager.debugInfo());
};

// Function 3: Test validation with server
window.testValidation = async function() {
    console.log('--- VALIDATING WITH SERVER ---');
    
    const token = window.deviceManager.getDeviceToken();
    if (!token) {
        console.log('No token to validate!');
        return;
    }
    
    try {
        const response = await fetch('auth.php?action=validate_device_token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                device_token: token,
                device_id: window.deviceManager.getDeviceId(),
                device_info: window.deviceManager.getDeviceInfo()
            })
        });
        
        const data = await response.json();
        console.log('Server response:', data);
        
        if (data.success) {
            console.log('✓ Token validated!');
        } else {
            console.log('✗ Token invalid:', data.message);
        }
    } catch (error) {
        console.error('Error validating token:', error);
    }
};

// Function 4: Check expiry
window.testExpiry = function() {
    console.log('--- TOKEN EXPIRY CHECK ---');
    const expiryStr = localStorage.getItem('warung_token_expiry');
    if (!expiryStr) {
        console.log('No token expiry found');
        return;
    }
    
    const expiry = new Date(expiryStr);
    const now = new Date();
    const remaining = expiry - now;
    
    console.log('Expiry date:', expiry);
    console.log('Days remaining:', Math.floor(remaining / (1000 * 60 * 60 * 24)));
    console.log('Hours remaining:', Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
    console.log('Is valid?', now < expiry);
};

// Function 5: Simulate expired token
window.testExpireToken = function() {
    console.log('--- SIMULATING TOKEN EXPIRATION ---');
    localStorage.setItem('warung_token_expiry', new Date(Date.now() - 1000).toISOString());
    console.log('Token set to expired (1 second ago)');
    console.log('Is valid now?', window.deviceManager.isTokenValid());
};

// Function 6: Format token expiry
window.testFormatExpiry = function() {
    console.log('--- FORMATTED EXPIRY TIME ---');
    const formatted = window.deviceManager.formatExpiryTime();
    console.log('Time until expiry:', formatted);
};

// PRINT INSTRUCTIONS
console.log('\n=== TESTING INSTRUCTIONS ===\n');
console.log('Run these commands in console to test:\n');
console.log('1. Check current state:');
console.log('   window.deviceManager.debugInfo()\n');
console.log('2. Simulate login:');
console.log('   window.testLogin()\n');
console.log('3. Check expiry:');
console.log('   window.testExpiry()\n');
console.log('4. Validate with server:');
console.log('   await window.testValidation()\n');
console.log('5. Simulate token expiration:');
console.log('   window.testExpireToken()\n');
console.log('6. Clear token:');
console.log('   window.testClearToken()\n');
console.log('7. Get formatted expiry:');
console.log('   window.testFormatExpiry()\n');
console.log('\n=== END TESTING ===\n');
