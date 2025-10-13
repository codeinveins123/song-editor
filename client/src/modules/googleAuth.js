import { setCurrentUser } from './state.js'
import { showSuccessPage } from './pages.js'

export const initializeGoogleAuth = (containerId, callback) => {
    if (!window.google) {
        console.log('Google API не загружена')
        createCustomGoogleButton(containerId, callback)
        return
    }
    
    google.accounts.id.initialize({
        client_id: '179244440593-9d5vb7jneb4ehqjto377tb6o6pvh3m56.apps.googleusercontent.com',
        callback: callback,
        context: 'signup'
    })
    
    google.accounts.id.renderButton(
        document.getElementById(containerId), 
        { 
            theme: 'outline', 
            size: 'large', 
            width: '100%', 
            text: 'continue_with' 
        }
    )
}

export const createCustomGoogleButton = (containerId, callback) => {
    const container = document.getElementById(containerId)
    container.innerHTML = `
        <button class="google-btn-custom" onclick="handleCustomGoogleAuth()">
            <span class="google-icon">G</span> Продолжить с Google
        </button>
    `
    
    window.handleCustomGoogleAuth = function() {
        const mockUser = { 
            id: 'google_' + Date.now(), 
            username: 'Google User', 
            email: 'user@gmail.com', 
            provider: 'google' 
        }
        
        const users = JSON.parse(localStorage.getItem('users') || '[]')
        if (!users.find(u => u.email === mockUser.email)) {
            users.push(mockUser)
        }
        
        localStorage.setItem('users', JSON.stringify(users))
        localStorage.setItem('currentUser', JSON.stringify(mockUser))
        setCurrentUser(mockUser)
        showSuccessPage()
    }
}

export const handleGoogleAuth = (response) => {
    const payload = JSON.parse(atob(response.credential.split('.')[1]))
    const userData = { 
        id: payload.sub, 
        username: payload.name, 
        email: payload.email, 
        picture: payload.picture, 
        provider: 'google' 
    }
    
    const users = JSON.parse(localStorage.getItem('users') || '[]')
    if (!users.find(u => u.email === userData.email)) {
        users.push(userData)
    }
    
    localStorage.setItem('users', JSON.stringify(users))
    localStorage.setItem('currentUser', JSON.stringify(userData))
    setCurrentUser(userData)
    showSuccessPage()
}