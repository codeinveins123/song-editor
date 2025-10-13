import { currentUser } from './state.js'
import { showSuccessPage, showWelcomePage, showLoginForm } from './pages.js'

export const showSongsPage = () => {
    const content = document.getElementById('content')
    content.innerHTML = `
        <div class="user-section">
            <h2>🎵 Коллекция песен</h2>
            <div class="user-info-card">
                <h3>Скоро здесь появятся песни!</h3>
                <p>Мы работаем над добавлением текстов с аккордами.</p>
            </div>
            <div class="actions">
                <button id="back" class="btn btn-primary">Назад</button>
            </div>
        </div>
    `
    
    // Добавляем обработчик после рендера
    setTimeout(() => {
        document.getElementById('back').addEventListener('click', showSuccessPage)
    }, 0)
}

export const setupNavListeners = () => {
    document.getElementById('nav-home')?.addEventListener('click', function(e) {
        e.preventDefault()
        if (currentUser) {
            showSuccessPage()
        } else {
            showWelcomePage()
        }
    })
    
    document.getElementById('nav-songs')?.addEventListener('click', function(e) {
        e.preventDefault()
        if (currentUser) {
            showSongsPage()
        } else {
            showLoginForm()
        }
    })
    
    document.getElementById('nav-profile')?.addEventListener('click', function(e) {
        e.preventDefault()
        if (currentUser) {
            showSuccessPage()
        } else {
            showLoginForm()
        }
    })
}