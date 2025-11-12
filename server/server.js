import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 3001;

// Увеличиваем лимит размера запроса
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware CORS
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Подключение к PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
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
        notifications BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    console.log('✅ Таблицы базы данных созданы');
  } catch (error) {
    console.error('❌ Ошибка создания таблиц:', error);
  }
}

// Middleware для проверки токена
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Токен отсутствует' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Неверный токен' });
    }
    req.user = user;
    next();
  });
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
      tempUser: { username, email, password }
    });

  } catch (error) {
    console.error('Ошибка регистрации:', error);
    res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
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
        'UPDATE users SET username = $1, picture_url = $2, google_id = $3 WHERE id = $4',
        [username, picture, googleId, user.id]
      );
    } else {
      // Создаем нового пользователя
      const result = await pool.query(
        `INSERT INTO users (username, email, provider, picture_url, google_id) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, provider, picture_url, created_at`,
        [username, email, 'google', picture, googleId]
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
        created_at: user.created_at
      },
      token
    });

  } catch (error) {
    console.error('Ошибка Google авторизации:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 👤 Получить профиль
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, provider, picture_url, bio, notifications, created_at FROM users WHERE id = $1',
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
    // Получаем все публичные песни или песни текущего пользователя
    const result = await pool.query(`
      SELECT s.id, s.title, s.artist, s.genre, s.rhythm, s.description, s.lyrics, s.content, s.chords, 
             s.is_public, s.allow_comments, s.created_at, s.updated_at,
             u.username as author
      FROM songs s 
      LEFT JOIN users u ON s.created_by = u.id 
      WHERE s.is_public = TRUE
      ORDER BY s.created_at DESC
    `);

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
    
    const result = await pool.query(`
      SELECT s.*, u.username as author, u.id as author_id
      FROM songs s 
      LEFT JOIN users u ON s.created_by = u.id 
      WHERE s.id = $1
    `, [songId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Песня не найдена' });
    }

    res.json({ song: result.rows[0] });
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

    res.json({
      songsCount: songsCount,
      favoritesCount: 0, // можно добавить функционал избранного
      activityDays: Math.max(1, daysSinceJoin)
    });

  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});