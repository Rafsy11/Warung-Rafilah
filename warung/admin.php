<?php
/**
 * Admin Dashboard - View All Users
 */

require_once 'config.php';

// Simple protection - bisa ditambah auth later
$admin_key = isset($_GET['key']) ? $_GET['key'] : '';
$is_admin = ($admin_key === 'admin123'); // Change this to something secure!

if (!$is_admin) {
    die('Access Denied');
}

$db = Database::getInstance();
$conn = $db->getConnection();
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin - Manage Users</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        h1 {
            color: #667eea;
            margin-bottom: 30px;
            text-align: center;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }

        .stat-number {
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 10px;
        }

        .stat-label {
            font-size: 0.9em;
            opacity: 0.9;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 30px;
        }

        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }

        th {
            background: #f3f4f6;
            font-weight: 600;
            color: #374151;
        }

        tr:hover {
            background: #f9fafb;
        }

        .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.85em;
            text-decoration: none;
            display: inline-block;
        }

        .btn-danger {
            background: #ef4444;
            color: white;
        }

        .btn-danger:hover {
            background: #dc2626;
        }

        .empty {
            text-align: center;
            padding: 40px;
            color: #9ca3af;
        }

        .back-link {
            display: inline-block;
            margin-bottom: 20px;
            color: #667eea;
            text-decoration: none;
            font-weight: 600;
        }

        .back-link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <a href="login.php" class="back-link">← Kembali ke Login</a>

        <h1>👥 Admin - Manage Users</h1>

        <?php
        // Get statistics
        $count = $conn->query("SELECT COUNT(*) as total FROM users");
        $count_result = $count->fetch_assoc();
        $total_users = $count_result['total'];

        $today = date('Y-m-d');
        $today_count = $conn->query("SELECT COUNT(*) as total FROM users WHERE DATE(created_at) = '$today'");
        $today_result = $today_count->fetch_assoc();
        $new_today = $today_result['total'];
        ?>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-number"><?php echo $total_users; ?></div>
                <div class="stat-label">Total Users</div>
            </div>
            <div class="stat-card">
                <div class="stat-number"><?php echo $new_today; ?></div>
                <div class="stat-label">Terdaftar Hari Ini</div>
            </div>
        </div>

        <?php
        if ($total_users > 0) {
            ?>
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Nama Lengkap</th>
                        <th>Terdaftar</th>
                        <th>Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <?php
                    $users = $conn->query("SELECT * FROM users ORDER BY created_at DESC");
                    while ($user = $users->fetch_assoc()) {
                        $created = date('d/m/Y H:i', strtotime($user['created_at']));
                        ?>
                        <tr>
                            <td>#<?php echo $user['id']; ?></td>
                            <td><strong><?php echo htmlspecialchars($user['username']); ?></strong></td>
                            <td><?php echo htmlspecialchars($user['email']); ?></td>
                            <td><?php echo htmlspecialchars($user['nama_lengkap']); ?></td>
                            <td><?php echo $created; ?></td>
                            <td>
                                <form method="POST" style="display:inline;" onsubmit="return confirm('Yakin hapus user?')">
                                    <input type="hidden" name="delete_id" value="<?php echo $user['id']; ?>">
                                    <button type="submit" class="btn btn-danger">Hapus</button>
                                </form>
                            </td>
                        </tr>
                        <?php
                    }
                    ?>
                </tbody>
            </table>
            <?php
        } else {
            echo '<div class="empty">📭 Belum ada user terdaftar</div>';
        }
        ?>
    </div>

    <?php
    // Handle delete
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_id'])) {
        $delete_id = intval($_POST['delete_id']);
        $delete_stmt = $conn->prepare("DELETE FROM users WHERE id = ?");
        $delete_stmt->bind_param("i", $delete_id);
        
        if ($delete_stmt->execute()) {
            echo '<script>alert("User berhasil dihapus"); location.reload();</script>';
        }
        $delete_stmt->close();
    }
    ?>
</body>
</html>
