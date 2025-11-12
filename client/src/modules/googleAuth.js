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
        <button class="google-btn-custom" onclick="handleCustomGoogleAuth()" aria-label="Продолжить с Google">
            <span class="google-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12  s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C33.49,6.053,29.046,4,24,4C12.955,4,4,12.955,4,24  s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,16.108,18.961,14,24,14c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657  C33.49,6.053,29.046,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.191-5.238C29.211,35.091,26.715,36,24,36  c-5.202,0-9.619-3.317-11.283-7.946l-6.54,5.038C9.505,39.556,16.227,44,24,44z"/>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.094,5.571  c0.001-0.001,0.002-0.001,0.003-0.002l6.191,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
              </svg>
            </span>
            <span class="google-text">Продолжить с Google</span>
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