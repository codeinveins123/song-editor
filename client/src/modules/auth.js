import { setCurrentUser, clearAuthState } from './state.js'
import { showVerificationForm, showSuccessPage, showLoginForm, showRegisterForm } from './pages.js'
import { initializeGoogleAuth, handleGoogleAuth } from './googleAuth.js'
import { authAPI } from './api.js'
import emailjs from '@emailjs/browser'

// Инициализация EmailJS
emailjs.init("DCJDcWp4UuFK8O6GQ");

// Регистрация
export const handleRegister = async (e) => {
    e.preventDefault()
    const username = document.getElementById('username').value.trim()
    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value.trim()

    console.log('📝 Начало регистрации:', { username, email, password })

    try {
        // Регистрируем пользователя на сервере (получаем код)
        console.log('🔄 Отправка запроса на сервер...')
        const response = await authAPI.register({ username, email, password })
        console.log('✅ Ответ сервера:', response)
        
        // Отправляем email с кодом через EmailJS на фронтенде
        console.log('📧 Отправка email...')
        await sendVerificationEmail(email, response.code)
        console.log('✅ Email отправлен')
        
        // Показываем форму верификации
        console.log('📝 Показ формы верификации')
        showVerificationForm(email, response.tempUser)
    } catch (error) {
        console.error('❌ Ошибка регистрации:', error)
        alert('Ошибка: ' + error.message)
    }
}

// Функция отправки email через EmailJS
async function sendVerificationEmail(email, code) {
    const expireTime = new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString([], { 
        hour: "2-digit", 
        minute: "2-digit" 
    })

    try {
        await emailjs.send("service_hcsxffy", "template_8gmrnbu", {
            passcode: code,
            time: expireTime,
            to_email: email
        }, "DCJDcWp4UuFK8O6GQ")

        console.log("✅ Email отправлен с кодом:", code)
    } catch (err) {
        console.error("❌ Ошибка отправки email:", err)
        throw new Error("Не удалось отправить письмо. Проверь настройки EmailJS.")
    }
}

// Подтверждение кода
export const handleCodeVerification = async (e) => {
    e.preventDefault()
    const code = document.getElementById('code').value.trim()
    const email = document.getElementById('verify-email').value
    const userData = JSON.parse(document.getElementById('verify-user-data').value)

    console.log('🔐 Проверка кода:', { email, code })

    try {
        console.log('🔄 Отправка кода на сервер...')
        const response = await authAPI.verifyEmail(email, code, userData)
        console.log('✅ Код подтвержден:', response)
        
        setCurrentUser({
            ...response.user,
            token: response.token
        })
        
        console.log('✅ Пользователь зарегистрирован')
        showSuccessPage()
    } catch (error) {
        console.error('❌ Ошибка верификации:', error)
        alert('Ошибка: ' + error.message)
    }
}

// Вход
export const handleLogin = async (e) => {
    e.preventDefault()
    const email = document.getElementById('login-email').value
    const password = document.getElementById('login-password').value
    
    console.log('🔑 Попытка входа:', { email })
    
    try {
        const response = await authAPI.login(email, password)
        console.log('✅ Вход выполнен:', response)
        
        setCurrentUser({
            ...response.user,
            token: response.token
        })
        
        showSuccessPage()
    } catch (error) {
        console.error('❌ Ошибка входа:', error)
        alert('Ошибка входа: ' + error.message)
    }
}

// Выход
export const logout = () => {
    clearAuthState()
    window.location.reload()
}

// Google Auth функция
export const handleGoogleAuthSuccess = async (userData) => {
    try {
        const response = await authAPI.googleAuth(userData)
        
        setCurrentUser({
            ...response.user,
            token: response.token
        })
        
        showSuccessPage()
    } catch (error) {
        alert('Ошибка Google авторизации: ' + error.message)
    }
}

// Инициализация форм авторизации
export const setupAuthForms = () => {
    // Регистрация
    const registerForm = document.getElementById('register-form')
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister)
    }

    // Вход
    const loginForm = document.getElementById('login-form')
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin)
    }

    // Подтверждение кода
    const verifyForm = document.getElementById('verify-form')
    if (verifyForm) {
        verifyForm.addEventListener('submit', handleCodeVerification)
    }

    // Ссылки между формами
    const showLoginLink = document.getElementById('show-login')
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault()
            showLoginForm()
        })
    }

    const showRegisterLink = document.getElementById('show-register')
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault()
            showRegisterForm()
        })
    }

    // Google Auth кнопки
    const googleButton = document.getElementById('google-button')
    if (googleButton) {
        initializeGoogleAuth('google-button', handleGoogleAuth)
    }

    const googleButtonLogin = document.getElementById('google-button-login')
    if (googleButtonLogin) {
        initializeGoogleAuth('google-button-login', handleGoogleAuth)
    }
}