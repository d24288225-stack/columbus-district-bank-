const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
require('./seed-on-start.js');
const app = express();
const db = new sqlite3.Database('./db.sqlite');

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'columbus-district-bank-2025',
  resave: false,
  saveUninitialized: false
}));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    is_admin BOOLEAN DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS credits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL,
    added_by TEXT,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pending_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER,
    to_email TEXT,
    amount REAL,
    status TEXT DEFAULT 'pending',
    requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    FOREIGN KEY(from_user_id) REFERENCES users(id)
  )`);
});

app.get('/', (req, res) => res.render('login'));
app.get('/login', (req, res) => res.render('login'));

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err || !user) return res.send('Invalid credentials');
    bcrypt.compare(password, user.password, (err, match) => {
      if (match) {
        req.session.user = user;
        res.redirect(user.is_admin ? '/admin' : '/user-dashboard');
      } else {
        res.send('Invalid credentials');
      }
    });
  });
});

app.get('/user-dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const user = req.session.user;

  db.get(`SELECT SUM(amount) as balance FROM credits WHERE user_id = ?`, [user.id], (err, row) => {
    const balance = row.balance || 0;
    db.all(`SELECT * FROM pending_transfers WHERE from_user_id = ? ORDER BY requested_at DESC`, [user.id], (err, transfers) => {
      res.render('user-dashboard', { user, balance, transfers });
    });
  });
});

app.post('/transfer', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const { to_email, amount } = req.body;
  const from_user_id = req.session.user.id;

  if (!to_email || !amount || amount <= 0) return res.send('Invalid transfer');

  db.run(
    `INSERT INTO pending_transfers (from_user_id, to_email, amount) VALUES (?, ?, ?)`,
    [from_user_id, to_email, amount],
    () => res.redirect('/user-dashboard')
  );
});

app.get('/admin', (req, res) => {
  if (!req.session.user || req.session.user.email !== 'admin@columbusbank.edu') {
    return res.status(403).send('Access Denied');
  }

  db.all(`SELECT u.name, u.email, u.id FROM users WHERE is_admin = 0`, [], (err, users) => {
    db.all(`
      SELECT p.*, u.name as from_name 
      FROM pending_transfers p 
      JOIN users u ON p.from_user_id = u.id 
      WHERE p.status = 'pending'
      ORDER BY p.requested_at DESC
    `, [], (err, pending) => {
      res.render('admin-dashboard', { users, pending });
    });
  });
});

app.post('/admin/add-credit', (req, res) => {
  if (!req.session.user || req.session.user.email !== 'admin@columbusbank.edu') {
    return res.status(403).send('Unauthorized');
  }

  const { userId, amount } = req.body;
  if (!userId || !amount || amount <= 0) return res.redirect('/admin');

  db.run(
    `INSERT INTO credits (user_id, amount, added_by) VALUES (?, ?, ?)`,
    [userId, amount, req.session.user.email],
    () => res.redirect('/admin')
  );
});

app.post('/admin/approve/:id', (req, res) => {
  if (!req.session.user || req.session.user.email !== 'admin@columbusbank.edu') return res.status(403).send('Unauthorized');
  const id = req.params.id;
  db.run(`UPDATE pending_transfers SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [req.session.user.email, id], () => res.redirect('/admin'));
});

app.post('/admin/reject/:id', (req, res) => {
  if (!req.session.user || req.session.user.email !== 'admin@columbusbank.edu') return res.status(403).send('Unauthorized');
  const id = req.params.id;
  db.run(`UPDATE pending_transfers SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [req.session.user.email, id], () => res.redirect('/admin'));
});

app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Columbus District Bank running on port ${PORT}`);
});
