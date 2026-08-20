const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Koneksi ke Database MySQL di Laragon
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // Password default Laragon kosong
    database: 'db_manajemen_air'
});

db.connect(err => {
    if (err) {
        console.error("Koneksi database gagal:", err);
        return;
    }
    console.log("Berhasil terhubung ke Database MySQL Laragon!");
});

// Endpoint untuk proses login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const query = "SELECT * FROM users WHERE username = ? AND password = ?";

    db.query(query, [username, password], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Kesalahan server" });

        if (results.length > 0) {
            const user = results[0];
            res.json({ success: true, role: user.role, message: "Login Berhasil" });
        } else {
            res.json({ success: false, message: "Username atau Password salah!" });
        }
    });
});

app.listen(3000, () => {
    console.log("Server backend berjalan di http://localhost:3000");
});