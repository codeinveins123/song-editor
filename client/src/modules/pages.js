import { currentUser } from './state.js'
import { logout } from './auth.js'
import { showSongsPage } from './navigation.js'
import { initializeGoogleAuth, handleGoogleAuth } from './googleAuth.js'
import { setupAuthForms } from './auth.js'
import { changePassword, updateProfile, updateAvatar, getStats } from './api.js';
import {  showModal, showConfirmModal, showPromptModal,  showPasswordPrompt, showCurrentPasswordPrompt, showNewPasswordPrompt, showConfirmPasswordPrompt } from './modal.js';

// Главная страница
export const showWelcomePage = () => {
    const content = document.getElementById('content')
    content.innerHTML = `
        <div class="welcome-section">
            <h2>Добро пожаловать! 🎸</h2>
            <p>Тексты песен с аккордами для акустической гитары</p>
            
            <div class="auth-buttons">
                <button id="login-btn" class="btn btn-primary">Войти</button>
                <button id="register-btn" class="btn btn-primary">Зарегистрироваться</button>
            </div>
        </div>
    `
    
    document.getElementById('login-btn').addEventListener('click', showLoginForm)
    document.getElementById('register-btn').addEventListener('click', showRegisterForm)
}

// Регистрация
export const showRegisterForm = () => {
    const content = document.getElementById('content')
    content.innerHTML = `
        <div class="form-container">
            <h2>Регистрация</h2>
            <form id="register-form" class="auth-form">
                <div class="form-group">
                    <label for="username">Имя пользователя:</label>
                    <input type="text" id="username" required minlength="3" placeholder="Введите ваше имя">
                </div>
                <div class="form-group">
                    <label for="email">Email:</label>
                    <input type="email" id="email" required placeholder="your@email.com">
                </div>
                <div class="form-group">
                    <label for="password">Пароль:</label>
                    <input type="password" id="password" required minlength="6" placeholder="Не менее 6 символов">
                </div>
                <button type="submit" class="btn btn-primary btn-full">Зарегистрироваться</button>
            </form>
            
            <div class="divider"><span>или</span></div>
            <div class="google-auth"><div id="google-button"></div></div>
            
            <p class="auth-switch">
                Уже есть аккаунт? 
                <a href="#" id="show-login">Войти</a>
            </p>
        </div>
    `
    
    setTimeout(() => {
        setupAuthForms()
        initializeGoogleAuth('google-button', handleGoogleAuth)
    }, 0)
}

// Подтверждение кода
export const showVerificationForm = (email, tempUser) => {
    const content = document.getElementById('content')
    content.innerHTML = `
        <div class="form-container">
            <h2>Подтверждение Email</h2>
            <p style="text-align:center;">Мы отправили код на <b>${escapeHtml(email)}</b></p>
            <form id="verify-form" class="auth-form">
                <input type="hidden" id="verify-email" value="${escapeHtml(email)}">
                <input type="hidden" id="verify-user-data" value='${escapeHtml(JSON.stringify(tempUser))}'>
                <div class="form-group">
                    <label for="code">Введите код:</label>
                    <input type="text" id="code" placeholder="6 цифр" maxlength="6" required />
                </div>
                <button type="submit" class="btn btn-primary btn-full">Подтвердить</button>
            </form>
        </div>
    `
    
    setTimeout(() => {
        setupAuthForms()
    }, 0)
}

// Вход
export const showLoginForm = () => {
    const content = document.getElementById('content')
    content.innerHTML = `
        <div class="form-container">
            <h2>Вход в аккаунт</h2>
            <form id="login-form" class="auth-form">
                <div class="form-group">
                    <label for="login-email">Email:</label>
                    <input type="email" id="login-email" required placeholder="your@email.com">
                </div>
                <div class="form-group">
                    <label for="login-password">Пароль:</label>
                    <input type="password" id="login-password" required placeholder="Введите ваш пароль">
                </div>
                <button type="submit" class="btn btn-primary btn-full">Войти</button>
            </form>
            
            <div class="divider"><span>или</span></div>
            <div class="google-auth"><div id="google-button-login"></div></div>
            
            <p class="auth-switch">
                Нет аккаунта? <a href="#" id="show-register">Зарегистрироваться</a>
            </p>
        </div>
    `
    
    setTimeout(() => {
        setupAuthForms()
        initializeGoogleAuth('google-button-login', handleGoogleAuth)
    }, 0)
}

// Профиль пользователя
export const showSuccessPage = () => {
    const content = document.getElementById('content')
    content.innerHTML = `
        <div class="profile-section">
            <div class="profile-header">
                <div class="avatar-section">
                    <div class="avatar-container">
                        <img src="${escapeHtml(currentUser.picture_url || '/src/images/default-avatar.jpg')}" 
                             alt="Аватар" class="user-avatar" id="user-avatar">
                        <button class="avatar-upload-btn" id="change-avatar">
                            <span class="upload-icon">📷</span>
                        </button>
                    </div>
                    <input type="file" id="avatar-input" accept="image/jpeg, image/jpg, image/png" style="display: none;">
                </div>
                
                <div class="profile-info">
                    <h1>${escapeHtml(currentUser.username)}</h1>
                    <p class="user-email">📧 ${escapeHtml(currentUser.email)}</p>
                    <p class="user-provider">
                        ${currentUser.provider === 'google' ? '🔗 Вход через Google' : '✉️ Вход через Email'}
                    </p>
                    <p class="member-since">🎸 Участник с ${escapeHtml(new Date(currentUser.created_at).toLocaleDateString('ru-RU'))}</p>
                </div>
            </div>

            <div class="profile-content">
                <div class="profile-card">
                    <h3>👋 О себе</h3>
                    <div class="bio-section">
                        <textarea id="user-bio" class="bio-textarea" 
                                  placeholder="Расскажите о себе, ваших музыкальных предпочтениях или опыте игры...">${escapeHtml(currentUser.bio || '')}</textarea>
                        <button id="save-bio" class="btn btn-primary">Сохранить</button>
                    </div>
                </div>

                <div class="profile-card">
                    <h3>⚙️ Настройки аккаунта</h3>
                    <div class="settings-grid">
                        <div class="setting-item">
                            <label>Имя пользователя:</label>
                            <div class="setting-value">
                                <span>${escapeHtml(currentUser.username)}</span>
                                <button class="btn-small ${currentUser.provider === 'google' ? 'btn-disabled' : ''}" 
                                        id="change-username"
                                        ${currentUser.provider === 'google' ? 'title="Для Google аккаунтов имя пользователя нельзя изменить"' : ''}>
                                    Изменить
                                </button>
                            </div>
                        </div>
                        
                        <div class="setting-item">
                            <label>Смена пароля:</label>
                            <div class="setting-value">
                                <span>••••••</span>
                                <button class="btn-small ${currentUser.provider === 'google' ? 'btn-disabled' : ''}" 
                                        id="change-password"
                                        ${currentUser.provider === 'google' ? 'title="Для Google аккаунтов пароль меняется через Google аккаунт"' : ''}>
                                    Изменить
                                </button>
                            </div>
                        </div>
                        
                        <div class="setting-item">
                            <label>Уведомления:</label>
                            <div class="setting-value">
                                <label class="toggle">
                                    <input type="checkbox" id="notifications" ${currentUser.notifications !== false ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                                <span>Электронные уведомления</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="profile-card stats-card">
                    <h3>📊 Статистика</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-number" id="songs-count">0</div>
                            <div class="stat-label">Добавлено песен</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number" id="favorites-count">0</div>
                            <div class="stat-label">В избранном</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number" id="activity-days">1</div>
                            <div class="stat-label">Дней с нами</div>
                        </div>
                    </div>
                </div>

                <div class="actions-section">
                    <button id="view-songs" class="btn btn-success">
                        🎵 Мои песни
                    </button>
                    <button id="add-song" class="btn btn-primary">
                        ➕ Добавить песню
                    </button>
                    <button id="logout" class="btn btn-secondary">
                        🚪 Выйти
                    </button>
                </div>
            </div>
        </div>
    `
    
    setTimeout(() => {
        setupProfileListeners()
        loadUserStats()
    }, 0)
}

// Настройка обработчиков профиля
function setupProfileListeners() {
    document.getElementById('logout').addEventListener('click', handleLogout)
    document.getElementById('view-songs').addEventListener('click', showSongsPage)
    document.getElementById('add-song').addEventListener('click', showAddSongForm)
    
    // Смена аватара
    document.getElementById('change-avatar').addEventListener('click', () => {
        document.getElementById('avatar-input').click()
    })
    
    document.getElementById('avatar-input').addEventListener('change', handleAvatarUpload)
    
    // Сохранение био
    document.getElementById('save-bio').addEventListener('click', saveBio)
    
    // Смена имени пользователя - с проверкой Google
    document.getElementById('change-username').addEventListener('click', (e) => {
        if (currentUser.provider === 'google') {
            e.preventDefault();
            showModal('Информация', 'Для Google аккаунтов имя пользователя нельзя изменить', 'info');
            return;
        }
        changeUsername();
    })
    
    // Смена пароля - с проверкой Google
    document.getElementById('change-password').addEventListener('click', (e) => {
        if (currentUser.provider === 'google') {
            e.preventDefault();
            showModal('Информация', 'Для Google аккаунтов пароль меняется через настройки Google аккаунта', 'info');
            return;
        }
        changePasswordProfile();
    })
    
    // Настройка уведомлений
    document.getElementById('notifications').addEventListener('change', toggleNotifications)
}

// Обработчик выхода с подтверждением
async function handleLogout() {
    const confirmed = await showConfirmModal('Подтверждение выхода', 'Вы уверены, что хотите выйти из аккаунта?');
    if (confirmed) {
        await logout();
    }
}

// Загрузка статистики пользователя
async function loadUserStats() {
  try {
    const stats = await getStats();
    
    document.getElementById('songs-count').textContent = stats.songsCount;
    document.getElementById('favorites-count').textContent = stats.favoritesCount;
    document.getElementById('activity-days').textContent = stats.activityDays;
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error);
    // Устанавливаем значения по умолчанию
    document.getElementById('songs-count').textContent = '0';
    document.getElementById('favorites-count').textContent = '0';
    document.getElementById('activity-days').textContent = '1';
  }
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Двойная проверка типа файла
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
        showModal('Ошибка', 'Пожалуйста, выберите файл в формате JPEG или PNG', 'error');
        e.target.value = ''; // Очищаем input
        return;
    }
    
    // Проверка размера файла (макс. 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        showModal('Ошибка', 'Размер файла не должен превышать 5MB', 'error');
        e.target.value = ''; // Очищаем input
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const avatarUrl = e.target.result;
        document.getElementById('user-avatar').src = avatarUrl;
        
        try {
            await updateAvatar(avatarUrl);
            currentUser.picture_url = avatarUrl;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showModal('Успех', 'Аватар успешно обновлен!', 'success');
        } catch (error) {
            console.error('Ошибка обновления аватара:', error);
            showModal('Ошибка', 'Ошибка обновления аватара: ' + error.message, 'error');
        }
    };
    reader.readAsDataURL(file);
}

async function saveBio() {
  const bio = document.getElementById('user-bio').value;
  const notifications = document.getElementById('notifications').checked;
  
  try {
    await updateProfile({
      bio: bio,
      notifications: notifications
    });
    showModal('Успех', 'Профиль успешно обновлен!', 'success');
  } catch (error) {
    showModal('Ошибка', 'Ошибка сохранения профиля: ' + error.message, 'error');
  }
}

async function changeUsername() {
    const newUsername = await showPromptModal(
        'Изменение имени пользователя', 
        'Введите новое имя пользователя', 
        currentUser.username
    );
    
    if (newUsername && newUsername.trim() && newUsername !== currentUser.username) {
        try {
            const response = await updateProfile({
                username: newUsername.trim()
            });
            
            // ОБНОВЛЯЕМ currentUser с сервера
            if (response && response.user) {
                currentUser.username = response.user.username;
                currentUser.bio = response.user.bio;
                currentUser.notifications = response.user.notifications;
                
                // ОБНОВЛЯЕМ localStorage
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                
                showModal('Успех', 'Имя пользователя успешно изменено!', 'success');
                showSuccessPage(); // Перезагружаем страницу профиля
            }
        } catch (error) {
            showModal('Ошибка', 'Ошибка изменения имени: ' + error.message, 'error');
        }
    }
}

async function changePasswordProfile() {
  // Используем специализированные функции для паролей
  const currentPassword = await showCurrentPasswordPrompt();
  if (!currentPassword) return;
  
  const newPassword = await showNewPasswordPrompt();
  if (!newPassword) return;
  
  if (newPassword.length < 6) {
    showModal('Ошибка', 'Пароль должен содержать не менее 6 символов!', 'error');
    return;
  }
  
  const confirmPassword = await showConfirmPasswordPrompt();
  if (newPassword !== confirmPassword) {
    showModal('Ошибка', 'Пароли не совпадают!', 'error');
    return;
  }
  
  try {
    await changePassword(currentPassword, newPassword);
    showModal('Успех', 'Пароль успешно изменен!', 'success');
  } catch (error) {
    showModal('Ошибка', 'Ошибка изменения пароля: ' + error.message, 'error');
  }
}

function toggleNotifications(e) {
  const enabled = e.target.checked;
  // Сохраняем автоматически при изменении
  setTimeout(async () => {
    try {
      await updateProfile({
        notifications: enabled
      });
      console.log(`Уведомления ${enabled ? 'включены' : 'отключены'}`);
    } catch (error) {
      console.error('Ошибка сохранения настроек уведомлений:', error);
      // Возвращаем переключатель в исходное состояние при ошибке
      e.target.checked = !enabled;
    }
  }, 500);
}

// Форма добавления песни
const showAddSongForm = () => {
    const content = document.getElementById('content')
    content.innerHTML = `
        <div class="form-container">
            <h2>Добавить песню</h2>
            <form id="add-song-form" class="auth-form">
                <div class="form-group">
                    <label for="song-title">Название песни:</label>
                    <input type="text" id="song-title" required placeholder="Название песни">
                </div>
                <div class="form-group">
                    <label for="song-artist">Исполнитель:</label>
                    <input type="text" id="song-artist" required placeholder="Имя исполнителя">
                </div>
                <div class="form-group">
                    <label for="song-chords">Аккорды:</label>
                    <input type="text" id="song-chords" placeholder="Am C G D (через пробел)">
                </div>
                <div class="form-group">
                    <label for="song-lyrics">Текст песни:</label>
                    <textarea id="song-lyrics" required rows="10" placeholder="Введите текст песни с аккордами..."></textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-full">Добавить песню</button>
                <button type="button" id="cancel-add-song" class="btn btn-secondary btn-full">Отмена</button>
            </form>
        </div>
    `
    
    document.getElementById('add-song-form').addEventListener('submit', handleAddSong)
    document.getElementById('cancel-add-song').addEventListener('click', showSuccessPage)
}

const handleAddSong = async (e) => {
    e.preventDefault()
    const title = document.getElementById('song-title').value.trim()
    const artist = document.getElementById('song-artist').value.trim()
    const chords = document.getElementById('song-chords').value.trim()
    const lyrics = document.getElementById('song-lyrics').value.trim()

    try {
        // Здесь будет вызов API для добавления песни
        showModal('Успех', `Песня "${escapeHtml(title)}" добавлена!`, 'success');
        showSuccessPage()
    } catch (error) {
        showModal('Ошибка', 'Ошибка при добавлении песни: ' + error.message, 'error');
    }
}

// Утилита для экранирования HTML
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}