import { currentUser } from './state.js'
import { logout } from './auth.js'
import { showSongsPage } from './navigation.js'
import { initializeGoogleAuth, handleGoogleAuth } from './googleAuth.js'
import { setupAuthForms } from './auth.js'

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
    
    // Добавляем обработчики сразу после рендера
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
    
    // Инициализируем формы после рендера
    setTimeout(() => {
        setupAuthForms()
        initializeGoogleAuth('google-button', handleGoogleAuth)
    }, 0)
}

// Подтверждение кода
export const showVerificationForm = (email) => {
    const content = document.getElementById('content')
    content.innerHTML = `
        <div class="form-container">
            <h2>Подтверждение Email</h2>
            <p style="text-align:center;">Мы отправили код на <b>${email}</b></p>
            <form id="verify-form" class="auth-form">
                <div class="form-group">
                    <label for="code">Введите код:</label>
                    <input type="text" id="code" placeholder="6 цифр" maxlength="6" required />
                </div>
                <button type="submit" class="btn btn-primary btn-full">Подтвердить</button>
            </form>
        </div>
    `
    
    // Инициализируем форму подтверждения
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
    
    // Инициализируем формы после рендера
    setTimeout(() => {
        setupAuthForms()
        initializeGoogleAuth('google-button-login', handleGoogleAuth)
    }, 0)
}

// Успешная авторизация
export const showSuccessPage = () => {
    const content = document.getElementById('content')
    content.innerHTML = `
        <div class="user-section">
            <h2>Добро пожаловать, ${currentUser.username}! 🎸</h2>
            ${currentUser.picture ? `<img src="${currentUser.picture}" class="user-avatar">` : ""}
            <p class="user-email">${currentUser.email}</p>
            <div class="user-info-card">
                <h3>🎉 Успешная авторизация!</h3>
                <p>Теперь вы можете просматривать тексты песен с аккордами для гитары.</p>
            </div>
            <div class="actions">
                <button id="view-songs" class="btn btn-success">Смотреть песни</button>
                <button id="logout" class="btn btn-secondary">Выйти</button>
            </div>
        </div>
    `
    
    // Добавляем обработчики после рендера
    setTimeout(() => {
        document.getElementById('logout').addEventListener('click', logout)
        document.getElementById('view-songs').addEventListener('click', showSongsPage)
    }, 0)
}