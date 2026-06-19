function getToken() { return localStorage.getItem('token'); }
function setToken(t) { if (t) localStorage.setItem('token', t); else localStorage.removeItem('token'); }

async function api(path, opts = {}) {
  const headers = Object.assign({'Content-Type': 'application/json'}, opts.headers || {});
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`/api/${path}`, Object.assign({}, opts, { headers }));
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') && text ? JSON.parse(text) : { error: text || response.statusText };
  if (!response.ok) {
    throw new Error(data.error || response.statusText);
  }
  return data;
}

let currentUser = null;

function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function setCurrentUser(user) {
  currentUser = user;
  const el = document.getElementById('currentUser');
  const btn = document.getElementById('logout');
  const updateBtn = document.getElementById('updateProfile');
  const registerBtn = document.getElementById('register');
  const loginBtn = document.getElementById('login');
  if (!user) {
    el.textContent = 'Not logged in';
    btn.style.display = 'none';
    updateBtn.style.display = 'none';
    registerBtn.style.display = 'inline-block';
    loginBtn.style.display = 'inline-block';
    document.getElementById('authUsername').value = '';
    document.getElementById('authPassword').value = '';
    document.getElementById('authBio').value = '';
  } else {
    el.textContent = `Logged in as ${user.username}`;
    btn.style.display = 'inline-block';
    updateBtn.style.display = 'inline-block';
    registerBtn.style.display = 'none';
    loginBtn.style.display = 'none';
    document.getElementById('authUsername').value = user.username;
    document.getElementById('authPassword').value = '';
    document.getElementById('authBio').value = user.bio || '';
  }
}

function renderUsers(users) {
  const usersList = document.getElementById('usersList');
  usersList.innerHTML = '';
  users.forEach(u => {
    const d = document.createElement('div');
    d.className = 'users-row';
    d.innerHTML = `
      <div class="user-info">
        <div class="avatar">${(u.username || 'U').charAt(0).toUpperCase()}</div>
        <div>
          <strong>${u.username}</strong>
          <div class="user-bio">${u.bio || 'New to Pulse'}</div>
        </div>
      </div>
      <div>
        <div class="muted-text">${u.follower_count || 0} followers</div>
        <button data-id="${u.id}" class="follow-btn">${u.following ? 'Unfollow' : 'Follow'}</button>
      </div>`;
    usersList.appendChild(d);
  });
  document.querySelectorAll('.follow-btn').forEach(btn => btn.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    try {
      if (!getToken()) return alert('Please login to follow');
      await api(`users/${id}/follow`, { method: 'POST', body: JSON.stringify({}) });
      await loadUsers();
    } catch (error) {
      alert(error.message);
    }
  }));
}

async function loadUsers() {
  try {
    const users = await api('users');
    renderUsers(users);
  } catch (error) {
    console.error('Failed to load users', error);
  }
}

async function loadFeed() {
  try {
    const feed = document.getElementById('feed');
    const posts = await api('posts');
    feed.innerHTML = '';
    posts.forEach(p => {
      const el = document.createElement('div');
      el.className = 'post';
      el.innerHTML = `
        <div class="post-header">
          <div class="user-info">
            <div class="avatar">${(p.username || 'U').charAt(0).toUpperCase()}</div>
            <div class="post-meta">
              <strong>${p.username}</strong>
              <span class="muted-text">${p.created_at}</span>
            </div>
          </div>
          <span class="pill">${p.likes_count} likes</span>
        </div>
        <div class="content">${escapeHtml(p.content)}</div>
        <div class="post-footer">
          <div class="post-actions">
            <span class="pill">💬 ${p.comments_count} comments</span>
            <button data-id="${p.id}" class="like-btn">Like</button>
            <button data-id="${p.id}" class="comments-btn">Comments</button>
          </div>
        </div>
        <div class="comment-section" id="comments-${p.id}" style="display:none"></div>`;
      feed.appendChild(el);
    });
    document.querySelectorAll('.like-btn').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      try {
        if (!getToken()) return alert('Please login to like posts');
        await api(`posts/${id}/like`, { method: 'POST', body: JSON.stringify({}) });
        await loadFeed();
      } catch (error) {
        alert(error.message);
      }
    }));

    document.querySelectorAll('.comments-btn').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      const container = document.getElementById(`comments-${id}`);
      if (!container) return;
      if (container.style.display === 'block') {
        container.style.display = 'none';
        return;
      }
      try {
        const res = await api(`posts/${id}`);
        container.innerHTML = '';
        const list = document.createElement('div');
        res.comments.forEach(c => {
          const cEl = document.createElement('div');
          cEl.className = 'comment-item';
          cEl.innerHTML = `<strong>${c.username}</strong> — ${escapeHtml(c.content)}`;
          list.appendChild(cEl);
        });
        const form = document.createElement('div');
        form.className = 'comment-form';
        form.innerHTML = `<textarea id="comment-input-${id}" placeholder="Write a comment"></textarea><div class="button-row"><button id="comment-send-${id}" class="comment-send-btn" type="button">Send</button></div>`;
        container.appendChild(list);
        container.appendChild(form);
        container.style.display = 'block';
        document.getElementById(`comment-send-${id}`).addEventListener('click', async () => {
          try {
            if (!getToken()) return alert('Please login to comment');
            const content = document.getElementById(`comment-input-${id}`).value.trim();
            if (!content) return alert('Comment cannot be empty');
            await api(`posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
            const updated = await api(`posts/${id}`);
            list.innerHTML = '';
            updated.comments.forEach(c => {
              const cEl = document.createElement('div');
              cEl.className = 'comment-item';
              cEl.innerHTML = `<strong>${c.username}</strong> — ${escapeHtml(c.content)}`;
              list.appendChild(cEl);
            });
            document.getElementById(`comment-input-${id}`).value = '';
          } catch (error) {
            alert(error.message);
          }
        });
      } catch (error) {
        alert(error.message);
      }
    }));
  } catch (error) {
    console.error('Failed to load feed', error);
  }
}

function addEventListeners() {
  document.getElementById('register').addEventListener('click', async () => {
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    const bio = document.getElementById('authBio').value.trim();
    if (!username || !password) return alert('username and password required');
    try {
      const res = await api('auth/register', { method: 'POST', body: JSON.stringify({ username, password, bio }) });
      setToken(res.token);
      setCurrentUser(res.user);
      await loadUsers();
      await loadFeed();
    } catch (error) {
      alert(error.message);
    }
  });

  document.getElementById('login').addEventListener('click', async () => {
    const username = document.getElementById('authUsername').value.trim();
    const password = document.getElementById('authPassword').value;
    if (!username || !password) return alert('username and password required');
    try {
      const res = await api('auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      setToken(res.token);
      setCurrentUser(res.user);
      document.getElementById('authUsername').value = res.user.username;
      document.getElementById('authBio').value = res.user.bio || '';
      document.getElementById('updateProfile').style.display = 'inline-block';
      document.getElementById('register').style.display = 'none';
      document.getElementById('login').style.display = 'none';
      await loadUsers();
      await loadFeed();
    } catch (error) {
      alert(error.message);
    }
  });

  document.getElementById('updateProfile').addEventListener('click', async () => {
    const username = document.getElementById('authUsername').value.trim();
    const bio = document.getElementById('authBio').value.trim();
    if (!username) return alert('username required');
    if (!currentUser || !currentUser.id) return alert('Login first');
    try {
      const res = await api(`users/${currentUser.id}`, { method: 'PUT', body: JSON.stringify({ username, bio }) });
      setToken(res.token);
      setCurrentUser(res.user);
      alert('Profile updated successfully');
      await loadUsers();
      await loadFeed();
    } catch (error) {
      alert(error.message);
    }
  });

  document.getElementById('logout').addEventListener('click', async () => {
    setToken(null);
    setCurrentUser(null);
    await loadUsers();
    await loadFeed();
  });

  document.getElementById('createPost').addEventListener('click', async () => {
    const content = document.getElementById('postContent').value.trim();
    if (!content) return alert('content required');
    try {
      await api('posts', { method: 'POST', body: JSON.stringify({ content }) });
      document.getElementById('postContent').value = '';
      await loadFeed();
    } catch (error) {
      alert(error.message);
    }
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  if (getToken()) {
    try {
      const user = await api('auth/me');
      setCurrentUser(user);
    } catch (e) {
      setToken(null);
      setCurrentUser(null);
    }
  } else {
    setCurrentUser(null);
  }
  addEventListeners();
  await loadUsers();
  await loadFeed();
});
