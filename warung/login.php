<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Toko Rafilah - Login & Sign Up</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Poppins', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            position: relative;
            overflow: hidden;
        }

        /* Animated background elements */
        body::before {
            content: '';
            position: absolute;
            width: 400px;
            height: 400px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            top: -200px;
            left: -200px;
            animation: float 20s infinite ease-in-out;
        }

        body::after {
            content: '';
            position: absolute;
            width: 300px;
            height: 300px;
            background: rgba(245, 87, 108, 0.1);
            border-radius: 50%;
            bottom: -150px;
            right: -150px;
            animation: float 25s infinite ease-in-out reverse;
        }

        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(30px); }
        }

        .container {
            position: relative;
            z-index: 10;
            width: 100%;
            max-width: 900px;
        }

        .wrapper {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            min-height: 600px;
            background: white;
        }

        .welcome-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 60px 40px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: start;
        }

        .welcome-section h1 {
            font-size: 2.5em;
            margin-bottom: 20px;
            font-weight: 700;
            line-height: 1.2;
        }

        .welcome-section p {
            font-size: 1.1em;
            opacity: 0.9;
            margin-bottom: 30px;
            line-height: 1.6;
        }

        .feature-list {
            list-style: none;
        }

        .feature-list li {
            font-size: 0.95em;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .feature-list li::before {
            content: '✓';
            font-size: 1.3em;
            font-weight: 700;
            color: #f093fb;
        }

        .auth-section {
            padding: 60px 40px;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 40px;
            border-bottom: 2px solid #f0f4ff;
            padding-bottom: 15px;
        }

        .tab-btn {
            background: none;
            border: none;
            font-size: 1em;
            font-weight: 600;
            color: #9ca3af;
            cursor: pointer;
            padding: 8px 0;
            position: relative;
            transition: color 0.3s ease;
            font-family: 'Poppins', sans-serif;
        }

        .tab-btn:hover {
            color: #667eea;
        }

        .tab-btn.active {
            color: #667eea;
        }

        .tab-btn.active::after {
            content: '';
            position: absolute;
            bottom: -17px;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .form-group {
            margin-bottom: 20px;
        }

        .checkbox-group {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
        }

        .checkbox-label {
            display: flex;
            align-items: center;
            font-size: 0.9em;
            cursor: pointer;
            user-select: none;
            margin-bottom: 0;
        }

        .checkbox-label input[type="checkbox"] {
            width: auto;
            margin-right: 8px;
            cursor: pointer;
            accent-color: #667eea;
        }

        .checkbox-label span {
            color: #6b7280;
        }

        label {
            display: block;
            font-size: 0.9em;
            font-weight: 600;
            color: #374151;
            margin-bottom: 8px;
        }

        input {
            width: 100%;
            padding: 12px 14px;
            border: 1.5px solid #e5e7eb;
            border-radius: 10px;
            font-size: 0.95em;
            font-family: 'Poppins', sans-serif;
            transition: all 0.3s ease;
        }

        input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-group.error input {
            border-color: #f5576c;
            box-shadow: 0 0 0 3px rgba(245, 87, 108, 0.1);
        }

        .error-message {
            font-size: 0.82em;
            color: #f5576c;
            margin-top: 5px;
            display: none;
        }

        .error-message.show {
            display: block;
        }

        .submit-btn {
            width: 100%;
            padding: 13px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 0.95em;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            font-family: 'Poppins', sans-serif;
            margin-top: 10px;
        }

        .submit-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
        }

        .submit-btn:active {
            transform: translateY(0);
        }

        .submit-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }

        .alert {
            padding: 12px 15px;
            border-radius: 10px;
            margin-bottom: 20px;
            font-size: 0.9em;
            display: none;
            animation: slideDown 0.3s ease;
        }

        .alert.show {
            display: block;
        }

        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .alert-success {
            background: #d1f2eb;
            color: #065f46;
            border-left: 4px solid #10b981;
        }

        .alert-error {
            background: #fee2e2;
            color: #991b1b;
            border-left: 4px solid #ef4444;
        }

        .form-footer {
            text-align: center;
            font-size: 0.9em;
            color: #6b7280;
            margin-top: 20px;
        }

        .form-footer button {
            background: none;
            border: none;
            color: #667eea;
            font-weight: 600;
            cursor: pointer;
            font-family: 'Poppins', sans-serif;
        }

        .form-footer button:hover {
            text-decoration: underline;
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
            .wrapper {
                grid-template-columns: 1fr;
                min-height: auto;
            }

            .welcome-section {
                display: none;
            }

            .auth-section {
                padding: 40px 24px;
            }

            .welcome-section h1 {
                font-size: 2em;
            }

            input {
                padding: 11px 12px;
                font-size: 0.9em;
            }

            .submit-btn {
                padding: 11px;
                font-size: 0.9em;
            }

            .tabs {
                margin-bottom: 30px;
            }
        }

        @media (max-width: 480px) {
            .container {
                margin: 0;
            }

            .auth-section {
                padding: 32px 18px;
            }

            .tabs {
                margin-bottom: 24px;
                gap: 5px;
            }

            .tab-btn {
                font-size: 0.9em;
            }

            .form-group {
                margin-bottom: 16px;
            }

            label {
                font-size: 0.85em;
            }

            input {
                padding: 10px 11px;
                font-size: 0.88em;
            }

            .submit-btn {
                padding: 10px;
                font-size: 0.88em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="wrapper">
            <!-- Welcome Section -->
            <div class="welcome-section">
                <h1>🏪 Toko Rafilah</h1>
                <p>Sistem Manajemen Inventory & Keuangan yang ampuh untuk bisnis Anda</p>
                <ul class="feature-list">
                    <li>Kelola stok produk dengan mudah</li>
                    <li>Pantau arus keuangan real-time</li>
                    <li>Laporan mendalam dan akurat</li>
                    <li>Interface yang user-friendly</li>
                    <li>Aman dengan autentikasi pengguna</li>
                </ul>
            </div>

            <!-- Auth Section -->
            <div class="auth-section">
                <div class="tabs">
                    <button class="tab-btn active" onclick="switchTab('login')">Login</button>
                </div>

                <!-- Login Tab -->
                <div id="login" class="tab-content active">
                    <div class="alert alert-success" id="login-alert"></div>
                    <div class="alert alert-error" id="login-error"></div>

                    <form id="login-form" onsubmit="handleLogin(event)">
                        <div class="form-group">
                            <label for="login-username">Username</label>
                            <input type="text" id="login-username" name="username" required>
                        </div>

                        <div class="form-group">
                            <label for="login-password">Password</label>
                            <input type="password" id="login-password" name="password" required>
                        </div>

                        <div class="form-group checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="remember-me" name="remember_me">
                                <span>Ingat perangkat ini (30 hari)</span>
                            </label>
                        </div>

                        <button type="submit" class="submit-btn" id="login-btn">Login</button>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Tab switching
        function switchTab(tab) {
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

            // Show selected tab
            document.getElementById(tab).classList.add('active');
            
            // Set active button
            const buttons = document.querySelectorAll('.tab-btn');
            buttons.forEach(btn => {
                if (btn.textContent.toLowerCase().includes(tab === 'login' ? 'login' : 'sign up')) {
                    btn.classList.add('active');
                }
            });
        }

        // Show alert
        function showAlert(element, message, type = 'error') {
            const alert = document.getElementById(element);
            alert.textContent = message;
            alert.classList.add('show');
            alert.style.display = 'block';
        }

        // Hide alert
        function hideAlert(element) {
            const alert = document.getElementById(element);
            alert.classList.remove('show');
            alert.style.display = 'none';
        }

        // Handle login
        async function handleLogin(e) {
            e.preventDefault();
            
            const form = document.getElementById('login-form');
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            const rememberMe = document.getElementById('remember-me').checked;
            const btn = document.getElementById('login-btn');

            // Hide previous alerts
            hideAlert('login-error');
            hideAlert('login-alert');

            // Validate
            if (!username.trim()) {
                showAlert('login-error', '❌ Username tidak boleh kosong', 'error');
                return;
            }
            if (!password.trim()) {
                showAlert('login-error', '❌ Password tidak boleh kosong', 'error');
                return;
            }

            // Disable button
            btn.disabled = true;
            btn.textContent = '⏳ Memproses...';

            try {
                const formData = new FormData();
                formData.append('action', 'login');
                formData.append('username', username);
                formData.append('password', password);
                if (rememberMe) {
                    formData.append('remember_me', 'on');
                }

                const response = await fetch('auth.php', {
                    method: 'POST',
                    body: formData
                });

                // Check response status
                if (!response.ok) {
                    throw new Error(`Server error (${response.status}): ${response.statusText}`);
                }

                // Check content type
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Invalid response format from server');
                }

                const data = await response.json();

                if (data.success) {
                    // Handle device token from server response
                    if (data.device_token && rememberMe) {
                        console.log('[Login] Saving device token...');
                        window.deviceManager.saveDeviceToken(
                            data.device_token,
                            data.user,
                            data.token_expires_at
                        );
                        showAlert('login-alert', '✓ ' + data.message + ' (Device remembered)', 'success');
                    } else {
                        showAlert('login-alert', '✓ ' + data.message, 'success');
                    }
                    
                    setTimeout(() => {
                        window.location.href = data.redirect;
                    }, 1000);
                } else {
                    showAlert('login-error', '❌ ' + data.message, 'error');
                }
            } catch (error) {
                showAlert('login-error', '❌ Terjadi kesalahan: ' + error.message, 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Login';
            }
        }

        // Handle signup
        // Signup disabled - feature removed for security
        window.addEventListener('load', () => {
            const params = new URLSearchParams(window.location.search);
            if (params.get('tab') === 'login') {
                switchTab('login');
            }
        });
    </script>
    
    <!-- Device Manager for Remember Device Feature -->
    <script src="assets/device-manager.js" defer></script>
</body>
</html>
