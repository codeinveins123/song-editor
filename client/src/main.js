import './styles/main.css'
import { setCurrentUser, getCurrentUser } from './modules/state.js'
import { setupNavListeners } from './modules/navigation.js'
import { showWelcomePage, showSuccessPage } from './modules/pages.js'
import { setupAuthForms } from './modules/auth.js'

document.addEventListener('DOMContentLoaded', function() {
    checkAuth()
    setupNavListeners()
    setupAuthForms()
})

async function checkAuth() {
    const savedUser = localStorage.getItem('currentUser')
    const token = localStorage.getItem('token')
    
    console.log('🔍 Проверка аутентификации...', { hasUser: !!savedUser, hasToken: !!token })
    
    if (savedUser && token) {
        try {
            // Проверяем токен на сервере и получаем актуальные данные пользователя
            console.log('🔄 Проверка токена на сервере...')
            const response = await fetch('http://localhost:3001/api/auth/profile', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            
            console.log('📡 Ответ сервера:', response.status, response.statusText)
            
            if (response.ok) {
                const data = await response.json()
                console.log('✅ Токен валиден, пользователь найден:', data.user)
                setCurrentUser({
                    ...data.user,
                    token: token
                })
                // Всегда показываем главную страницу как лэндинг
                showWelcomePage()
            } else {
                console.log('❌ Токен невалидный, очистка...')
                // Токен невалидный, очищаем
                setCurrentUser(null)
                showWelcomePage()
            }
        } catch (error) {
            console.error('❌ Ошибка проверки токена:', error)
            setCurrentUser(null)
            showWelcomePage()
        }
    } else {
        console.log('⚠️ Нет сохраненной сессии, показываем welcome')
        showWelcomePage()
    }
}