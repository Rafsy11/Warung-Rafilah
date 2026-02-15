/**
 * Device Manager - Handle Remember Device Feature
 * Manages device tokens for auto-login functionality
 */

class DeviceManager {
    constructor() {
        this.STORAGE_KEY = 'warung_device_token';
        this.USER_KEY = 'warung_user_data';
        this.TOKEN_EXPIRY_KEY = 'warung_token_expiry';
        this.DEVICE_ID_KEY = 'warung_device_id';
        this.TOKEN_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
        
        this.init = this.init.bind(this);
        this.saveDeviceToken = this.saveDeviceToken.bind(this);
        this.getDeviceToken = this.getDeviceToken.bind(this);
        this.clearDeviceToken = this.clearDeviceToken.bind(this);
        this.isTokenValid = this.isTokenValid.bind(this);
        this.validateDeviceToken = this.validateDeviceToken.bind(this);
        this.generateDeviceId = this.generateDeviceId.bind(this);
        this.getDeviceInfo = this.getDeviceInfo.bind(this);
    }

    /**
     * Initialize device manager
     */
    init() {
        console.log('[DeviceManager] Initializing...');
        
        // Check if device token exists and is valid
        const hasValidToken = this.isTokenValid();
        
        if (hasValidToken) {
            console.log('[DeviceManager] Valid device token found');
            // Try to restore session with device token
            this.validateDeviceToken();
        } else {
            console.log('[DeviceManager] No valid device token found');
            // Clear any invalid tokens
            this.clearDeviceToken();
        }
    }

    /**
     * Save device token (called after successful login)
     */
    saveDeviceToken(token, userData, expiresAt = null) {
        if (!token) return false;

        try {
            // Generate unique device ID
            const deviceId = this.generateDeviceId();
            
            // Store token in localStorage
            localStorage.setItem(this.STORAGE_KEY, token);
            
            // Store user data
            if (userData) {
                localStorage.setItem(this.USER_KEY, JSON.stringify(userData));
            }
            
            // Store device ID
            localStorage.setItem(this.DEVICE_ID_KEY, deviceId);
            
            // Store expiry time
            const expiry = expiresAt || new Date(Date.now() + this.TOKEN_MAX_AGE).toISOString();
            localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiry);
            
            console.log('[DeviceManager] Device token saved successfully');
            console.log('[DeviceManager] Token expires at:', expiry);
            
            return true;
        } catch (error) {
            console.error('[DeviceManager] Error saving device token:', error);
            return false;
        }
    }

    /**
     * Get stored device token
     */
    getDeviceToken() {
        try {
            return localStorage.getItem(this.STORAGE_KEY);
        } catch (error) {
            console.error('[DeviceManager] Error getting device token:', error);
            return null;
        }
    }

    /**
     * Get stored user data
     */
    getUserData() {
        try {
            const data = localStorage.getItem(this.USER_KEY);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('[DeviceManager] Error getting user data:', error);
            return null;
        }
    }

    /**
     * Get device ID
     */
    getDeviceId() {
        try {
            return localStorage.getItem(this.DEVICE_ID_KEY);
        } catch (error) {
            console.error('[DeviceManager] Error getting device ID:', error);
            return null;
        }
    }

    /**
     * Check if token is still valid
     */
    isTokenValid() {
        try {
            const token = this.getDeviceToken();
            if (!token) return false;

            const expiryStr = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
            if (!expiryStr) return false;

            const expiry = new Date(expiryStr);
            const now = new Date();

            if (now > expiry) {
                console.log('[DeviceManager] Device token has expired');
                return false;
            }

            console.log('[DeviceManager] Device token is valid');
            return true;
        } catch (error) {
            console.error('[DeviceManager] Error checking token validity:', error);
            return false;
        }
    }

    /**
     * Get time remaining for token (in days)
     */
    getTokenExpiryDays() {
        try {
            const expiryStr = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
            if (!expiryStr) return 0;

            const expiry = new Date(expiryStr);
            const now = new Date();
            const daysRemaining = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
            
            return Math.max(0, daysRemaining);
        } catch (error) {
            console.error('[DeviceManager] Error getting expiry days:', error);
            return 0;
        }
    }

    /**
     * Validate device token with server
     */
    async validateDeviceToken() {
        const token = this.getDeviceToken();
        if (!token) {
            console.log('[DeviceManager] No token to validate');
            return false;
        }

        try {
            console.log('[DeviceManager] Validating device token with server...');
            
            const response = await fetch('auth.php?action=validate_device_token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // Include cookies
                body: JSON.stringify({
                    device_token: token,
                    device_id: this.getDeviceId(),
                    device_info: this.getDeviceInfo()
                })
            });

            // Check if response is OK
            if (!response.ok) {
                console.error('[DeviceManager] Server error:', response.status);
                this.clearDeviceToken();
                return false;
            }

            // Check if response is valid JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                console.error('[DeviceManager] Invalid response content-type:', contentType);
                this.clearDeviceToken();
                return false;
            }

            const data = await response.json();

            if (data.success && data.user) {
                console.log('[DeviceManager] Device token validated successfully');
                console.log('[DeviceManager] User:', data.user.username);
                
                // Update user data
                localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
                
                // Update expiry if provided
                if (data.expires_at) {
                    localStorage.setItem(this.TOKEN_EXPIRY_KEY, data.expires_at);
                }
                
                // Dispatch custom event
                window.dispatchEvent(new CustomEvent('deviceTokenValid', { detail: data.user }));
                
                return true;
            } else {
                console.log('[DeviceManager] Device token validation failed');
                console.log('[DeviceManager] Reason:', data.message);
                
                // Clear invalid token
                this.clearDeviceToken();
                
                // Dispatch event
                window.dispatchEvent(new CustomEvent('deviceTokenInvalid'));
                
                return false;
            }
        } catch (error) {
            console.error('[DeviceManager] Error validating device token:', error.message);
            
            // Clear token on error
            this.clearDeviceToken();
            
            return false;
        }
    }

    /**
     * Clear device token
     */
    clearDeviceToken() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            localStorage.removeItem(this.USER_KEY);
            localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
            localStorage.removeItem(this.DEVICE_ID_KEY);
            
            console.log('[DeviceManager] Device token cleared');
            
            // Dispatch event
            window.dispatchEvent(new CustomEvent('deviceTokenCleared'));
            
            return true;
        } catch (error) {
            console.error('[DeviceManager] Error clearing device token:', error);
            return false;
        }
    }

    /**
     * Generate unique device ID
     */
    generateDeviceId() {
        // Try to get existing device ID
        let deviceId = this.getDeviceId();
        if (deviceId) return deviceId;

        // Generate new ID (combination of timestamp + random)
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        try {
            localStorage.setItem(this.DEVICE_ID_KEY, deviceId);
        } catch (error) {
            console.error('[DeviceManager] Error saving device ID:', error);
        }

        return deviceId;
    }

    /**
     * Get device information
     */
    getDeviceInfo() {
        const userAgent = navigator.userAgent;
        let deviceName = 'Unknown Device';
        let deviceType = 'unknown';

        // Detect device type and name
        if (/mobile|android|iphone/i.test(userAgent)) {
            deviceType = 'mobile';
            if (/iphone/i.test(userAgent)) {
                deviceName = 'iPhone';
            } else if (/android/i.test(userAgent)) {
                deviceName = 'Android Phone';
            } else {
                deviceName = 'Mobile Device';
            }
        } else if (/ipad|tablet/i.test(userAgent)) {
            deviceType = 'tablet';
            deviceName = 'Tablet';
        } else {
            deviceType = 'desktop';
            deviceName = 'Desktop Computer';
        }

        // Add browser info
        if (/chrome/i.test(userAgent) && !/chromium/i.test(userAgent)) {
            deviceName += ' (Chrome)';
        } else if (/firefox/i.test(userAgent)) {
            deviceName += ' (Firefox)';
        } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
            deviceName += ' (Safari)';
        } else if (/edge/i.test(userAgent)) {
            deviceName += ' (Edge)';
        }

        return {
            name: deviceName,
            type: deviceType,
            userAgent: userAgent,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get all remembered devices (mock - would need backend support)
     */
    getDeviceInfo() {
        return {
            name: this.generateDeviceName(),
            type: this.getDeviceType(),
            userAgent: navigator.userAgent
        };
    }

    /**
     * Generate device name from user agent
     */
    generateDeviceName() {
        const ua = navigator.userAgent;
        let os = 'Unknown OS';
        let browser = 'Unknown Browser';

        // Detect OS
        if (ua.indexOf('Win') > -1) os = 'Windows';
        else if (ua.indexOf('Mac') > -1) os = 'macOS';
        else if (ua.indexOf('Android') > -1) os = 'Android';
        else if (ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) os = 'iOS';
        else if (ua.indexOf('Linux') > -1) os = 'Linux';

        // Detect Browser
        if (ua.indexOf('Firefox') > -1) browser = 'Firefox';
        else if (ua.indexOf('Chrome') > -1) browser = 'Chrome';
        else if (ua.indexOf('Safari') > -1) browser = 'Safari';
        else if (ua.indexOf('Edge') > -1) browser = 'Edge';

        return `${os} - ${browser}`;
    }

    /**
     * Get device type
     */
    getDeviceType() {
        const ua = navigator.userAgent;
        if (/mobile|android|iphone/i.test(ua)) return 'mobile';
        if (/ipad|tablet/i.test(ua)) return 'tablet';
        return 'desktop';
    }

    /**
     * Update device token after successful login
     */
    handleLoginSuccess(response) {
        if (response.device_token) {
            console.log('[DeviceManager] Saving device token from login response');
            
            const userData = {
                id: response.user?.id,
                username: response.user?.username,
                email: response.user?.email,
                nama_lengkap: response.user?.nama_lengkap
            };

            this.saveDeviceToken(response.device_token, userData, response.token_expires_at);
        }
    }

    /**
     * Check and auto-login with device token
     */
    async checkAndAutoLogin() {
        if (!this.isTokenValid()) {
            return false;
        }

        console.log('[DeviceManager] Attempting auto-login with device token...');
        
        const isValid = await this.validateDeviceToken();
        
        if (isValid) {
            const userData = this.getUserData();
            if (userData) {
                console.log('[DeviceManager] Auto-login successful for:', userData.username);
                
                // Dispatch event for app to handle
                window.dispatchEvent(new CustomEvent('autoLoginSuccess', { detail: userData }));
                
                return true;
            }
        }

        return false;
    }

    /**
     * Format token expiry for display
     */
    formatExpiryTime() {
        const expiryStr = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
        if (!expiryStr) return 'Not set';

        const expiry = new Date(expiryStr);
        const now = new Date();
        const diffMs = expiry - now;

        if (diffMs < 0) return 'Expired';

        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (diffDays > 0) return `${diffDays} days ${diffHours} hours`;
        return `${diffHours} hours`;
    }

    /**
     * Debug info
     */
    debugInfo() {
        return {
            hasToken: !!this.getDeviceToken(),
            isValid: this.isTokenValid(),
            deviceId: this.getDeviceId(),
            expiryTime: localStorage.getItem(this.TOKEN_EXPIRY_KEY),
            expiryDays: this.getTokenExpiryDays(),
            user: this.getUserData(),
            deviceInfo: this.getDeviceInfo()
        };
    }
}

// Create global instance
window.deviceManager = new DeviceManager();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        window.deviceManager.init();
    });
} else {
    window.deviceManager.init();
}

// Export for use in browser console
console.log('[DeviceManager] Loaded. Access via window.deviceManager');
console.log('[DeviceManager] Use window.deviceManager.debugInfo() to debug');
