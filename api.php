<?php
session_start();
header('Content-Type: application/json');

$db_file = __DIR__ . '/database.sqlite';
$is_new_db = !file_exists($db_file);

try {
    $pdo = new PDO("sqlite:" . $db_file);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    if ($is_new_db) {
        // إنشاء الجداول الأساسية فقط (بدون المفضلة والتقديم)
        $pdo->exec("CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL, role TEXT NOT NULL, expiry TEXT,
            full_name TEXT, age TEXT, phone TEXT, email TEXT, nationality TEXT
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, sector TEXT,
            pref TEXT, link TEXT, desc TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )");
        $pdo->exec("CREATE TABLE IF NOT EXISTS sectors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL)");
        
        // حساب المدير الافتراضي باسم "سلطان"
        $hashed_password = password_hash('123', PASSWORD_DEFAULT);
        $pdo->exec("INSERT INTO users (username, password, role, full_name, email, phone, nationality) 
                    VALUES ('admin', '$hashed_password', 'admin', 'سلطان', 'sultan@basita.com', '966500000000', 'سعودي')");
        
        $pdo->exec("INSERT INTO sectors (name) VALUES ('تقنية المعلومات'), ('هندسة'), ('طب وصحة'), ('إدارة وأعمال')");
    }
} catch (PDOException $e) {
    echo json_encode(["success" => false, "message" => "خطأ في قاعدة البيانات"]); exit;
}

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);

if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'check_session') {
    if (isset($_SESSION['user'])) { 
        // تحديث بيانات الجلسة من قاعدة البيانات لضمان عرض أحدث التعديلات
        $stmt = $pdo->prepare("SELECT id, username, role, expiry, full_name, age, phone, email, nationality FROM users WHERE id = ?");
        $stmt->execute([$_SESSION['user']['id']]);
        $_SESSION['user'] = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode(["success" => true, "user" => $_SESSION['user']]); 
    } else { echo json_encode(["success" => false]); }
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'login') {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ?");
    $stmt->execute([$input['username']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user && password_verify($input['password'], $user['password'])) {
        unset($user['password']); 
        $_SESSION['user'] = $user;
        echo json_encode(["success" => true, "user" => $user]);
    } else { echo json_encode(["success" => false, "message" => "بيانات الدخول غير صحيحة"]); }
    exit;
}

if ($action === 'logout') { session_destroy(); echo json_encode(["success" => true]); exit; }

// جلب الوظائف للمشتركين العاديين
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_jobs') {
    $jobs = $pdo->query("SELECT * FROM jobs ORDER BY timestamp DESC")->fetchAll(PDO::FETCH_ASSOC);
    $sectors = $pdo->query("SELECT * FROM sectors ORDER BY id ASC")->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(["jobs" => $jobs, "sectors" => $sectors]); exit;
}

// === مسارات الإدارة ===
if (isset($_SESSION['user']) && $_SESSION['user']['role'] === 'admin') {
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'get_admin_data') {
        $jobsCount = $pdo->query("SELECT COUNT(*) FROM jobs")->fetchColumn();
        $usersCount = $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
        $users = $pdo->query("SELECT * FROM users ORDER BY role ASC")->fetchAll(PDO::FETCH_ASSOC);
        $sectors = $pdo->query("SELECT * FROM sectors")->fetchAll(PDO::FETCH_ASSOC);
        $jobs = $pdo->query("SELECT * FROM jobs ORDER BY timestamp DESC")->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(["jobs_count" => $jobsCount, "users_count" => $usersCount, "users" => $users, "sectors" => $sectors, "jobs" => $jobs]); exit;
    }

    // إضافة مستخدم (أو مدير)
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'add_user') {
        $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
        $stmt->execute([$input['username']]);
        if ($stmt->fetch()) { echo json_encode(["success" => false, "message" => "يوزر الدخول مكرر"]); exit; }
        
        $role = $input['role'] ?? 'user';
        $hashed = password_hash($input['password'], PASSWORD_DEFAULT);
        $pdo->prepare("INSERT INTO users (username, password, role, expiry, full_name, age, phone, email, nationality) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute([$input['username'], $hashed, $role, $input['expiry'], $input['full_name'], $input['age'], $input['phone'], $input['email'], $input['nationality']]);
        echo json_encode(["success" => true]); exit;
    }

    // تعديل مستخدم (أو مدير)
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'edit_user') {
        $role = $input['role'] ?? 'user';
        if(!empty($input['password'])) {
            $hashed = password_hash($input['password'], PASSWORD_DEFAULT);
            $pdo->prepare("UPDATE users SET username=?, role=?, expiry=?, full_name=?, age=?, phone=?, email=?, nationality=?, password=? WHERE id=?")
                ->execute([$input['username'], $role, $input['expiry'], $input['full_name'], $input['age'], $input['phone'], $input['email'], $input['nationality'], $hashed, $input['id']]);
        } else {
            $pdo->prepare("UPDATE users SET username=?, role=?, expiry=?, full_name=?, age=?, phone=?, email=?, nationality=? WHERE id=?")
                ->execute([$input['username'], $role, $input['expiry'], $input['full_name'], $input['age'], $input['phone'], $input['email'], $input['nationality'], $input['id']]);
        }
        echo json_encode(["success" => true]); exit;
    }

    // إدارة الوظائف (إضافة، تعديل، حذف)
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'add_job') {
        $pdo->prepare("INSERT INTO jobs (title, sector, pref, link, desc) VALUES (?, ?, ?, ?, ?)")->execute([$input['title'], $input['sector'], $input['pref'], $input['link'], $input['desc']]);
        echo json_encode(["success" => true]); exit;
    }
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'edit_job') {
        $pdo->prepare("UPDATE jobs SET title=?, sector=?, pref=?, link=?, desc=? WHERE id=?")
            ->execute([$input['title'], $input['sector'], $input['pref'], $input['link'], $input['desc'], $input['id']]);
        echo json_encode(["success" => true]); exit;
    }
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'delete_job') {
        $pdo->prepare("DELETE FROM jobs WHERE id = ?")->execute([$input['id']]);
        echo json_encode(["success" => true]); exit;
    }

    // إدارة القطاعات
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'add_sector') {
        try {
            $pdo->prepare("INSERT INTO sectors (name) VALUES (?)")->execute([$input['name']]);
            echo json_encode(["success" => true]);
        } catch(Exception $e) { echo json_encode(["success" => false, "message" => "القطاع موجود"]); }
        exit;
    }
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'delete_sector') {
        $pdo->prepare("DELETE FROM sectors WHERE id = ?")->execute([$input['id']]);
        echo json_encode(["success" => true]); exit;
    }
}
?>
