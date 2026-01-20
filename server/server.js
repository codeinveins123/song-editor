import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import cron from 'node-cron';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

dotenv.config();

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 3001;

// Увеличиваем лимит размера запроса
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Базовые HTTP-заголовки безопасности
app.use(helmet({ contentSecurityPolicy: false }));

// Middleware CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://song-editor.netlify.app/'
];
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Ограничение частоты запросов к API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60
});
app.use('/api/', apiLimiter);

// CSP Headers for security
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://api.emailjs.com; " +
    "font-src 'self' data:; " +
    "frame-src 'self' https://accounts.google.com https://www.youtube.com https://www.youtube-nocookie.com; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';"
  );
  next();
});

app.use(express.json());

// Serve static files from client/public directory
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, '../client/public')));

// Favicon route
app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

// Подключение к PostgreSQL (Supabase)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Для разработки, в продакшене используйте сертификат
  }
});

// Обработка ошибок подключения к БД
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Проверка подключения к БД
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('❌ Ошибка подключения к базе данных:', err);
  } else {
    console.log('✅ Подключение к базе данных установлено');
  }
});

// Создание таблиц при запуске
async function initDatabase() {
  try {
    // Таблица пользователей
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        provider VARCHAR(20) DEFAULT 'email',
        picture_url TEXT,
        google_id VARCHAR(100),
        bio TEXT,
        is_verified BOOLEAN DEFAULT FALSE,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Добавляем колонки если их нет
    try {
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications BOOLEAN DEFAULT FALSE');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 0');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE');
      
      // Добавляем колонки для мягкого удаления
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS delete_requested_at TIMESTAMP DEFAULT NULL');
      
      // Добавляем новые колонки в songs
      await pool.query('ALTER TABLE songs ADD COLUMN IF NOT EXISTS genre VARCHAR(50)');
      await pool.query('ALTER TABLE songs ADD COLUMN IF NOT EXISTS rhythm VARCHAR(100)');
      await pool.query('ALTER TABLE songs ADD COLUMN IF NOT EXISTS description TEXT');
      await pool.query('ALTER TABLE songs ADD COLUMN IF NOT EXISTS content TEXT');
      await pool.query('ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE');
      await pool.query('ALTER TABLE songs ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN DEFAULT TRUE');
      await pool.query('ALTER TABLE songs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      await pool.query('ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE');
    } catch (error) {
      console.log('Колонки уже существуют или ошибка добавления:', error.message);
    }
  
    // Таблица песен
    await pool.query(`
      CREATE TABLE IF NOT EXISTS songs (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        artist VARCHAR(100) NOT NULL,
        genre VARCHAR(50),
        rhythm VARCHAR(100),
        description TEXT,
        lyrics TEXT NOT NULL,
        content TEXT,
        chords TEXT,
        is_public BOOLEAN DEFAULT TRUE,
        allow_comments BOOLEAN DEFAULT TRUE,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица кодов верификации
    await pool.query(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        email VARCHAR(100) NOT NULL,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Добавляем колонки если их нет
    try {
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications BOOLEAN DEFAULT FALSE');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 0');
      
      // Добавляем новые колонки в songs
      await pool.query('ALTER TABLE songs ADD COLUMN IF NOT EXISTS genre VARCHAR(50)');
      await pool.query('ALTER TABLE songs ADD COLUMN IF NOT EXISTS rhythm VARCHAR(100)');
      await pool.query('ALTER TABLE songs ADD COLUMN IF NOT EXISTS description TEXT');
      await pool.query('ALTER TABLE songs ADD COLUMN IF NOT EXISTS content TEXT');
      await pool.query('ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT TRUE');
      await pool.query('ALTER TABLE songs ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN DEFAULT TRUE');
      await pool.query('ALTER TABLE songs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    } catch (error) {
      console.log('Колонки уже существуют или ошибка добавления:', error.message);
    }

    // Таблица голосов за пользователей (лайк/дизлайк)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_ratings (
        target_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        voter_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        value INTEGER NOT NULL CHECK (value IN (-1, 0, 1)),
        PRIMARY KEY (target_user_id, voter_user_id)
      )
    `);

    console.log('✅ Таблицы базы данных созданы');
  } catch (error) {
    console.error('❌ Ошибка создания таблиц:', error);
  }
}

// Middleware для проверки токена
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Токен отсутствует' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Неверный токен' });
    }
    
    // Проверяем что пользователь все еще активен (не заблокирован и не удален)
    try {
      const userResult = await pool.query('SELECT is_blocked, deleted_at, delete_requested_at, username, email FROM users WHERE id = $1', [user.userId]);
      if (userResult.rows.length === 0) {
        return res.status(403).json({ error: 'Пользователь не найден' });
      }
      
      const userData = userResult.rows[0];
      
      if (userData.is_blocked) {
        return res.status(403).json({ error: 'Ваш аккаунт заблокирован администратором' });
      }
      
      if (userData.deleted_at) {
        // Для удаленных аккаунтов просто устанавливаем req.user и продолжаем
        req.user = { ...user, isDeleted: true };
        next();
        return;
      }
    } catch (error) {
      console.error('Error checking user status:', error);
      return res.status(500).json({ error: 'Ошибка проверки статуса пользователя' });
    }
    
    req.user = user;
    next();
  });
};

// Опционально извлекаем userId из токена, если он есть (без обязательной аутентификации)
function getOptionalUserId(req) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return null;
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload && payload.userId ? payload.userId : null;
  } catch {
    return null;
  }
}

//  Регистрация с верификацией email
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Валидация данных
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Все поля обязательны' });
    }

    // Проверяем, есть ли пользователь
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь уже существует' });
    }

    // Генерируем код верификации
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Сохраняем код в базу
    await pool.query(
      'INSERT INTO verification_codes (email, code, expires_at) VALUES ($1, $2, $3)',
      [email, code, expiresAt]
    );

    // Возвращаем код на фронтенд, чтобы отправить через EmailJS там
    res.json({
      message: 'Код верификации сгенерирован',
      code: code, // Отправляем код на фронтенд
      email: email,
      tempUser: { username, email } // НЕ включаем пароль в ответ!
    });

  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
  }
});

// Публичный профиль пользователя по username
app.get('/api/users/public/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const userRes = await pool.query(
      'SELECT id, username, email, provider, picture_url, bio, created_at FROM users WHERE username = $1',
      [username]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const user = userRes.rows[0];
    const ratingRes = await pool.query(
      'SELECT COALESCE(SUM(value), 0) as rating FROM user_ratings WHERE target_user_id = $1',
      [user.id]
    );
    const rating = parseInt(ratingRes.rows[0].rating) || 0;

    const songsResult = await pool.query(
      'SELECT COUNT(*) as count FROM songs WHERE created_by = $1',
      [user.id]
    );
    const songsCount = parseInt(songsResult.rows[0].count) || 0;
    const joinDate = new Date(user.created_at);
    const activityDays = Math.max(1, Math.floor((new Date() - joinDate) / (1000 * 60 * 60 * 24)));

    res.json({ user: { ...user, rating, songsCount, activityDays } });
  } catch (error) {
    console.error('Ошибка получения публичного профиля:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Поставить/изменить оценку пользователю: value = 1 (лайк), -1 (дизлайк), 0 (снять голос)
app.put('/api/users/:id/rate', authenticateToken, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const voterUserId = req.user.userId;
    const { value } = req.body;

    if (![1, 0, -1].includes(value)) {
      return res.status(400).json({ error: 'Некорректное значение голоса' });
    }
    if (targetUserId === voterUserId) {
      return res.status(400).json({ error: 'Нельзя голосовать за себя' });
    }

    await pool.query(
      `INSERT INTO user_ratings (target_user_id, voter_user_id, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (target_user_id, voter_user_id)
       DO UPDATE SET value = EXCLUDED.value`,
      [targetUserId, voterUserId, value]
    );

    const ratingRes = await pool.query(
      'SELECT COALESCE(SUM(value), 0) as rating FROM user_ratings WHERE target_user_id = $1',
      [targetUserId]
    );
    const rating = parseInt(ratingRes.rows[0].rating) || 0;

    res.json({ message: 'Оценка сохранена', rating });
  } catch (error) {
    console.error('Ошибка голосования:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 🔐 Подтверждение email
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { email, code, userData } = req.body;

    console.log('Проверка email:', email, 'код:', code);

    // Проверяем код
    const codeResult = await pool.query(
      'SELECT * FROM verification_codes WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()',
      [email, code]
    );

    if (codeResult.rows.length === 0) {
      console.log('Неверный или просроченный код');
      return res.status(400).json({ error: 'Неверный или просроченный код' });
    }

    // Хешируем пароль
    const passwordHash = await bcrypt.hash(userData.password, 10);

    // Создаем пользователя
    const userResult = await pool.query(
      `INSERT INTO users (username, email, password_hash) 
       VALUES ($1, $2, $3) RETURNING id, username, email, provider, created_at`,
      [userData.username, userData.email, passwordHash]
    );

    // Помечаем код как использованный
    await pool.query(
      'UPDATE verification_codes SET used = TRUE WHERE id = $1',
      [codeResult.rows[0].id]
    );

    // Генерируем токен
    const token = jwt.sign(
      { userId: userResult.rows[0].id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    const newUser = {
      ...userResult.rows[0],
      bio: null,
      notifications: false
    };
    
    res.json({
      message: 'Email успешно подтвержден',
      user: newUser,
      token
    });

  } catch (error) {
    console.error('Ошибка верификации email:', error);
    res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
  }
});

// 🔐 Вход
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Ищем пользователя
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }

    const user = result.rows[0];

    // Проверяем пароль
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Неверный email или пароль' });
    }

    // Проверяем, не заблокирован ли пользователь
    if (user.is_blocked) {
      return res.status(403).json({ error: 'Ваш аккаунт заблокирован администратором' });
    }

    // Генерируем токен
    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Вход выполнен',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        provider: user.provider,
        picture_url: user.picture_url,
        bio: user.bio || null,
        notifications: user.notifications || false,
        is_verified: user.is_verified || false,
        is_admin: user.is_admin || false,
        is_blocked: user.is_blocked || false,
        created_at: user.created_at
      },
      token
    });

  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 🎯 Google Auth
app.post('/api/auth/google', async (req, res) => {
  try {
    const { email, username, picture, googleId } = req.body;

    // Валидация данных
    if (!email || !googleId) {
      return res.status(400).json({ error: 'Email и Google ID обязательны' });
    }

    // Проверяем, есть ли пользователь
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR google_id = $2',
      [email, googleId]
    );

    let user;

    if (userExists.rows.length > 0) {
      // Пользователь уже существует - обновляем данные Google
      user = userExists.rows[0];
      await pool.query(
        'UPDATE users SET username = COALESCE($1, username), picture_url = $2, google_id = $3, provider = $4 WHERE id = $5',
        [username, picture, googleId, 'google', user.id]
      );
    } else {
      // Создаем нового пользователя
      const result = await pool.query(
        `INSERT INTO users (username, email, provider, picture_url, google_id) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, provider, picture_url, created_at`,
        [username || email.split('@')[0], email, 'google', picture, googleId]
      );
      user = result.rows[0];
    }

    // Генерируем токен
    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Google авторизация успешна',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        provider: user.provider,
        picture_url: user.picture_url,
        bio: user.bio || null,
        notifications: user.notifications || false,
        is_verified: user.is_verified || false,
        is_admin: user.is_admin || false,
        created_at: user.created_at
      },
      token
    });

  } catch (error) {
    console.error('Ошибка Google авторизации:', error);
    res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
  }
});

// 🔄 Google OAuth Callback для popup flow
app.get('/auth/google/callback', (req, res) => {
  const { code, state, error } = req.query;
  
  if (error) {
    return res.send(`
      <script>
        window.opener.postMessage({
          type: 'google_auth_error',
          error: '${error}'
        }, window.location.origin);
        window.close();
      </script>
    `);
  }
  
  if (!code || !state) {
    return res.send(`
      <script>
        window.opener.postMessage({
          type: 'google_auth_error',
          error: 'Missing authorization code or state'
        }, window.location.origin);
        window.close();
      </script>
    `);
  }
  
  // Проверяем state
  const storedState = sessionStorage.getItem('google_auth_state');
  if (state !== storedState) {
    return res.send(`
      <script>
        window.opener.postMessage({
          type: 'google_auth_error',
          error: 'Invalid state parameter'
        }, window.location.origin);
        window.close();
      </script>
    `);
  }
  
  // Обмениваем code на токен и получаем данные пользователя
 /*  fetch(`http://localhost:3001/api/auth/google/exchange?code=${encodeURIComponent(code)}`) */
 fetch(`https://song-editor.onrender.com/api/auth/google/exchange?code=${encodeURIComponent(code)}`)
    .then(response => response.json())
    .then(data => {
      if (data.error) {
        throw new Error(data.error);
      }
      
      res.send(`
        <script>
          window.opener.postMessage({
            type: 'google_auth_success',
            userData: ${JSON.stringify(data.user)}
          }, window.location.origin);
          window.close();
        </script>
      `);
    })
    .catch(error => {
      res.send(`
        <script>
          window.opener.postMessage({
            type: 'google_auth_error',
            error: '${error.message}'
          }, window.location.origin);
          window.close();
        </script>
      `);
    });
});

// 🔄 Обмен authorization code на данные пользователя
app.get('/api/auth/google/exchange', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }
    
    // Обмениваем code на access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${process.env.CLIENT_URL || 'https://song-editor.netlify.app'}/auth/google/callback`
        /* redirect_uri: `${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/google/callback` */
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error_description || tokenData.error });
    }
    
    // Получаем данные пользователя
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });
    
    const userData = await userResponse.json();
    
    if (userData.error) {
      return res.status(400).json({ error: userData.error.message });
    }
    
    // Используем существующую логику Google auth
    const { email, name, picture, id } = userData;
    
    // Проверяем, есть ли пользователь
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR google_id = $2',
      [email, id]
    );

    let user;

    if (userExists.rows.length > 0) {
      // Пользователь уже существует - обновляем данные Google
      user = userExists.rows[0];
      await pool.query(
        'UPDATE users SET username = COALESCE($1, username), picture_url = $2, google_id = $3, provider = $4 WHERE id = $5',
        [name, picture, id, 'google', user.id]
      );
    } else {
      // Создаем нового пользователя
      const result = await pool.query(
        `INSERT INTO users (username, email, provider, picture_url, google_id) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, provider, picture_url, created_at`,
        [name || email.split('@')[0], email, 'google', picture, id]
      );
      user = result.rows[0];
    }

    // Генерируем токен
    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        provider: user.provider,
        picture_url: user.picture_url,
        bio: user.bio || null,
        notifications: user.notifications || false,
        is_verified: user.is_verified || false,
        is_admin: user.is_admin || false,
        created_at: user.created_at
      },
      token
    });
    
  } catch (error) {
    console.error('Ошибка обмена Google code:', error);
    res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
  }
});

// 👤 Получить профиль
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, provider, picture_url, bio, notifications, is_verified, is_admin, is_blocked, deleted_at, delete_requested_at, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Ошибка получения профиля:', error);
    res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
  }
});

// 🎵 Добавить песню
app.post('/api/songs', authenticateToken, async (req, res) => {
  try {
    const { title, artist, genre, rhythm, description, lyrics, content, chords, is_public, allow_comments } = req.body;
    const userId = req.user.userId;

    console.log('🎵 Добавление песни:', { title, artist, genre, rhythm, description });

    const result = await pool.query(
      `INSERT INTO songs (title, artist, genre, rhythm, description, lyrics, content, chords, is_public, allow_comments, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [title, artist, genre || null, rhythm || null, description || null, lyrics || content, content || lyrics, chords || null, is_public !== false, allow_comments !== false, userId]
    );

    res.json({
      message: 'Песня добавлена',
      song: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка добавления песни:', error);
    res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
  }
});

// 🎵 Получить все песни
app.get('/api/songs', async (req, res) => {
  try {
    const userId = getOptionalUserId(req);
    let query;
    let params = [];
    if (userId) {
      // Публичные + собственные приватные, исключая заблокированных пользователей
      query = `
        SELECT s.id, s.title, s.artist, s.genre, s.rhythm, s.description, s.lyrics, s.content, s.chords,
               s.is_public, s.allow_comments, s.created_at, s.updated_at, s.is_verified,
               u.username as author
        FROM songs s
        LEFT JOIN users u ON s.created_by = u.id
        WHERE (s.is_public = TRUE OR s.created_by = $1) 
        AND (u.is_blocked IS NULL OR u.is_blocked = FALSE)
        AND (u.deleted_at IS NULL)
        ORDER BY s.created_at DESC
      `;
      params = [userId];
    } else {
      // Только публичные, исключая заблокированных пользователей
      query = `
        SELECT s.id, s.title, s.artist, s.genre, s.rhythm, s.description, s.lyrics, s.content, s.chords,
               s.is_public, s.allow_comments, s.created_at, s.updated_at, s.is_verified,
               u.username as author
        FROM songs s
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.is_public = TRUE 
        AND (u.is_blocked IS NULL OR u.is_blocked = FALSE)
        AND (u.deleted_at IS NULL)
        ORDER BY s.created_at DESC
      `;
    }
    const result = await pool.query(query, params);
    res.json({ songs: result.rows });
  } catch (error) {
    console.error('Ошибка получения песен:', error);
    res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
  }
});

// 🎵 Получить мои песни (для авторизованного пользователя)
app.get('/api/songs/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await pool.query(`
      SELECT s.*, u.username as author 
      FROM songs s 
      LEFT JOIN users u ON s.created_by = u.id 
      WHERE s.created_by = $1
      ORDER BY s.created_at DESC
    `, [userId]);

    res.json({ songs: result.rows });
  } catch (error) {
    console.error('Ошибка получения моих песен:', error);
    res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
  }
});

// 🎵 Получить одну песню
app.get('/api/songs/:id', async (req, res) => {
  try {
    const songId = req.params.id;
    const requesterId = getOptionalUserId(req);

    const result = await pool.query(`
      SELECT s.*, u.username as author, u.id as author_id, u.is_blocked as author_blocked, u.deleted_at as author_deleted
      FROM songs s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = $1
    `, [songId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Песня не найдена' });
    }

    const song = result.rows[0];
    
    // Если автор заблокирован и запрашивающий не является автором
    if (song.author_blocked && requesterId !== song.created_by) {
      return res.status(404).json({ error: 'Песня не найдена' });
    }
    
    // Если автор удалил аккаунт и запрашивающий не является автором
    if (song.author_deleted && requesterId !== song.created_by) {
      return res.status(404).json({ error: 'Песня не найдена' });
    }
    if (song.is_public !== true) {
      // приватная: доступ только автору (роль модератора добавим позже)
      if (!requesterId || requesterId !== song.created_by) {
        return res.status(403).json({ error: 'Недостаточно прав для просмотра этой песни' });
      }
    }

    res.json({ song });
  } catch (error) {
    console.error('Ошибка получения песни:', error);
    res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
  }
});

// 🎵 Обновить песню
app.put('/api/songs/:id', authenticateToken, async (req, res) => {
  try {
    const songId = req.params.id;
    const userId = req.user.userId;
    const { title, artist, genre, rhythm, description, lyrics, content, chords, is_public, allow_comments } = req.body;

    // Проверяем, что песня принадлежит пользователю
    const checkResult = await pool.query(
      'SELECT created_by FROM songs WHERE id = $1',
      [songId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Песня не найдена' });
    }

    if (checkResult.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'У вас нет прав на редактирование этой песни' });
    }

    const result = await pool.query(
      `UPDATE songs SET title = $1, artist = $2, genre = $3, rhythm = $4, description = $5, 
              lyrics = $6, content = $7, chords = $8, is_public = $9, allow_comments = $10, updated_at = CURRENT_TIMESTAMP
       WHERE id = $11 
       RETURNING *`,
      [title, artist, genre || null, rhythm || null, description || null, lyrics || content, content || lyrics, chords || null, is_public !== false, allow_comments !== false, songId]
    );

    res.json({
      message: 'Песня обновлена',
      song: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка обновления песни:', error);
    res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
  }
});

// 🎵 Удалить песню
app.delete('/api/songs/:id', authenticateToken, async (req, res) => {
  try {
    const songId = req.params.id;
    const userId = req.user.userId;

    // Проверяем, что песня принадлежит пользователю
    const checkResult = await pool.query(
      'SELECT created_by FROM songs WHERE id = $1',
      [songId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Песня не найдена' });
    }

    if (checkResult.rows[0].created_by !== userId) {
      return res.status(403).json({ error: 'У вас нет прав на удаление этой песни' });
    }

    await pool.query('DELETE FROM songs WHERE id = $1', [songId]);

    res.json({ message: 'Песня удалена' });
  } catch (error) {
    console.error('Ошибка удаления песни:', error);
    res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
  }
});

// 🏥 Проверка здоровья
app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'Сервер работает!', 
    timestamp: new Date().toISOString() 
  });
});

// Запуск сервера
app.listen(PORT, async () => {
  await initDatabase();
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📊 База данных: ${process.env.DB_NAME}`);
});

// 🔐 Смена пароля
app.put('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Получаем пользователя
    const userResult = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = userResult.rows[0];

    // Проверяем текущий пароль
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'Неверный текущий пароль' });
    }

    // Хешируем новый пароль
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Обновляем пароль
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, userId]
    );

    res.json({ message: 'Пароль успешно изменен' });

  } catch (error) {
    console.error('Ошибка смены пароля:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 👤 Обновление профиля
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { username, bio, notifications } = req.body;
    const userId = req.user.userId;

    console.log('📝 Обновление профиля для пользователя:', userId);
    console.log('📝 Данные:', { username, bio, notifications });

    // Получаем текущего пользователя
    const currentUserResult = await pool.query(
      'SELECT provider, username FROM users WHERE id = $1',
      [userId]
    );

    if (currentUserResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const userProvider = currentUserResult.rows[0].provider;
    const currentUsername = currentUserResult.rows[0].username;
    let updateQuery, queryParams;

    if (userProvider === 'google') {
      // Для Google - только bio и notifications (не обновляем username и picture_url)
      updateQuery = `UPDATE users SET bio = $1, notifications = $2 WHERE id = $3 
                     RETURNING id, username, email, provider, picture_url, bio, notifications, created_at`;
      queryParams = [bio, notifications, userId];
    } else {
      // Для email - обновляем username только если он предоставлен
      if (username !== undefined && username !== null && username.trim() !== '') {
        // Обновляем username, bio и notifications
        updateQuery = `UPDATE users SET username = $1, bio = $2, notifications = $3 WHERE id = $4 
                       RETURNING id, username, email, provider, picture_url, bio, notifications, created_at`;
        queryParams = [username.trim(), bio, notifications, userId];
      } else {
        // Только bio и notifications
        updateQuery = `UPDATE users SET bio = $1, notifications = $2 WHERE id = $3 
                       RETURNING id, username, email, provider, picture_url, bio, notifications, created_at`;
        queryParams = [bio, notifications, userId];
      }
    }

    const result = await pool.query(updateQuery, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    console.log('✅ Профиль обновлен:', result.rows[0]);

    res.json({
      message: 'Профиль обновлен',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Ошибка обновления профиля:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 📸 Обновление аватара
app.put('/api/auth/avatar', authenticateToken, async (req, res) => {
  try {
    const { avatarUrl } = req.body;
    const userId = req.user.userId;

    console.log('🖼️ Обновление аватара для пользователя:', userId);

    // Проверяем что это base64 изображение
    if (!avatarUrl || !avatarUrl.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Некорректный формат изображения' });
    }

    // Обновляем аватар в базе
    const result = await pool.query(
      `UPDATE users SET picture_url = $1 WHERE id = $2 
       RETURNING id, username, email, provider, picture_url, created_at`,
      [avatarUrl, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    console.log('✅ Аватар обновлен');

    res.json({
      message: 'Аватар обновлен',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Ошибка обновления аватара:', error);
    res.status(500).json({ error: 'Ошибка сервера при обновлении аватара' });
  }
});

// 📊 Получение статистики пользователя
// Admin endpoints
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    // Проверяем, является ли пользователь администратором
    const user = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
    if (!user.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await pool.query('SELECT id, username, email, is_verified, is_admin, is_blocked, created_at FROM users');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/admin/users/:id/block', authenticateToken, async (req, res) => {
  try {
    // Проверяем, является ли пользователь администратором
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { id } = req.params;
    const { blocked } = req.body;
    
    // Нельзя заблокировать самого себя
    if (parseInt(id) === parseInt(req.user.userId)) {
      return res.status(400).json({ error: 'Нельзя заблокировать самого себя' });
    }
    
    // Обновляем статус блокировки пользователя
    await pool.query('UPDATE users SET is_blocked = $1 WHERE id = $2', [blocked, id]);
    
    // Если блокируем пользователя, удаляем его токен (вынуждая выйти из системы)
    if (blocked) {
      // В реальном приложении здесь можно добавить токен в черный список
      // Или просто пользователь не сможет войти при следующей попытке
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating user block status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Загрузка изображения
app.post('/api/upload/image', authenticateToken, async (req, res) => {
  try {
    // Проверяем, является ли пользователь администратором или подтвержденным
    const userCheck = await pool.query('SELECT is_admin, is_verified FROM users WHERE id = $1', [req.user.userId]);
    const user = userCheck.rows[0];
    
    if (!user.is_admin && !user.is_verified) {
      return res.status(403).json({ error: 'Только подтвержденные пользователи могут загружать изображения' });
    }

    // Здесь должна быть логика загрузки файла
    // Пока просто вернем заглушку
    res.json({ 
      url: `https://picsum.photos/seed/${Date.now()}/800/600.jpg`,
      message: 'Изображение загружено (временно используется заглушка)' 
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Ошибка загрузки изображения' });
  }
});

// Валидация YouTube URL
function validateYouTubeUrl(url) {
  const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[5] : null;
}

// Получение информации о YouTube видео
app.post('/api/video/youtube-info', authenticateToken, async (req, res) => {
  try {
    const { url } = req.body;
    const videoId = validateYouTubeUrl(url);
    
    if (!videoId) {
      return res.status(400).json({ error: 'Неверный URL YouTube видео' });
    }

    // Возвращаем информацию о видео (заглушка)
    res.json({
      videoId: videoId,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      title: 'YouTube Video'
    });
  } catch (error) {
    console.error('Error getting YouTube info:', error);
    res.status(500).json({ error: 'Ошибка получения информации о видео' });
  }
});

app.get('/api/admin/songs', authenticateToken, async (req, res) => {
  try {
    // Проверяем, является ли пользователь администратором
    const user = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
    if (!user.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await pool.query(`
      SELECT s.*, u.username as author_username, u.is_blocked as author_blocked
      FROM songs s 
      LEFT JOIN users u ON s.created_by = u.id 
      ORDER BY s.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all songs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/admin/songs/:id/verify', authenticateToken, async (req, res) => {
  try {
    // Проверяем, является ли пользователь администратором
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { id } = req.params;
    const { verified } = req.body;

    await pool.query('UPDATE songs SET is_verified = $1 WHERE id = $2', [verified, id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating song verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/admin/songs/:id', authenticateToken, async (req, res) => {
  try {
    // Проверяем, является ли пользователь администратором
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.userId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { id } = req.params;
    await pool.query('DELETE FROM songs WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting song:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Количество песен пользователя
    const songsResult = await pool.query(
      'SELECT COUNT(*) as count FROM songs WHERE created_by = $1',
      [userId]
    );

    // Количество дней с регистрации
    const userResult = await pool.query(
      'SELECT created_at FROM users WHERE id = $1',
      [userId]
    );

  const songsCount = parseInt(songsResult.rows[0].count);
  const joinDate = new Date(userResult.rows[0].created_at);
  const daysSinceJoin = Math.floor((new Date() - joinDate) / (1000 * 60 * 60 * 24));

  // Текущий рейтинг пользователя — сумма голосов по нему
  const ratingResult = await pool.query(
    'SELECT COALESCE(SUM(value), 0) as rating FROM user_ratings WHERE target_user_id = $1',
    [userId]
  );
  const rating = parseInt(ratingResult.rows[0].rating) || 0;

  res.json({
    songsCount: songsCount,
    rating: rating,
    activityDays: Math.max(1, daysSinceJoin)
  });

} catch (error) {
  console.error('Ошибка получения статистики:', error);
  res.status(500).json({ error: 'Ошибка сервера' });
}
});

// Удаление своего аккаунта с возможностью восстановления
app.delete('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Проверяем, не удален ли уже аккаунт
    const userCheck = await pool.query(
      'SELECT deleted_at FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows[0].deleted_at) {
      return res.status(400).json({ 
        error: 'Аккаунт уже удален',
        deletedAt: userCheck.rows[0].deleted_at
      });
    }

    // Помечаем аккаунт для удаления через 14 дней
    const result = await pool.query(
      `UPDATE users 
       SET deleted_at = NOW() + INTERVAL '14 days',
           delete_requested_at = NOW()
       WHERE id = $1
       RETURNING id, username, email, deleted_at, delete_requested_at`,
      [userId]
    );

    console.log(`User ${userId} requested account deletion on ${result.rows[0].delete_requested_at}`);

    res.json({
      message: 'Ваш аккаунт будет удален через 14 дней. Вы можете восстановить его в течение этого периода.',
      deletedAt: result.rows[0].deleted_at,
      deleteRequestedAt: result.rows[0].delete_requested_at
    });

  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Отмена удаления аккаунта
app.post('/api/auth/profile/cancel-delete', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Проверяем, удален ли аккаунт
    const userCheck = await pool.query(
      'SELECT deleted_at FROM users WHERE id = $1',
      [userId]
    );

    if (!userCheck.rows[0].deleted_at) {
      return res.status(400).json({ error: 'Аккаунт не удален' });
    }

    // Отменяем удаление
    const result = await pool.query(
      `UPDATE users 
       SET deleted_at = NULL,
           delete_requested_at = NULL
       WHERE id = $1
       RETURNING id, username, email`,
      [userId]
    );

    console.log(`User ${userId} cancelled account deletion`);

    res.json({
      message: 'Удаление аккаунта отменено',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Error cancelling account deletion:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение информации о статусе удаления аккаунта
app.get('/api/auth/profile/deletion-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT deleted_at, delete_requested_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = result.rows[0];

    res.json({
      isDeleted: !!user.deleted_at,
      deletedAt: user.deleted_at,
      deleteRequestedAt: user.delete_requested_at
    });

  } catch (error) {
    console.error('Error getting deletion status:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Настройка задачи для очистки удаленных аккаунтов
function setupCleanupJob() {
  // Запускаем каждый день в полночь
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('Starting cleanup job for deleted accounts...');
      
      // Находим аккаунты, которые должны быть удалены навсегда
      const usersToDelete = await pool.query(`
        SELECT id, username, email 
        FROM users 
        WHERE deleted_at IS NOT NULL 
        AND deleted_at <= NOW()
      `);

      if (usersToDelete.rows.length > 0) {
        // Удаляем каждого пользователя и его песни
        for (const user of usersToDelete.rows) {
          try {
            // Сначала удаляем все песни пользователя
            await pool.query('DELETE FROM songs WHERE created_by = $1', [user.id]);
            
            // Затем удаляем самого пользователя
            await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
            
            console.log(`Permanently deleted user ${user.email} (${user.id}) and all their songs`);
          } catch (deleteError) {
            console.error(`Error deleting user ${user.id}:`, deleteError);
          }
        }
        
        console.log(`Cleanup completed: ${usersToDelete.rows.length} accounts permanently deleted`);
      } else {
        console.log('Cleanup completed: No accounts to delete');
      }
    } catch (error) {
      console.error('Error in cleanup job:', error);
    }
  });

  console.log('Cleanup job scheduled to run daily at midnight');
}

// Запускаем задачу очистки при старте сервера
setupCleanupJob();
