import { currentUser } from './state.js'
import { showSuccessPage, showWelcomePage, showLoginForm, showRegisterForm } from './pages.js'
import { showAddSongForm, showEditSongForm, removeUnsavedGuards, showPublicProfile } from './pages.js'
import { songsAPI } from './api.js'
import { showModal, showConfirmModal } from './modal.js'

// Добавляем стили для verified badges
const verifiedBadgeStyles = document.createElement('style');
verifiedBadgeStyles.textContent = `
  .verified-badge {
    display: inline-block;
    background-color: #28a745;
    color: white;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 12px;
    margin-left: 8px;
    font-weight: bold;
    cursor: help;
    position: relative;
    transition: background-color 0.2s ease;
  }
  
  .verified-badge:hover {
    background-color: #218838 !important;
  }
`;
document.head.appendChild(verifiedBadgeStyles);

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

export const showAuthorSongsPage = async (authorName) => {
    try { removeUnsavedGuards() } catch {}
    const content = document.getElementById('content')
    try {
        const response = await songsAPI.getAll()
        const songs = (response.songs || []).slice().sort((a,b)=>a.title.localeCompare(b.title,'ru'))
        
        // Debug: проверяем is_verified у песен
        console.log('Songs with verification status:', songs.map(s => ({title: s.title, is_verified: s.is_verified})));
        
        const groups = songs.reduce((acc, s)=>{
            const ch = (s.title||'').trim()[0]?.toUpperCase() || '#'
            const key = /[A-ZА-ЯЁ]/i.test(ch) ? ch : '#'
            ;(acc[key] ||= []).push(s)
            return acc
        }, {})
        const letters = Object.keys(groups).sort((a,b)=> a==='#'? -1 : b==='#'? 1 : a.localeCompare(b,'ru'))

        content.innerHTML = `
            <div class="songs-container">
                <div class="songs-header"><h2>Все песни</h2></div>
                ${letters.map(L => `
                  <section class="alpha-section">
                    <h3 class="alpha-title">${escapeHtml(L)}</h3>
                    <ul class="alpha-list">
                      ${groups[L].map(song => `
                        <li class="alpha-row">
                          <a href="#" class="song-link" data-id="${song.id}">${escapeHtml(song.title)}</a>
                          <span class="sep"> — </span>
                          <a href="#" class="artist-link" data-artist="${escapeHtml(song.artist)}">${escapeHtml(song.artist)}</a>
                          <span class="sep"> • </span>
                          <a href="#" class="author-link" data-author="${escapeHtml(song.author || 'Неизвестен')}">${escapeHtml(song.author || 'Неизвестен')}</a>
                          ${song.is_verified ? '<span class="verified-badge" title="Проверено администратором">✓</span>' : ''}
                        </li>`).join('')}
                    </ul>
                  </section>
                `).join('')}
                <div class="actions"><button id="back" class="btn btn-primary">Назад</button></div>
            </div>
        `
        document.getElementById('back').addEventListener('click', showSongsPage)
        document.querySelectorAll('.song-link').forEach(a => a.addEventListener('click', (e)=>{e.preventDefault(); showSongView(a.dataset.id)}))
        document.querySelectorAll('.artist-link').forEach(a => a.addEventListener('click', (e)=>{e.preventDefault(); showArtistPage(a.dataset.artist)}))
    } catch (e) {
        console.error(e)
    }
}

// Проверка, показывать ли кнопку удаления
function shouldShowDeleteButton(song) {
    const user = currentUser.value;
    if (!user || !song.created_by) return false;
    // Преобразуем в числа для надежного сравнения
    return parseInt(user.id) === parseInt(song.created_by);
}

export const showSongsPage = async () => {
    // ensure stale guards are removed when entering list page
    try { removeUnsavedGuards() } catch {}
    const content = document.getElementById('content')
    try {
        const response = await songsAPI.getAll()
        const songs = (response.songs || []).slice().sort((a,b)=>a.title.localeCompare(b.title,'ru'))
        
        // Debug: проверяем is_verified у песен
        console.log('Songs with verification status:', songs.map(s => ({title: s.title, is_verified: s.is_verified})));

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
                <div class="song-top-note">
                    <div class="note-grid">
                        <div class="note-text">
                            <h3>Играй любимые песни с аккордами</h3>
                            <p>Собрали удобный каталог: открывайте композиции, смотрите аккорды и ритм, учите куплеты и припевы по шагам.</p>
                            <ul class="note-points">
                                <li>Быстрый переход к исполнителю</li>
                                <li>Подбор по алфавиту</li>
                                <li>Чистое оформление и крупные аккорды</li>
                            </ul>
                        </div>
                        <div class="note-media">
                            <img src="https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=1200&auto=format&fit=crop" alt="Акустическая гитара и ноты" loading="lazy"/>
                        </div>
                    </div>
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
                          <span class="sep"> • </span>
                          <a href="#" class="author-link" data-author="${escapeHtml(song.author || 'Неизвестен')}">${escapeHtml(song.author || 'Неизвестен')}</a>
                          ${song.is_verified ? '<span class="verified-badge" title="Проверено администратором">✓</span>' : ''}
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
        document.querySelectorAll('.author-link').forEach(a => a.addEventListener('click', (e)=>{e.preventDefault(); showPublicProfile(a.dataset.author)}))
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
    try { removeUnsavedGuards() } catch {}
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
                <div class="song-top-note">
                    <div class="note-grid">
                        <div class="note-text">
                            <h3>Выберите любимого исполнителя</h3>
                            <p>Откройте подборку песен с аккордами и удобной навигацией. Начните разучивать прямо сейчас.</p>
                            <ul class="note-points">
                                <li>Все треки в одном месте</li>
                                <li>Указаны аккорды и ритм</li>
                                <li>Быстрый переход к песне</li>
                            </ul>
                        </div>
                        <div class="note-media">
                            <img src="https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=1200&auto=format&fit=crop" alt="Гитара на сцене" loading="lazy"/>
                        </div>
                    </div>
                </div>
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
    try { removeUnsavedGuards() } catch {}
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
                            ${song.is_verified ? '<span class="verified-badge" title="Проверено администратором">✓</span>' : ''}
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
                            ${shouldShowDeleteButton(song) ? `<button class="btn" id="edit-song" data-song-id="${song.id}">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                              Редактировать
                            </button>
                            <button class="btn btn-danger" id="delete-song" data-song-id="${song.id}">
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
        const editBtn = document.getElementById('edit-song');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.preventDefault();
                showEditSongForm(song.id);
            });
        }
        
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

// Update navigation based on user role
export function updateNavigation() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;
    
    // Clear existing navigation items except the first three (Home, Songs, Artists)
    const itemsToKeep = Array.from(navLinks.children).slice(0, 3);
    navLinks.innerHTML = '';
    itemsToKeep.forEach(item => navLinks.appendChild(item));
    
    // Add admin link if user is admin
    if (currentUser.value?.is_admin) {
      const adminLi = document.createElement('li');
      adminLi.innerHTML = '<a href="#" id="nav-admin">Админ-панель</a>';
      navLinks.appendChild(adminLi);
    }
    
    // Add profile/login link
    const profileLi = document.createElement('li');
    profileLi.innerHTML = currentUser.value 
      ? '<a href="#" id="nav-profile">Профиль</a>' 
      : '<a href="#" id="nav-login">Войти</a>';
    navLinks.appendChild(profileLi);
    
    // Add event listeners
    setupNavListeners();
}

export const setupNavListeners = () => {
    // Проверка на удаленный аккаунт
    const checkDeletedAccount = () => {
        if (currentUser.value?.is_deleted) {
            import('../main.js').then(main => {
                main.showDeletedAccountModal(currentUser.value);
            });
            return true; // Блокируем дальнейшую навигацию
        }
        return false; // Продолжаем навигацию
    };
    
    document.getElementById('nav-home')?.addEventListener('click', function(e) {
        e.preventDefault();
        if (checkDeletedAccount()) return;
        showWelcomePage();
    });
    
    document.getElementById('nav-songs')?.addEventListener('click', function(e) {
        e.preventDefault();
        if (checkDeletedAccount()) return;
        showSongsPage();
    });
    
    document.getElementById('nav-artists')?.addEventListener('click', function(e) {
        e.preventDefault();
        if (checkDeletedAccount()) return;
        showArtistsPage();
    });
    
    document.getElementById('nav-admin')?.addEventListener('click', function(e) {
        e.preventDefault();
        if (checkDeletedAccount()) return;
        import('./admin.js').then(module => {
            module.showAdminPanel();
        });
    });
    
    document.getElementById('nav-profile')?.addEventListener('click', function(e) {
        e.preventDefault();
        // Для профиля не блокируем доступ даже для удаленных аккаунтов
        // Пользователь должен иметь возможность восстановить аккаунт
        import('./pages.js').then(pages => {
            pages.showSuccessPage();
        });
    });

    document.getElementById('nav-login')?.addEventListener('click', function(e) {
        e.preventDefault();
        showRegisterForm();
    });
}