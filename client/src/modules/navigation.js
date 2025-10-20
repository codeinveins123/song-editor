import { getCurrentUser } from './state.js'
import { showSuccessPage, showWelcomePage, showLoginForm } from './pages.js'
import { songsAPI } from './api.js'

export const showSongsPage = async () => {
    const content = document.getElementById('content')
    
    try {
        const response = await songsAPI.getAll()
        const songs = response.songs || []

        content.innerHTML = `
            <div class="user-section">
                <h2>🎵 Коллекция песен</h2>
                
                ${songs.length > 0 ? `
                    <div class="songs-list">
                        ${songs.map(song => `
                            <div class="song-card">
                                <h3>${song.title}</h3>
                                <p class="song-artist">Исполнитель: ${song.artist}</p>
                                ${song.author ? `<p class="song-author">Добавил: ${song.author}</p>` : ''}
                                <div class="song-chords">Аккорды: ${song.chords || 'не указаны'}</div>
                                <pre class="song-lyrics">${song.lyrics}</pre>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="user-info-card">
                        <h3>Пока нет песен</h3>
                        <p>Будьте первым, кто добавит песню!</p>
                    </div>
                `}
                
                <div class="actions">
                    <button id="add-song" class="btn btn-success">Добавить песню</button>
                    <button id="back" class="btn btn-primary">Назад</button>
                </div>
            </div>
        `
        
        document.getElementById('back').addEventListener('click', showSuccessPage)
        document.getElementById('add-song').addEventListener('click', showAddSongForm)
        
    } catch (error) {
        console.error('Ошибка загрузки песен:', error)
        content.innerHTML = `
            <div class="user-section">
                <h2>🎵 Коллекция песен</h2>
                <div class="user-info-card">
                    <h3>Ошибка загрузки</h3>
                    <p>Не удалось загрузить песни. Попробуйте позже.</p>
                </div>
                <div class="actions">
                    <button id="back" class="btn btn-primary">Назад</button>
                </div>
            </div>
        `
        document.getElementById('back').addEventListener('click', showSuccessPage)
    }
}

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
    document.getElementById('cancel-add-song').addEventListener('click', showSongsPage)
}

const handleAddSong = async (e) => {
    e.preventDefault()
    const title = document.getElementById('song-title').value.trim()
    const artist = document.getElementById('song-artist').value.trim()
    const chords = document.getElementById('song-chords').value.trim()
    const lyrics = document.getElementById('song-lyrics').value.trim()

    try {
        await songsAPI.create({ title, artist, chords, lyrics })
        alert('Песня успешно добавлена!')
        showSongsPage()
    } catch (error) {
        alert('Ошибка при добавлении песни: ' + error.message)
    }
}

export const setupNavListeners = () => {
    document.getElementById('nav-home')?.addEventListener('click', function(e) {
        e.preventDefault()
        if (getCurrentUser()) {
            showSuccessPage()
        } else {
            showWelcomePage()
        }
    })
    
    document.getElementById('nav-songs')?.addEventListener('click', function(e) {
        e.preventDefault()
        if (getCurrentUser()) {
            showSongsPage()
        } else {
            showLoginForm()
        }
    })
    
    document.getElementById('nav-profile')?.addEventListener('click', function(e) {
        e.preventDefault()
        if (getCurrentUser()) {
            showSuccessPage()
        } else {
            showLoginForm()
        }
    })
}