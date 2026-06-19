const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const db = new sqlite3.Database('./data.db');

async function runSeed() {
  const seedUsers = [
    { id: 1, username: 'alice', bio: 'Hello I am Alice', password: 'alice123' },
    { id: 2, username: 'bob', bio: 'Hi Im Bob', password: 'bob123' },
    { id: 3, username: 'carol', bio: 'Designer', password: 'carol123' }
  ];

  const hashedUsers = await Promise.all(seedUsers.map(async (user) => ({
    ...user,
    hash: await bcrypt.hash(user.password, 10)
  })));

  db.serialize(() => {
    hashedUsers.forEach((user) => {
      db.run(
        "INSERT OR IGNORE INTO users (id, username, bio, password) VALUES (?, ?, ?, ?)",
        [user.id, user.username, user.bio, user.hash]
      );
      db.run(
        "UPDATE users SET password = ? WHERE username = ?",
        [user.hash, user.username]
      );
    });
    db.run("INSERT OR IGNORE INTO posts (id, user_id, content) VALUES (1, 1, 'Welcome to Mini Social!')");
    db.run("INSERT OR IGNORE INTO posts (id, user_id, content) VALUES (2, 2, 'Bob''s first post')");
    db.run("INSERT OR IGNORE INTO posts (id, user_id, content) VALUES (3, 3, 'Carol says hi')");
    db.run("INSERT OR IGNORE INTO comments (id, post_id, user_id, content) VALUES (1, 1, 2, 'Nice app!')");
    db.run("INSERT OR IGNORE INTO comments (id, post_id, user_id, content) VALUES (2, 1, 3, 'Looks great')");
    db.run("INSERT OR IGNORE INTO followers (id, user_id, follower_id) VALUES (1, 1, 2)");
    db.run("INSERT OR IGNORE INTO likes (id, post_id, user_id) VALUES (1, 1, 2)");
    console.log('Seed completed. Sample logins: alice/alice123, bob/bob123, carol/carol123');
    db.close();
  });
}

runSeed().catch((err) => {
  console.error('Seed failed', err);
  db.close();
});
