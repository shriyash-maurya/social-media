const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 1111;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbFile = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    bio TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_id INTEGER,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS followers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    follower_id INTEGER,
    UNIQUE(user_id, follower_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER,
    user_id INTEGER,
    UNIQUE(post_id, user_id)
  )`);
});

// Ensure users table has a password column (simple migration)
db.all("PRAGMA table_info(users)", (err, cols) => {
  if (!err) {
    const hasPassword = cols.some(c => c.name === 'password');
    if (!hasPassword) {
      db.run('ALTER TABLE users ADD COLUMN password TEXT', (e) => {
        if (e) console.error('Failed to add password column', e.message);
      });
    }
  }
});

function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'missing authorization' });
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'invalid authorization format' });
  const token = parts[1];
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: 'invalid token' });
    req.user = payload; next();
  });
}

// Auth
app.post('/api/auth/register', async (req, res) => {
  const { username, password, bio } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, bio, password) VALUES (?, ?, ?)');
    stmt.run(username, bio || '', hash, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const user = { id: this.lastID, username, bio: bio || '' };
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
      res.json({ user, token });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  db.get('SELECT id, username, bio, password FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(400).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, user.password || '');
    if (!ok) return res.status(400).json({ error: 'invalid credentials' });
    const payload = { id: user.id, username: user.username, bio: user.bio };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: payload, token });
  });
});

// Users
app.post('/api/users', (req, res) => {
  const { username, bio } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  const stmt = db.prepare('INSERT INTO users (username, bio) VALUES (?, ?)');
  stmt.run(username, bio || '', function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, username, bio: bio || '' });
  });
});

app.put('/api/users/:id', authenticate, (req, res) => {
  const userId = Number(req.params.id);
  if (req.user.id !== userId) return res.status(403).json({ error: 'forbidden' });
  const { username, bio } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  db.run('UPDATE users SET username = ?, bio = ? WHERE id = ?', [username, bio || '', userId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    const updatedUser = { id: userId, username, bio: bio || '' };
    const token = jwt.sign(updatedUser, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: updatedUser, token });
  });
});

app.get('/api/users', (req, res) => {
  // allow optional auth to mark which users current user is following
  const authHeader = req.headers.authorization;
  let currentUserId = null;
  if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
    try { const payload = jwt.verify(authHeader.split(' ')[1], JWT_SECRET); currentUserId = payload.id; } catch (e) { currentUserId = null; }
  }
  const sql = `SELECT id, username, bio,
    (SELECT COUNT(*) FROM followers f WHERE f.user_id = users.id) AS follower_count
    FROM users`;
  db.all(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!currentUserId) return res.json(rows);
    db.all('SELECT user_id FROM followers WHERE follower_id = ?', [currentUserId], (err2, followingRows) => {
      if (err2) return res.status(500).json({ error: err2.message });
      const followingSet = new Set(followingRows.map(r => r.user_id));
      const out = rows.map(r => ({ ...r, following: followingSet.has(r.id) }));
      res.json(out);
    });
  });
});

// return current user from token
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json(req.user);
});

app.get('/api/users/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT id, username, bio FROM users WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  });
});

// Follow / unfollow
app.post('/api/users/:id/follow', authenticate, (req, res) => {
  const userId = req.params.id;
  const follower_id = req.user.id;
  db.get('SELECT id FROM followers WHERE user_id = ? AND follower_id = ?', [userId, follower_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) {
      db.run('DELETE FROM followers WHERE id = ?', [row.id], function (err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ following: false });
      });
    } else {
      const stmt = db.prepare('INSERT INTO followers (user_id, follower_id) VALUES (?, ?)');
      stmt.run(userId, follower_id, function (e) {
        if (e) return res.status(500).json({ error: e.message });
        res.json({ following: true });
      });
    }
  });
});

// Posts
app.post('/api/posts', authenticate, (req, res) => {
  const user_id = req.user.id;
  const { content } = req.body;
  if (!user_id || !content) return res.status(400).json({ error: 'content required' });
  const stmt = db.prepare('INSERT INTO posts (user_id, content) VALUES (?, ?)');
  stmt.run(user_id, content, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, user_id, content });
  });
});

app.get('/api/posts', (req, res) => {
  const sql = `SELECT p.id, p.user_id, p.content, p.created_at, u.username,
    (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes_count,
    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count
    FROM posts p JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC`;
  db.all(sql, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/posts/:id', (req, res) => {
  const postId = req.params.id;
  db.get('SELECT p.id, p.user_id, p.content, p.created_at, u.username FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?', [postId], (err, post) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!post) return res.status(404).json({ error: 'post not found' });
    db.all('SELECT c.id, c.user_id, c.content, c.created_at, u.username FROM comments c JOIN users u ON u.id = c.user_id WHERE c.post_id = ? ORDER BY c.created_at', [postId], (err2, comments) => {
      if (err2) return res.status(500).json({ error: err2.message });
      db.get('SELECT COUNT(*) as likes FROM likes WHERE post_id = ?', [postId], (err3, likeRow) => {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json({ post, comments, likes: likeRow.likes });
      });
    });
  });
});

// Comments
app.post('/api/posts/:id/comments', authenticate, (req, res) => {
  const postId = req.params.id;
  const user_id = req.user.id;
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });
  const stmt = db.prepare('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)');
  stmt.run(postId, user_id, content, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, post_id: postId, user_id, content });
  });
});

// Likes (toggle)
app.post('/api/posts/:id/like', authenticate, (req, res) => {
  const postId = req.params.id;
  const user_id = req.user.id;
  db.get('SELECT id FROM likes WHERE post_id = ? AND user_id = ?', [postId, user_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) {
      db.run('DELETE FROM likes WHERE id = ?', [row.id], function (e) {
        if (e) return res.status(500).json({ error: e.message });
        res.json({ liked: false });
      });
    } else {
      const stmt = db.prepare('INSERT INTO likes (post_id, user_id) VALUES (?, ?)');
      stmt.run(postId, user_id, function (e) {
        if (e) return res.status(500).json({ error: e.message });
        res.json({ liked: true });
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
