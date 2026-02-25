require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const UAParser = require('ua-parser-js');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3001;

console.log('--- Startup Diagnostics ---');
console.log(`Current Time: ${new Date().toLocaleString()}`);
console.log(`Working Directory: ${process.cwd()}`);
console.log(`Environment PORT: ${process.env.PORT || 'not set'}`);
console.log(`Using PORT: ${PORT}`);
console.log('---------------------------');

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection and Setup
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL server.');

    db.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'visitor_tracker'}`, (err) => {
        if (err) return console.error('Error creating database:', err);
        
        db.changeUser({ database: process.env.DB_NAME || 'visitor_tracker' }, (err) => {
            if (err) return console.error('Error switching database:', err);

            const createTableSql = `
                CREATE TABLE IF NOT EXISTS visitors (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    ip_address VARCHAR(45),
                    country VARCHAR(100),
                    state VARCHAR(100),
                    city VARCHAR(100),
                    isp VARCHAR(255),
                    browser_name VARCHAR(100),
                    operating_system VARCHAR(100),
                    device_type VARCHAR(50),
                    screen_resolution VARCHAR(50),
                    visit_time DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;
            db.query(createTableSql, (err) => {
                if (err) console.error('Error creating table:', err);
                else console.log('Database and table ready.');
            });
        });
    });
});

// Helper to call Python script
const getGeoInfo = (ip) => {
    return new Promise((resolve) => {
        // Try 'python' first, fallback to 'python3' (common on Linux/Render)
        const cmd = process.platform === 'win32' ? `python get_location.py ${ip}` : `python3 get_location.py ${ip}`;
        
        exec(cmd, (error, stdout) => {
            if (error) {
                // If 'python3' also fails or was the primary, try the other as a fallback
                const fallbackCmd = cmd.includes('python3') ? `python get_location.py ${ip}` : `python3 get_location.py ${ip}`;
                exec(fallbackCmd, (fallbackError, fallbackStdout) => {
                    if (fallbackError) {
                        console.error(`Both python/python3 failed: ${fallbackError}`);
                        return resolve(null);
                    }
                    try {
                        const data = JSON.parse(fallbackStdout);
                        resolve(data.success ? data : null);
                    } catch (e) {
                        resolve(null);
                    }
                });
                return;
            }
            try {
                const data = JSON.parse(stdout);
                resolve(data.success ? data : null);
            } catch (e) {
                console.error('Parse error:', e);
                resolve(null);
            }
        });
    });
};

// --- API Routes ---

// 1. Log Visitor Data
app.get('/api/log-visit', async (req, res) => {
    console.log('[API] /api/log-visit hit');
    try {
        let ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        if (ip === '::1' || ip === '127.0.0.1') ip = '8.8.8.8'; 

        console.log(`[Visit Log] Detected IP: ${ip}`);

        const geoInfo = await getGeoInfo(ip);
        const ua = req.headers['user-agent'];
        const parser = new UAParser(ua);
        const result = parser.getResult();

        const values = [
            ip, 
            geoInfo?.country || 'Unknown', 
            geoInfo?.state || 'Unknown', 
            geoInfo?.city || 'Unknown', 
            geoInfo?.isp || 'Unknown', 
            `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`,
            `${result.os.name || 'Unknown'} ${result.os.version || ''}`,
            result.device.type || 'Desktop',
            req.query.resolution || 'Unknown'
        ];

        const sql = `INSERT INTO visitors (ip_address, country, state, city, isp, browser_name, operating_system, device_type, screen_resolution) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        db.query(sql, values, (err) => {
            if (err) {
                console.error('DB Error:', err);
                return res.status(500).json({ error: 'DB Error' });
            }
            console.log(`[Success] Logged visit for ${ip}`);
            res.json({ success: true });
        });
    } catch (err) {
        console.error('Server error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 2. Get Visitor Logs
app.get('/api/get-visitors', (req, res) => {
    console.log('[API] /api/get-visitors hit');
    db.query('SELECT * FROM visitors ORDER BY visit_time DESC', (err, results) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(results);
    });
});

// --- Static and Frontend ---

// Serve specific static files to avoid wildcard issues
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'public', 'style.css')));

// Static folder as backup
app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
