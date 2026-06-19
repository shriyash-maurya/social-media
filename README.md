# Mini Social Media App

A mini social media platform built with **Express.js** (backend) and **HTML/CSS/JavaScript** (frontend) using **SQLite** for data storage.

## Feature

✅ **User Profiles** — Create account, update name and bio  
✅ **Posts & Feed** — Create posts, view all posts  
✅ **Comments** — Add comments to posts  
✅ **Likes** — Like/unlike posts  
✅ **Follow System** — Follow/unfollow users  
✅ **Authentication** — Login & register with JWT  

---

## Installation & Setup

### 1. Navigate to Project Directory

```bash
cd "/home/blackbird/Desktop/social meadia"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Seed Sample Data (Optional)

Populate the database with 3 sample users and posts:

```bash
npm run seed
```

### 4. Start the Server

```bash
npm start
```

**Expected output:**
```
Server listening on http://localhost:1111
```

### 5. Open in Browser

Open your browser and go to:

```
http://localhost:1111
```

---

## Login Credentials

After seeding, use these sample accounts to test the app:

| Username | Password | Bio |
|----------|----------|-----|
| `alice` | `alice123` | Hello I am Alice |
| `bob` | `bob123` | Hi Im Bob |
| `carol` | `carol123` | Designer |

---

## How to Use

### Register a New Account

1. Open http://localhost:1111
2. In the **"Your account"** card, enter:
   - `username` (any name)
   - `password` (your password)
   - `bio` (optional)
3. Click **"Register"**
4. You are now logged in

### Login

1. Enter your `username` and `password`
2. Click **"Login"**
3. Your username appears under "Your account"

### Update Your Profile

After logging in:

1. Edit the `username` or `bio` fields
2. Click **"Update Profile"**
3. Your changes are saved and a new login token is issued

### Create a Post

1. Go to the **"Create Post"** card
2. Type your message in the text area
3. Click **"Post"**
4. Your post appears at the top of the **Feed**

### Like a Post

1. In the **Feed**, click the **"Like"** button on any post
2. The like counter updates

### Comment on a Post

1. In the **Feed**, click the **"Comments"** button on any post
2. Existing comments appear
3. Type your comment in the text box
4. Click **"Send"**
5. Your comment is added

### Follow/Unfollow Users

1. In the **Users** sidebar on the right, find any user
2. Click **"Follow"** to follow them
3. Click **"Unfollow"** to unfollow
4. The follower count updates

### Logout

1. Click **"Logout"** button in the auth card
2. You are logged out and return to the login screen

---

## Project Structure

```
/home/blackbird/Desktop/social meadia/
├── server.js          # Express backend (port 1111)
├── public/
│   ├── index.html     # UI layout
│   ├── app.js         # Frontend logic
│   └── styles.css     # Styling
├── data.db            # SQLite database (auto-created)
├── seed.js            # Sample data script
├── package.json       # Dependencies
└── README.md          # This file
```

---

## API Endpoints

### Authentication

- `POST /api/auth/register` — Create new user
- `POST /api/auth/login` — Login and get JWT token
- `GET /api/auth/me` — Get current user (requires auth)

### Users

- `GET /api/users` — List all users with follower counts
- `PUT /api/users/:id` — Update user profile (username/bio)
- `POST /api/users/:id/follow` — Follow/unfollow user (toggle)

### Posts

- `POST /api/posts` — Create post (requires auth)
- `GET /api/posts` — Get all posts
- `GET /api/posts/:id` — Get post with comments and likes

### Comments

- `POST /api/posts/:id/comments` — Add comment (requires auth)

### Likes

- `POST /api/posts/:id/like` — Like/unlike post (toggle, requires auth)

---

## Database

The app uses **SQLite** with these tables:

- **users** — username, bio, password (hashed with bcrypt)
- **posts** — user_id, content, created_at
- **comments** — post_id, user_id, content, created_at
- **followers** — user_id, follower_id
- **likes** — post_id, user_id

Database file: `data.db` (created automatically on first run)

---

## Environment Variables

Optional configuration:

```bash
# Set custom port (default: 1111)
export PORT=8080

# Set custom JWT secret (default: 'dev_secret', use production secret for deployments)
export JWT_SECRET="your_production_secret_here"
```

Then start:

```bash
npm start
```

---

## Troubleshooting

### Port 1111 is already in use

If you see `EADDRINUSE: address already in use :::1111`, either:
1. Kill the process on port 1111:
   ```bash
   lsof -i :1111 | grep node | awk '{print $2}' | xargs kill
   ```
2. Use a different port:
   ```bash
   PORT=2222 npm start
   # Then open http://localhost:2222
   ```

### UI looks stale or not updating

1. Refresh the browser page (Ctrl+R or Cmd+R)
2. Clear browser cache if needed

### Seeded accounts not logging in

Re-run the seed script:

```bash
npm run seed
```

---

## Tech Stack

- **Backend:** Node.js + Express.js
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Database:** SQLite3
- **Auth:** JWT + bcrypt
- **Middleware:** body-parser, cors

---

## Notes

- Tokens expire in 7 days by default.
- Passwords are hashed with bcrypt (salt rounds: 10).
- CORS is enabled for all origins (development only).
- The database is persistent; data is stored in `data.db`.
