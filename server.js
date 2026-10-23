const express = require('express');
const mysql = require('mysql2');
// --- UPDATED THIS LINE ---
const { S3Client } = require("@aws-sdk/client-s3");
const multer = require('multer');
const multerS3 = require('multer-s3');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. RDS Database Connection
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
});

// 2. AWS S3 Setup --- UPDATED FOR SDK v3 ---
const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
    }
});

// 3. Multer S3 Upload Configuration --- UPDATED TO USE NEW S3 CLIENT ---
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_BUCKET,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: (req, file, cb) => { cb(null, {fieldName: file.fieldname}); },
        key: (req, file, cb) => { cb(null, Date.now().toString() + "-" + file.originalname); }
    })
});

// --- APIs (Keeping your logic exactly the same) ---

// A. Get All Events (for dropdown)
app.get('/events', (req, res) => {
    db.query("SELECT * FROM events", (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

// B. Register for an Event
app.post('/register', upload.single('proof'), (req, res) => {
    const { name, email, event_id } = req.body;
    const file_url = req.file ? req.file.location : null; // S3 URL

    const sql = "INSERT INTO registrations (name, email, event_id, file_url) VALUES (?, ?, ?, ?)";
    db.query(sql, [name, email, event_id, file_url], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json(err);
        }
        res.json({ message: "Registration Successful!", id: result.insertId });
    });
});

// C. Admin: View all Registrations
app.get('/registrations', (req, res) => {
    const sql = `
        SELECT r.id, r.name, r.email, r.file_url, e.title as event_name 
        FROM registrations r 
        JOIN events e ON r.event_id = e.id`;
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));