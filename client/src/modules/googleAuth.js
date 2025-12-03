import { handleGoogleAuthSuccess } from './auth.js'
import { showModal } from './modal.js'

export const initializeGoogleAuth = (containerId, callback) => {
    // Загружаем Google Sign-In script если еще не загружен
    if (!window.google) {
        console.log('🔄 Загрузка Google Sign-In API...')
        loadGoogleScript(() => {
            initializeGoogleSignIn(containerId, callback)
        })
    } else {
        initializeGoogleSignIn(containerId, callback)
    }
}

// Загрузка Google Sign-In скрипта
function loadGoogleScript(callback) {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = callback
    script.onerror = () => {
        console.error('❌ Не удалось загрузить Google Sign-In API')
        createCustomGoogleButton(containerId, callback)
    }
    document.head.appendChild(script)
}

// Инициализация Google Sign-In
function initializeGoogleSignIn(containerId, callback) {
    try {
        google.accounts.id.initialize({
            client_id: '179244440593-9d5vb7jneb4ehqjto377tb6o6pvh3m56.apps.googleusercontent.com',
            callback: callback,
            context: 'signup',
            auto_select: false,
            cancel_on_tap_outside: true
        })
        
        google.accounts.id.renderButton(
            document.getElementById(containerId), 
            { 
                theme: 'outline', 
                size: 'large', 
                width: 300, 
                text: 'continue_with',
                shape: 'rectangular',
                logo_alignment: 'left'
            }
        )
        
        console.log('✅ Google Sign-In кнопка инициализирована')
    } catch (error) {
        console.error('❌ Ошибка инициализации Google Sign-In:', error)
        createCustomGoogleButton(containerId, callback)
    }
}

export const createCustomGoogleButton = (containerId, callback) => {
  const container = document.getElementById(containerId)
  console.log('🔧 Создание резервной Google кнопки в контейнере:', containerId, container)
  
  if (!container) {
    console.error('❌ Контейнер для Google кнопки не найден:', containerId)
    return
  }
  
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
  
  console.log('✅ Резервная Google кнопка создана')
  
  window.handleCustomGoogleAuth = async function() {
        console.log('🔄 Клик на резервную Google кнопку')
        
        // Используем OAuth 2.0 поток с authorization code
        try {
            // Генерируем случайный state для безопасности
            const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
            sessionStorage.setItem('google_auth_state', state)
            
            // Создаем popup для Google OAuth
            const authUrl = new URL('https://accounts.google.com/oauth/authorize')
            authUrl.searchParams.set('client_id', '179244440593-9d5vb7jneb4ehqjto377tb6o6pvh3m56.apps.googleusercontent.com')
            authUrl.searchParams.set('redirect_uri', `${window.location.origin}/auth/google/callback`)
            authUrl.searchParams.set('response_type', 'code')
            authUrl.searchParams.set('scope', 'email profile')
            authUrl.searchParams.set('state', state)
            authUrl.searchParams.set('access_type', 'offline')
            authUrl.searchParams.set('prompt', 'consent')
            
            const popup = window.open(
                authUrl.toString(),
                'googleAuth',
                'width=500,height=600,scrollbars=yes,resizable=yes'
            );
            
            // Ожидаем закрытия popup
            const result = await new Promise((resolve, reject) => {
                const checkPopup = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(checkPopup);
                        reject(new Error('OAuth popup закрыт пользователем'));
                    }
                }, 1000);
                
                // Слушаем сообщения от popup
                const messageHandler = (event) => {
                    if (event.origin !== window.location.origin) return;
                    
                    if (event.data.type === 'google_auth_success') {
                        clearInterval(checkPopup);
                        popup.close();
                        window.removeEventListener('message', messageHandler);
                        resolve(event.data.userData);
                    } else if (event.data.type === 'google_auth_error') {
                        clearInterval(checkPopup);
                        popup.close();
                        window.removeEventListener('message', messageHandler);
                        reject(new Error(event.data.error));
                    }
                };
                
                window.addEventListener('message', messageHandler);
                
                // Таймаут на 5 минут
                setTimeout(() => {
                    clearInterval(checkPopup);
                    popup.close();
                    window.removeEventListener('message', messageHandler);
                    reject(new Error('OAuth таймаут'));
                }, 300000);
            });
            
            await callback(result);
        } catch (error) {
            console.error('❌ Ошибка Google OAuth:', error);
            showModal('Ошибка авторизации', 'Не удалось выполнить вход через Google. Попробуйте другой способ.', 'error');
        }
    }
}

export const handleGoogleAuth = async (response) => {
    try {
        // Если response это credential от Google Sign-In
        if (response.credential) {
            const payload = JSON.parse(atob(response.credential.split('.')[1]))
            const userData = { 
                username: payload.name, 
                email: payload.email, 
                picture: payload.picture,
                googleId: payload.sub 
            }
            await handleGoogleAuthSuccess(userData)
        } else {
            // Если response это userData от OAuth flow
            await handleGoogleAuthSuccess(response)
        }
    } catch (error) {
        console.error('❌ Ошибка обработки Google auth:', error)
        showModal('Ошибка авторизации', 'Не удалось обработать ответ от Google', 'error')
    }
}