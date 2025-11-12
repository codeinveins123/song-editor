import { getCurrentUser } from './state.js'
import { showSuccessPage, showWelcomePage, showLoginForm } from './pages.js'
import { showAddSongForm } from './pages.js'
import { songsAPI } from './api.js'
import { showModal, showConfirmModal } from './modal.js'

// Утилита для экранирования HTML
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Проверка, показывать ли кнопку удаления
function shouldShowDeleteButton(song) {
    const currentUser = getCurrentUser();
    if (!currentUser || !song.created_by) return false;
    // Преобразуем в числа для надежного сравнения
    return parseInt(currentUser.id) === parseInt(song.created_by);
}

export const showSongsPage = async () => {
    const content = document.getElementById('content')
    try {
        const response = await songsAPI.getAll()
        const songs = (response.songs || []).slice().sort((a,b)=>a.title.localeCompare(b.title,'ru'))

        const groups = songs.reduce((acc, s) => {
            const ch = (s.title || '').trim()[0]?.toUpperCase() || '#'
            const key = /[A-ZА-ЯЁ]/i.test(ch) ? ch : '#'
            ;(acc[key] ||= []).push(s)
            return acc
        }, {})
        const letters = Object.keys(groups).sort((a,b)=> a==='#'? -1 : b==='#'? 1 : a.localeCompare(b,'ru'))

        content.innerHTML = `
            <div class="songs-container">
                <div class="songs-header">
                    <h2>Песни</h2>
                </div>
                ${letters.map(L => `
                  <section class="alpha-section">
                    <h3 class="alpha-title">${escapeHtml(L)}</h3>
                    <ul class="alpha-list">
                      ${groups[L].map(song => `
                        <li class="alpha-row">
                          <a href="#" class="song-link" data-id="${song.id}">${escapeHtml(song.title)}</a>
                          <span class="sep"> — </span>
                          <a href="#" class="artist-link" data-artist="${escapeHtml(song.artist)}">${escapeHtml(song.artist)}</a>
                        </li>
                      `).join('')}
                    </ul>
                  </section>
                `).join('')}
                <div class="actions">
                    <button id="back" class="btn btn-primary">Назад</button>
                </div>
            </div>
        `

        document.getElementById('back').addEventListener('click', showWelcomePage)
        document.querySelectorAll('.song-link').forEach(a => a.addEventListener('click', (e)=>{e.preventDefault(); showSongView(a.dataset.id)}))
        document.querySelectorAll('.artist-link').forEach(a => a.addEventListener('click', (e)=>{e.preventDefault(); showArtistPage(a.dataset.artist)}))
    } catch (error) {
        console.error('Ошибка загрузки песен:', error)
        content.innerHTML = `
            <div class="songs-container">
                <h2>Песни</h2>
                <div class="user-info-card"><h3>Ошибка загрузки</h3><p>Не удалось загрузить песни</p></div>
                <div class="actions"><button id="back" class="btn btn-primary">Назад</button></div>
            </div>`
        document.getElementById('back').addEventListener('click', showWelcomePage)
    }
}

export const showArtistsPage = async () => {
    const content = document.getElementById('content')
    try {
        const response = await songsAPI.getAll()
        const songs = response.songs || []
        const artists = Array.from(new Set(songs.map(s => (s.artist||'').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'ru'))
        const groups = artists.reduce((acc, name)=>{
            const ch = name[0]?.toUpperCase() || '#'
            const key = /[A-ZА-ЯЁ]/i.test(ch) ? ch : '#'
            ;(acc[key] ||= []).push(name)
            return acc
        }, {})
        const letters = Object.keys(groups).sort((a,b)=> a==='#'? -1 : b==='#'? 1 : a.localeCompare(b,'ru'))

        content.innerHTML = `
            <div class="songs-container">
                <div class="songs-header"><h2>Исполнители</h2></div>
                ${letters.map(L => `
                  <section class="alpha-section">
                    <h3 class="alpha-title">${escapeHtml(L)}</h3>
                    <ul class="alpha-list">
                      ${groups[L].map(name => `
                        <li class="alpha-row">
                          <a href="#" class="artist-link" data-artist="${escapeHtml(name)}">${escapeHtml(name)}</a>
                        </li>`).join('')}
                    </ul>
                  </section>
                `).join('')}
                <div class="actions"><button id="back" class="btn btn-primary">Назад</button></div>
            </div>
        `
        document.getElementById('back').addEventListener('click', showWelcomePage)
        document.querySelectorAll('.artist-link').forEach(a => a.addEventListener('click', (e)=>{e.preventDefault(); showArtistPage(a.dataset.artist)}))
    } catch (e) {
        console.error(e)
    }
}

export const showArtistPage = async (artistName) => {
    const content = document.getElementById('content')
    try {
        const response = await songsAPI.getAll()
        const songs = (response.songs || []).filter(s => (s.artist||'') === artistName).sort((a,b)=>a.title.localeCompare(b.title,'ru'))
        const groups = songs.reduce((acc, s)=>{
            const ch = (s.title||'').trim()[0]?.toUpperCase() || '#'
            const key = /[A-ZА-ЯЁ]/i.test(ch) ? ch : '#'
            ;(acc[key] ||= []).push(s)
            return acc
        }, {})
        const letters = Object.keys(groups).sort((a,b)=> a==='#'? -1 : b==='#'? 1 : a.localeCompare(b,'ru'))

        content.innerHTML = `
            <div class="songs-container">
                <div class="songs-header"><h2>${escapeHtml(artistName)}</h2></div>
                ${letters.map(L => `
                  <section class="alpha-section">
                    <h3 class="alpha-title">${escapeHtml(L)}</h3>
                    <ul class="alpha-list">
                      ${groups[L].map(song => `
                        <li class="alpha-row">
                          <a href="#" class="song-link" data-id="${song.id}">${escapeHtml(song.title)}</a>
                        </li>`).join('')}
                    </ul>
                  </section>
                `).join('')}
                <div class="actions"><button id="back" class="btn btn-primary">Назад</button></div>
            </div>
        `
        document.getElementById('back').addEventListener('click', showWelcomePage)
        document.querySelectorAll('.song-link').forEach(a => a.addEventListener('click', (e)=>{e.preventDefault(); showSongView(a.dataset.id)}))
    } catch (e) {
        console.error(e)
    }
}


// Просмотр одной песни (как блог)
export const showSongView = async (songId) => {
    const content = document.getElementById('content')
    
    try {
        const response = await songsAPI.getById(songId)
        const song = response.song
        
        content.innerHTML = `
            <div class="song-blog-container">
                <button id="back-from-song" class="btn-back">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  Назад к песням
                </button>
                
                <article class="song-blog-post">
                    <header class="song-blog-header">
                        <div class="song-blog-meta">
                            ${song.genre ? `<span class="song-genre-badge">${escapeHtml(song.genre)}</span>` : ''}
                            ${song.rhythm ? `<span class="song-rhythm-badge">${escapeHtml(song.rhythm)}</span>` : ''}
                            <time>${new Date(song.created_at).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
                        </div>
                        <h1 class="song-blog-title">${escapeHtml(song.title)}</h1>
                        <p class="song-blog-artist">Исполнитель: ${escapeHtml(song.artist)}</p>
                        ${song.author ? `<p class="song-blog-author">Автор: ${escapeHtml(song.author)}</p>` : ''}
                    </header>
                    
                    ${song.description ? `<div class="song-blog-description">
                        <p>${escapeHtml(song.description)}</p>
                    </div>` : ''}
                    
                    <div class="song-blog-content">
                        ${song.content || song.lyrics || ''}
                    </div>
                    
                    ${song.chords ? `<div class="song-blog-chords">
                        <h3>Используемые аккорды</h3>
                        <div class="chords-tags">
                            ${song.chords.split(' ').map(chord => `<span class="chord-tag">${escapeHtml(chord)}</span>`).join('')}
                        </div>
                    </div>` : ''}
                    
                    <footer class="song-blog-footer">
                        <div class="song-blog-actions">
                            <button class="btn btn-secondary" id="share-song">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                              Поделиться
                            </button>
                            ${shouldShowDeleteButton(song) ? `<button class="btn btn-danger" id="delete-song" data-song-id="${song.id}">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg>
                              Удалить
                            </button>` : ''}
                        </div>
                    </footer>
                </article>
            </div>
        `
        
        document.getElementById('back-from-song').addEventListener('click', showSongsPage)
        document.getElementById('share-song').addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(window.location.href)
                showModal('Успех', 'Ссылка на песню скопирована в буфер обмена!', 'success')
            } catch (error) {
                showModal('Ошибка', 'Не удалось скопировать ссылку', 'error')
            }
        })
        
        // Кнопка удаления песни
        const deleteBtn = document.getElementById('delete-song');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                const songId = deleteBtn.getAttribute('data-song-id');
                const confirmed = await showConfirmModal('Удаление песни', 'Вы уверены, что хотите удалить эту песню? Это действие нельзя отменить.');
                if (confirmed) {
                    try {
                        await songsAPI.delete(songId);
                        showModal('Успех', 'Песня удалена', 'success');
                        showSongsPage();
                    } catch (error) {
                        showModal('Ошибка', 'Не удалось удалить песню: ' + error.message, 'error');
                    }
                }
            });
        }
        
    } catch (error) {
        console.error('Ошибка загрузки песни:', error)
        showModal('Ошибка', 'Не удалось загрузить песню: ' + error.message, 'error')
        showSongsPage()
    }
}

export const setupNavListeners = () => {
    document.getElementById('nav-home')?.addEventListener('click', function(e) {
        e.preventDefault()
        showWelcomePage()
    })
    
    document.getElementById('nav-songs')?.addEventListener('click', function(e) {
        e.preventDefault()
        showSongsPage()
    })
    document.getElementById('nav-artists')?.addEventListener('click', function(e) {
        e.preventDefault()
        showArtistsPage()
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