import { pendingUser, setPendingUser, setCurrentUser, verificationCode, setVerificationCode } from './state.js'
import { sendVerificationCode } from './emailService.js'
import { showVerificationForm, showSuccessPage, showLoginForm, showRegisterForm } from './pages.js'
import { initializeGoogleAuth, handleGoogleAuth } from './googleAuth.js'

// Регистрация
export const handleRegister = async (e) => {
    e.preventDefault()
    const username = document.getElementById('username').value.trim()
    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value.trim()

    const users = JSON.parse(localStorage.getItem('users') || '[]')
    if (users.find(u => u.email === email)) {
        alert('Пользователь с таким email уже существует!')
        return
    }

    // Генерируем код
    const code = Math.floor(100000 + Math.random() * 900000)
    setVerificationCode(code)

    setPendingUser({ 
        id: Date.now(), 
        username, 
        email, 
        password, 
        provider: 'email' 
    })

    try {
        await sendVerificationCode(email, code)
        showVerificationForm(email)
    } catch (err) {
        alert(err.message)
    }
}

// Подтверждение кода
export const handleCodeVerification = (e) => {
    e.preventDefault()
    const code = document.getElementById('code').value.trim()
    
    if (code === String(verificationCode)) {
        const users = JSON.parse(localStorage.getItem('users') || '[]')
        users.push(pendingUser)
        localStorage.setItem('users', JSON.stringify(users))
        localStorage.setItem('currentUser', JSON.stringify(pendingUser))
        setCurrentUser(pendingUser)
        setPendingUser(null)
        setVerificationCode(null)
        showSuccessPage()
    } else {
        alert("Неверный код. Проверьте почту.")
    }
}

// Вход
export const handleLogin = (e) => {
    e.preventDefault()
    const email = document.getElementById('login-email').value
    const password = document.getElementById('login-password').value
    const users = JSON.parse(localStorage.getItem('users') || '[]')
    const user = users.find(u => u.email === email && u.password === password)
    
    if (user) {
        setCurrentUser(user)
        localStorage.setItem('currentUser', JSON.stringify(user))
        showSuccessPage()
    } else {
        alert("Неверный email или пароль!")
    }
}

// Выход
export const logout = () => {
    localStorage.removeItem('currentUser')
    setCurrentUser(null)
    window.location.reload()
}

// Инициализация форм авторизации
export const setupAuthForms = () => {
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