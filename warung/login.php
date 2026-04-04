<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#2563eb">
    <title>Masuk | Rafilah Storeboard</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;700&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #2563eb;
            --secondary: #7c3aed;
            --tertiary: #a855f7;
            --surface: rgba(247, 248, 255, 0.94);
            --surface-soft: rgba(255, 255, 255, 0.78);
            --text-main: #1f2933;
            --text-muted: #64748b;
            --border: rgba(79, 92, 160, 0.14);
            --shadow: 0 24px 60px rgba(15, 23, 32, 0.2);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            min-height: 100vh;
            font-family: "Space Grotesk", sans-serif;
            color: var(--text-main);
            background:
                radial-gradient(circle at top left, rgba(168, 85, 247, 0.24), transparent 30%),
                radial-gradient(circle at bottom right, rgba(37, 99, 235, 0.18), transparent 32%),
                linear-gradient(140deg, #0b1028 0%, #1b2d69 48%, #7c3aed 100%);
            padding: 24px;
            display: grid;
            place-items: center;
        }

        body::before,
        body::after {
            content: "";
            position: fixed;
            width: 300px;
            height: 300px;
            border-radius: 999px;
            filter: blur(40px);
            pointer-events: none;
        }

        body::before {
            top: -80px;
            right: -60px;
            background: rgba(124, 58, 237, 0.24);
        }

        body::after {
            left: -70px;
            bottom: -100px;
            background: rgba(37, 99, 235, 0.22);
        }

        .auth-shell {
            position: relative;
            z-index: 1;
            width: min(1180px, 100%);
            display: grid;
            grid-template-columns: minmax(320px, 1.05fr) minmax(320px, 0.95fr);
            border-radius: 32px;
            overflow: hidden;
            box-shadow: var(--shadow);
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
        }

        .brand-side {
            padding: 52px 46px;
            background:
                linear-gradient(160deg, rgba(9, 15, 38, 0.94), rgba(26, 22, 64, 0.9)),
                radial-gradient(circle at top left, rgba(139, 92, 246, 0.2), transparent 30%);
            color: #f7fbff;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 32px;
        }

        .brand-eyebrow,
        .panel-label {
            text-transform: uppercase;
            letter-spacing: 0.18em;
            font-size: 0.74rem;
            font-weight: 700;
        }

        .brand-eyebrow {
            color: rgba(196, 181, 253, 0.96);
            margin-bottom: 16px;
        }

        .brand-title {
            font-family: "Fraunces", serif;
            font-size: clamp(2.5rem, 5vw, 4.5rem);
            line-height: 0.98;
            margin-bottom: 18px;
        }

        .brand-copy {
            max-width: 24ch;
            color: rgba(236, 244, 251, 0.8);
            font-size: 1rem;
        }

        .feature-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
        }

        .feature-card {
            padding: 18px;
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .feature-card strong {
            display: block;
            margin-bottom: 8px;
            font-size: 1rem;
        }

        .feature-card p {
            color: rgba(236, 244, 251, 0.76);
            font-size: 0.92rem;
        }

        .auth-panel {
            padding: 46px 42px;
            background: linear-gradient(180deg, rgba(250, 251, 255, 0.96), rgba(244, 245, 255, 0.92));
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 24px;
        }

        .panel-header h1 {
            font-family: "Fraunces", serif;
            font-size: clamp(2rem, 4vw, 3rem);
            line-height: 1.05;
            margin-bottom: 10px;
        }

        .panel-header p {
            color: var(--text-muted);
        }

        .submit-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: 18px;
            cursor: pointer;
            font-weight: 700;
            transition: transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease;
        }

        .submit-btn {
            width: 100%;
            padding: 15px 18px;
            background: linear-gradient(135deg, var(--primary), #7c3aed);
            color: #ffffff;
            box-shadow: 0 16px 28px rgba(79, 70, 229, 0.24);
        }

        .submit-btn:hover {
            transform: translateY(-2px);
        }

        .submit-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }

        .alert {
            display: none;
            padding: 14px 16px;
            border-radius: 18px;
            font-size: 0.95rem;
        }

        .alert.show {
            display: block;
        }

        .alert-success {
            background: rgba(31, 157, 120, 0.12);
            color: #0d6a51;
            border: 1px solid rgba(31, 157, 120, 0.16);
        }

        .alert-error {
            background: rgba(207, 79, 79, 0.12);
            color: #9f3030;
            border: 1px solid rgba(207, 79, 79, 0.16);
        }

        form {
            display: grid;
            gap: 16px;
        }

        .field {
            display: grid;
            gap: 8px;
        }

        label {
            font-size: 0.9rem;
            font-weight: 700;
        }

        input[type="text"],
        input[type="password"] {
            width: 100%;
            padding: 14px 15px;
            border-radius: 18px;
            border: 1px solid var(--border);
            background: var(--surface-soft);
            color: var(--text-main);
            transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
        }

        input[type="text"]:focus,
        input[type="password"]:focus {
            outline: none;
            border-color: rgba(99, 102, 241, 0.4);
            box-shadow: 0 0 0 5px rgba(99, 102, 241, 0.16);
            transform: translateY(-1px);
        }

        .remember-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
            color: var(--text-muted);
            font-size: 0.92rem;
        }

        .checkbox-label {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            cursor: pointer;
        }

        .checkbox-label input {
            accent-color: var(--primary);
        }

        .panel-footer {
            color: var(--text-muted);
            font-size: 0.92rem;
        }

        @media (max-width: 960px) {
            .auth-shell {
                grid-template-columns: 1fr;
            }

            .brand-side {
                padding: 34px 28px;
            }

            .feature-grid {
                grid-template-columns: 1fr 1fr;
            }
        }

        @media (max-width: 640px) {
            body {
                padding: 14px;
            }

            .brand-side {
                display: none;
            }

            .brand-side,
            .auth-panel {
                padding: 28px 22px;
            }

            .feature-grid {
                grid-template-columns: 1fr;
            }

        }
    </style>
</head>
<body>
    <div class="auth-shell">
        <section class="brand-side">
            <div>
                <div class="brand-eyebrow">Warung OS</div>
                <div class="brand-title">Rafilah Storeboard</div>
                <p class="brand-copy">
                    Sistem toko yang kini tampil lebih tegas, lebih cepat dibaca, dan enak dipakai untuk kerja harian.
                </p>
            </div>

            <div class="feature-grid">
                <article class="feature-card">
                    <strong>Stok</strong>
                    <p>Pantau produk masuk, keluar, dan nilai inventaris secara cepat.</p>
                </article>
                <article class="feature-card">
                    <strong>Cashflow</strong>
                    <p>Lihat pemasukan dan pengeluaran tanpa perlu berpindah alat.</p>
                </article>
                <article class="feature-card">
                    <strong>Kasir</strong>
                    <p>POS tetap siap dipakai untuk transaksi harian langsung dari browser.</p>
                </article>
                <article class="feature-card">
                    <strong>Akses aman</strong>
                    <p>Login tetap sederhana tanpa menampilkan data akun di halaman masuk.</p>
                </article>
            </div>
        </section>

        <section class="auth-panel">
            <div class="panel-header">
                <div class="panel-label">Masuk</div>
                <h1>Buka dashboard toko</h1>
                <p>Masuk dengan akun yang sudah terdaftar untuk membuka sistem toko.</p>
            </div>

            <div class="alert alert-success" id="login-alert"></div>
            <div class="alert alert-error" id="login-error"></div>

            <form id="login-form" onsubmit="handleLogin(event)">
                <div class="field">
                    <label for="login-username">Username</label>
                    <input type="text" id="login-username" name="username" autocomplete="username" required>
                </div>

                <div class="field">
                    <label for="login-password">Password</label>
                    <input type="password" id="login-password" name="password" autocomplete="current-password" required>
                </div>

                <div class="remember-row">
                    <label class="checkbox-label">
                        <input type="checkbox" id="remember-me" name="remember_me">
                        <span>Ingat perangkat ini selama 30 hari</span>
                    </label>
                    <span>Akses aman dari perangkat pribadi</span>
                </div>

                <button type="submit" class="submit-btn" id="login-btn">Masuk ke aplikasi</button>
            </form>

            <p class="panel-footer">
                Jika login gagal, pastikan database dan akun admin sudah tersedia.
            </p>
        </section>
    </div>

    <script>
        function showAlert(elementId, message) {
            const alert = document.getElementById(elementId);
            alert.textContent = message;
            alert.classList.add('show');
        }

        function hideAlert(elementId) {
            const alert = document.getElementById(elementId);
            alert.classList.remove('show');
            alert.textContent = '';
        }

        async function handleLogin(event) {
            event.preventDefault();

            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value.trim();
            const rememberMe = document.getElementById('remember-me').checked;
            const button = document.getElementById('login-btn');

            hideAlert('login-alert');
            hideAlert('login-error');

            if (!username) {
                showAlert('login-error', 'Username tidak boleh kosong.');
                return;
            }

            if (!password) {
                showAlert('login-error', 'Password tidak boleh kosong.');
                return;
            }

            button.disabled = true;
            button.textContent = 'Memproses...';

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

                if (!response.ok) {
                    throw new Error(`Server mengembalikan status ${response.status}.`);
                }

                const contentType = response.headers.get('content-type') || '';
                if (!contentType.includes('application/json')) {
                    throw new Error('Respons server bukan JSON yang valid.');
                }

                const data = await response.json();

                if (!data.success) {
                    showAlert('login-error', data.message || 'Login gagal.');
                    return;
                }

                if (data.device_token && rememberMe && window.deviceManager) {
                    window.deviceManager.saveDeviceToken(
                        data.device_token,
                        data.user,
                        data.token_expires_at
                    );
                }

                showAlert('login-alert', data.message || 'Login berhasil.');
                window.setTimeout(() => {
                    window.location.href = data.redirect || 'index.php';
                }, 800);
            } catch (error) {
                showAlert('login-error', `Terjadi kesalahan: ${error.message}`);
            } finally {
                button.disabled = false;
                button.textContent = 'Masuk ke aplikasi';
            }
        }
    </script>

    <script src="assets/device-manager.js" defer></script>
</body>
</html>
