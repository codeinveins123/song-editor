import { handleGoogleAuthSuccess } from './auth.js'

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
    
    window.handleCustomGoogleAuth = async function() {
        const mockUser = { 
            username: 'Google User', 
            email: 'user@gmail.com',
            picture: null,
            googleId: 'google_' + Date.now()
        }
        
        await handleGoogleAuthSuccess(mockUser)
    }
}

export const handleGoogleAuth = async (response) => {
    const payload = JSON.parse(atob(response.credential.split('.')[1]))
    const userData = { 
        username: payload.name, 
        email: payload.email, 
        picture: payload.picture,
        googleId: payload.sub  // добавляем googleId
    }
    
    await handleGoogleAuthSuccess(userData)
}