import { currentUser, getToken } from './state.js'
import { logout } from './auth.js'
import { showSongsPage } from './navigation.js'
import { initializeGoogleAuth, handleGoogleAuth } from './googleAuth.js'
import { setupAuthForms } from './auth.js'
import { changePassword, updateProfile, updateAvatar, getStats, songsAPI, mediaAPI } from './api.js';
import { showModal, showConfirmModal, showPromptModal, showCurrentPasswordPrompt, showNewPasswordPrompt, showConfirmPasswordPrompt } from './modal.js';

// ==========================
// Несохраненные изменения: утилиты
// ==========================
export function setUnsavedChanges(hasChanges) {
  window.__hasUnsavedChanges = !!hasChanges;
}

export function removeUnsavedGuards() {
  window.removeEventListener('beforeunload', window.__beforeUnloadHandler || (()=>{}));
  window.__beforeUnloadHandler = null;
  setUnsavedChanges(false);
  if (window.__unsavedClickHandler) {
    document.removeEventListener('click', window.__unsavedClickHandler, true);
    window.__unsavedClickHandler = null;
  }
  window.__unsavedGuardActive = false;
  window.__unsavedPromptOpen = false;
  window.__skipUnsavedGuardOnce = false;
}

export function installUnsavedGuards(formEl) {
  if (!formEl) return;
  if (window.__unsavedGuardActive) return;
  // Respect temporary suppression window after we уже подтвердили уход
  const suppressUntil = window.__unsavedSuppressUntil || 0;
  if (Date.now() < suppressUntil) return;

  window.__unsavedGuardActive = true;
  setUnsavedChanges(false);

  const markDirty = () => setUnsavedChanges(true);
  formEl.addEventListener('input', markDirty, { capture: true });
  formEl.addEventListener('change', markDirty, { capture: true });
  const editor = document.getElementById('song-editor');
  if (editor) editor.addEventListener('input', markDirty, { capture: true });

  // ЕДИНЫЙ перехват внутренних переходов (без beforeunload, чтобы не было второго системного окна)
  const clickableSelector = 'a, button, [data-nav], #nav-home, #nav-songs, #nav-artists, #nav-profile, .song-link, .artist-link, #back, #back-from-song';
  const clickInterceptor = async (ev) => {
    if (!window.__hasUnsavedChanges) return;
    if (window.__unsavedPromptOpen) return;
    if (window.__skipUnsavedGuardOnce) { window.__skipUnsavedGuardOnce = false; return; }
    // Только ЛКМ без модификаторов
    if (ev.button !== 0 || ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    const target = ev.target.closest(clickableSelector);
    if (!target || formEl.contains(target)) return;
    // Не перехватываем клики внутри открытых модалок
    const openModal = document.querySelector('.modal-overlay');
    if (openModal && getComputedStyle(openModal).display !== 'none' && ev.target.closest('.modal-overlay')) return;
    // Опциональный выход из режима гварда
    if (target.closest('[data-unsaved-ignore="true"]')) return;

    ev.preventDefault();
    ev.stopPropagation();

    // Показать ЕДИНОЕ модальное окно
    window.__unsavedPromptOpen = true;
    const ok = await showConfirmModal('Несохраненные изменения', 'Выйти без сохранения изменений?');
    window.__unsavedPromptOpen = false;
    if (ok) {
      // Подтвердили уход: отключаем гварды и подавляем повторное появление на следующей странице
      removeUnsavedGuards();
      window.__skipUnsavedGuardOnce = true;
      window.__unsavedSuppressUntil = Date.now() + 2000; // 2s защиты от переинициализации на следующей странице
      // Инициируем исходный клик
      target.click();
    }
  };
  window.__unsavedClickHandler = clickInterceptor;
  document.addEventListener('click', clickInterceptor, true);
}

export function withUnsavedGuard(handler) {
  return async function(e) {
    if (window.__hasUnsavedChanges) {
      e?.preventDefault?.();
      const ok = await showConfirmModal('Несохраненные изменения', 'Вы уверены, что хотите покинуть страницу? Внесенные изменения будут потеряны.');
      if (!ok) return;
      removeUnsavedGuards();
    }
    return handler.apply(this, arguments);
  }
}

// Главная страница
export const showWelcomePage = () => {
    const content = document.getElementById('content')
    const isLoggedIn = !!window.localStorage.getItem('currentUser')
    content.innerHTML = `
        <section class="hero-card">
            <div class="hero-overlay hero-overlay-color"></div>
            <div class="hero-content">
                <h1 class="hero-title">Аккорды для гитары</h1>
                <p class="hero-subtitle">Ваш любимый сайт для обучения игре на гитаре</p>
                <div class="hero-actions" style="margin-top:14px; display:inline-flex; gap:10px;">
                  <button id="explore-songs" class="btn btn-ghost-light">Песни</button>
                  <button id="explore-artists" class="btn btn-ghost-light">Исполнители</button>
                </div>
            </div>
        </section>
        <section class="strings-widget" id="strings-widget">
            <div class="strings-neck" id="strings-neck">
              ${['E1','A1','D2','G2','B2','E3'].map((n,i)=>`<div class=\"string\" data-note=\"${n}\" data-index=\"${i}\"></div>`).join('')}
              <div class="strings-ui">
                <button id="strings-toggle" class="btn btn-icon btn-note" aria-label="Включить нотный режим" title="Включить нотный режим" aria-pressed="false">
                  <span class="btn-note-icon" aria-hidden="true" style="font-size:14px; line-height:1;">♪</span>
                </button>
                <div class="ui-sep"></div>
                <label class="vol-label" for="strings-volume">Громкость</label>
                <input type="range" id="strings-volume" min="0" max="100" value="85" />
              </div>
            </div>
            <div class="strings-footer">
              <span class="strings-hint" id="strings-hint">Нотный режим выключен. Нажмите нотку, чтобы включить.</span>
            </div>
        </section>
        <section class="hero-text">
          <div class="hero-text-inner" style="max-width: 1200px; margin: 10px auto 0; padding: 0 20px;">
            ${isLoggedIn ? `
              <div class="hero-cta-note">
                <p>Хотите добавить аранжировку любимой песни у любимого исполнителя?</p>
                <button id=\"cta-add\" class=\"btn btn-primary\">Добавить аранжировку</button>
              </div>
            ` : `
              <div class="hero-cta-note">
                <p>Хотите добавить свою песню или аранжировку? Войдите в аккаунт или зарегистрируйтесь.</p>
                <div class="hero-auth-actions" style="display:flex; gap:10px;">
                  <button id=\"login-btn\" class=\"btn btn-surface\">Войти</button>
                  <button id=\"register-btn\" class=\"btn btn-surface\">Зарегистрироваться</button>
                </div>
              </div>
            `}
          </div>
        </section>
    `
    
    const songsBtn = document.getElementById('explore-songs')
    const artistsBtn = document.getElementById('explore-artists')
    const addBtn = document.getElementById('cta-add')
    const loginBtn = document.getElementById('login-btn')
    const registerBtn = document.getElementById('register-btn')
    if (songsBtn) songsBtn.addEventListener('click', () => showSongsPage())
    if (artistsBtn) artistsBtn.addEventListener('click', async () => {
        const { showArtistsPage } = await import('./navigation.js')
        showArtistsPage()
    })
    if (addBtn) addBtn.addEventListener('click', showAddSongForm)
    if (loginBtn) loginBtn.addEventListener('click', showLoginForm)
    if (registerBtn) registerBtn.addEventListener('click', showRegisterForm)
    
    setTimeout(() => { setupGuitarStrings() }, 0)
}

// Интерактивный гитарный гриф (открытые струны E‑стандарта)
function setupGuitarStrings() {
    const container = document.getElementById('strings-widget')
    if (!container) return
    let audioCtx, masterGain
    let hasUserGesture = false
    const volEl = document.getElementById('strings-volume')
    const toggleBtn = document.getElementById('strings-toggle')
    const hintEl = document.getElementById('strings-hint')
    let widgetEnabled = true
    const ensureAudio = () => {
        if (!audioCtx) {
            if (!hasUserGesture) return null
            audioCtx = new (window.AudioContext || window.webkitAudioContext)()
            masterGain = audioCtx.createGain()
            const initVol = volEl ? parseInt(volEl.value,10)/100 : 0.85
            masterGain.gain.value = initVol
            masterGain.connect(audioCtx.destination)
        }
        return audioCtx
    }
    // Unlock/resume audio on first real user gesture (required by autoplay policies)
    const unlockAudio = () => {
        try {
            hasUserGesture = true
            let ctx = ensureAudio()
            if (ctx && ctx.state === 'suspended') ctx.resume()
            // After first unlock, attempt to load samples (if not yet loaded)
            if (!sampleBuffers) {
                loadSamples()
            }
        } catch {}
    }
    ;['pointerdown','touchstart','keydown','click','mousemove','pointermove'].forEach(ev => {
        document.addEventListener(ev, function onFirst() {
            unlockAudio()
            document.removeEventListener(ev, onFirst, true)
        }, { capture: true, once: true, passive: true })
    })
    const baseFreqs = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63]
    const sampleFiles = ['E1.m4a','A1.m4a','D2.m4a','G2.m4a','B2.m4a','E3.m4a']
    let sampleBuffers = null
    const loadSamples = async () => {
        try {
            const ctx = ensureAudio()
            if (!ctx) return // wait until user gesture unlocks audio
            const buffers = await Promise.all(sampleFiles.map(async (name) => {
                const res = await fetch(`/src/assets/audio/${name}`)
                if (!res.ok) throw new Error('missing ' + name)
                const arr = await res.arrayBuffer()
                return await ctx.decodeAudioData(arr)
            }))
            sampleBuffers = buffers
        } catch (e) {
            sampleBuffers = null
        }
    }
    // Do not pre-create AudioContext / decode before gesture; samples will load after unlockAudio()
    const strings = Array.from(container.querySelectorAll('.string'))
    // helper to paint slider track: colored filled part, white unfilled
    const paintVolumeTrack = () => {
        if (!volEl) return
        const min = parseInt(volEl.min || '0', 10)
        const max = parseInt(volEl.max || '100', 10)
        const val = parseInt(volEl.value || String(min), 10)
        const pct = Math.max(0, Math.min(100, Math.round(((val - min) / (max - min)) * 100)))
        // Always paint filled-left gradient, even when disabled
        volEl.style.background = `linear-gradient(90deg, #374151 0% ${pct}%, #e5e7eb ${pct}% 100%)`
    }
    if (volEl) {
        paintVolumeTrack()
        volEl.addEventListener('input', () => {
            const ctx = ensureAudio()
            const v = parseInt(volEl.value,10)/100
            if (masterGain) masterGain.gain.value = v
            paintVolumeTrack()
        })
    }
    const pluckOsc = (el, idx) => {
        const ctx = ensureAudio()
        if (!ctx) return
        const now = ctx.currentTime
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.value = (baseFreqs[idx] || 220)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.6, now + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.05)
        osc.connect(gain).connect(masterGain)
        osc.start(now)
        osc.stop(now + 1.06)
        startVibration(el, 1.06)
    }
    const pluckSample = (el, idx) => {
        if (!sampleBuffers || !sampleBuffers[idx]) { pluckOsc(el, idx); return }
        const ctx = ensureAudio()
        if (!ctx) return
        const src = ctx.createBufferSource()
        const gain = ctx.createGain()
        src.buffer = sampleBuffers[idx]
        src.playbackRate.value = 1
        const low = ctx.createBiquadFilter(); low.type='lowpass'; low.frequency.value=8000
        const now = ctx.currentTime
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(0.85, now + 0.012)
        const dur = (src.buffer.duration || 1.1)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.18, dur - 0.05))
        src.connect(gain).connect(low).connect(masterGain)
        src.start()
        startVibration(el, dur)
    }
    const startVibration = (el, durationSec) => {
        if (el.__vibe) cancelAnimationFrame(el.__vibe)
        el.classList.add('is-active','vibrate')
        const start = performance.now()
        const maxAmp = 6, minAmp = 0.4
        const step = (t) => {
            const elapsed = (t - start)/1000
            const k = Math.min(1, Math.max(0, elapsed/durationSec))
            const amp = minAmp + (maxAmp - minAmp) * Math.exp(-3 * k)
            el.style.setProperty('--amp', amp + 'px')
            if (elapsed < durationSec) {
                el.__vibe = requestAnimationFrame(step)
            } else {
                el.classList.remove('vibrate','is-active')
                el.style.removeProperty('--amp')
                el.__vibe = null
            }
        }
        el.__vibe = requestAnimationFrame(step)
    }
    strings.forEach((el, i) => {
        const handle = () => { if (widgetEnabled) pluckSample(el, i) }
        el.addEventListener('mouseenter', () => handle())
        el.addEventListener('pointerdown', (e) => { unlockAudio(); e.preventDefault(); handle() })
    })
    let lastIdx = -1, lastTs = 0
    const neck = container.querySelector('.strings-neck') || container
    neck.addEventListener('pointermove', (e) => {
        if (!widgetEnabled) return
        const rect = neck.getBoundingClientRect()
        const relY = (e.clientY - rect.top) / rect.height
        const idx = Math.max(0, Math.min(strings.length - 1, Math.floor(relY * strings.length)))
        const nowTs = performance.now()
        if (idx !== lastIdx && nowTs - lastTs > 28) {
            const target = strings[idx]
            if (target) pluckSample(target, idx)
            lastIdx = idx; lastTs = nowTs
        }
    })
    neck.addEventListener('pointerdown', (e) => {
        unlockAudio()
        if (!widgetEnabled) return
        const rect = neck.getBoundingClientRect()
        const relY = (e.clientY - rect.top) / rect.height
        const idx = Math.max(0, Math.min(strings.length - 1, Math.floor(relY * strings.length)))
        const target = strings[idx]
        if (target) pluckSample(target, idx)
    })
    neck.addEventListener('pointerup', () => { lastIdx = -1 })

    // Initialize visual state as ENABLED on load
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-pressed', 'true')
        toggleBtn.title = 'Выключить нотный режим'
    }
    if (hintEl) {
        hintEl.textContent = 'Проведите по струнам'
    }
    if (volEl) volEl.disabled = false
    const neckElInit = container.querySelector('.strings-neck')
    neckElInit?.classList.remove('disabled')
    paintVolumeTrack()

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            // Ensure audio context is resumed on explicit user interaction
            unlockAudio()
            widgetEnabled = !widgetEnabled
            toggleBtn.setAttribute('aria-pressed', widgetEnabled ? 'true' : 'false')
            toggleBtn.title = widgetEnabled ? 'Выключить нотный режим' : 'Включить нотный режим'
            if (hintEl) {
                hintEl.textContent = widgetEnabled
                  ? 'Проведите по струнам'
                  : 'Нотный режим выключен. Нажмите нотку, чтобы включить.'
            }
            if (volEl) volEl.disabled = !widgetEnabled
            const neckEl = container.querySelector('.strings-neck')
            neckEl?.classList.toggle('disabled', !widgetEnabled)
            paintVolumeTrack()
        })
    }
}

// Регистрация
export const showRegisterForm = () => {
    // Очищаем временные данные при переключении на форму регистрации
    delete window.tempRegistrationPassword
    
    const content = document.getElementById('content')
    content.innerHTML = `
        <div class="form-container">
            <h2>Регистрация</h2>
            <form id="register-form" class="auth-form">
                <div class="form-group">
                    <label for="username">Имя пользователя:</label>
                    <input type="text" id="username" required minlength="2" placeholder="Не менее 2 символов">
                </div>
                <div class="form-group">
                    <label for="email">Email:</label>
                    <input type="email" id="email" required placeholder="your@email.com">
                </div>
                <div class="form-group">
                    <label for="password">Пароль:</label>
                    <input type="password" id="password" required minlength="6" placeholder="Не менее 6 символов">
                </div>
                <button type="submit" class="btn btn-primary btn-full">Зарегистрироваться</button>
            </form>
            
            <div class="divider"></div>
            <div class="google-auth"><div id="google-button"></div></div>
            
            <p class="auth-switch">
                Уже есть аккаунт? 
                <a href="#" id="show-login">Войти</a>
            </p>
        </div>
    `
    
    setTimeout(() => {
        setupAuthForms()
        initializeGoogleAuth('google-button', handleGoogleAuth)
    }, 0)
}

// Подтверждение кода
export const showVerificationForm = (email, tempUser) => {
    const content = document.getElementById('content')
    content.innerHTML = `
        <div class="form-container">
            <h2>Подтверждение Email</h2>
            <p style="text-align:center;">Мы отправили код на <b>${escapeHtml(email)}</b></p>
            <form id="verify-form" class="auth-form">
                <input type="hidden" id="verify-email" value="${escapeHtml(email)}">
                <input type="hidden" id="verify-user-data" value='${escapeHtml(JSON.stringify(tempUser))}'>
                <div class="form-group">
                    <label for="code">Введите код:</label>
                    <input type="text" id="code" placeholder="6 цифр" maxlength="6" required />
                </div>
                <button type="submit" class="btn btn-primary btn-full">Подтвердить</button>
                <button type="button" class="btn btn-secondary btn-full" id="cancel-verification">Отмена</button>
            </form>
        </div>
    `
    
    setTimeout(() => {
        setupAuthForms()
        
        // Добавляем обработчик для кнопки отмены
        const cancelBtn = document.getElementById('cancel-verification')
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                delete window.tempRegistrationPassword
                showRegisterForm()
            })
        }
    }, 0)
}

// Вход
export const showLoginForm = () => {
    // Очищаем временные данные при переключении на форму входа
    delete window.tempRegistrationPassword
    
    const content = document.getElementById('content')
    content.innerHTML = `
        <div class="form-container">
            <h2>Вход в аккаунт</h2>
            <form id="login-form" class="auth-form">
                <div class="form-group">
                    <label for="login-email">Email:</label>
                    <input type="email" id="login-email" required placeholder="your@email.com">
                </div>
                <div class="form-group">
                    <label for="login-password">Пароль:</label>
                    <input type="password" id="login-password" required placeholder="Введите ваш пароль">
                </div>
                <button type="submit" class="btn btn-primary btn-full">Войти</button>
            </form>
            
            <div class="divider"></div>
            <div class="google-auth"><div id="google-button-login"></div></div>
            
            <p class="auth-switch">
                Нет аккаунта? <a href="#" id="show-register">Зарегистрироваться</a>
            </p>
        </div>
    `
    
    setTimeout(() => {
        setupAuthForms()
        initializeGoogleAuth('google-button-login', handleGoogleAuth)
    }, 0)
}

// Профиль пользователя
export const showSuccessPage = () => {
    const content = document.getElementById('content')
    content.innerHTML = `
        <div class="profile-section">
            <div class="profile-header">
                <div class="avatar-section">
                    <div class="avatar-container">
                        <img src="${escapeHtml(currentUser.picture_url || '/src/images/default-avatar.jpg')}" 
                             alt="Аватар" class="user-avatar" id="user-avatar">
                        <button class="avatar-upload-btn" id="change-avatar" aria-label="Изменить фото" title="Изменить фото">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z"></path>
                            <circle cx="12" cy="13" r="4"></circle>
                          </svg>
                        </button>
                    </div>
                    <input type="file" id="avatar-input" accept="image/jpeg, image/jpg, image/png" style="display: none;">
                </div>
                
                <div class="profile-info">
                    <h1>${escapeHtml(currentUser.username)}</h1>
                    <p class="user-email">Email: ${escapeHtml(currentUser.email)}</p>
                    <p class="user-provider">
                        ${currentUser.provider === 'google' ? 'Вход через Google' : 'Вход через Email'}
                    </p>
                    <p class="member-since">Участник с ${currentUser.created_at ? new Date(currentUser.created_at).toLocaleDateString('ru-RU') : 'неизвестная дата'}</p>
                </div>
            </div>

            <div class="profile-content">
                <div class="profile-card">
                    <h3>О себе</h3>
                    <div class="bio-section">
                        <textarea id="user-bio" class="bio-textarea" 
                                  placeholder="Расскажите о себе, ваших музыкальных предпочтениях или опыте игры...">${escapeHtml(currentUser.bio || '')}</textarea>
                        <button id="save-bio" class="btn btn-success">Сохранить</button>
                    </div>
                </div>

                <div class="profile-card">
                    <h3>Настройки аккаунта</h3>
                    <div class="settings-grid">
                        <div class="setting-item">
                            <label>Имя пользователя:</label>
                            <div class="setting-value">
                                <span>${escapeHtml(currentUser.username)}</span>
                                <button class="btn-small ${currentUser.provider === 'google' ? 'btn-disabled' : ''}" 
                                        id="change-username"
                                        ${currentUser.provider === 'google' ? 'title="Для Google аккаунтов имя пользователя нельзя изменить"' : ''}>
                                    Изменить
                                </button>
                            </div>
                        </div>
                        
                        <div class="setting-item">
                            <label>Смена пароля:</label>
                            <div class="setting-value">
                                <span>••••••</span>
                                <button class="btn-small ${currentUser.provider === 'google' ? 'btn-disabled' : ''}" 
                                        id="change-password"
                                        ${currentUser.provider === 'google' ? 'title="Для Google аккаунтов пароль меняется через Google аккаунт"' : ''}>
                                    Изменить
                                </button>
                            </div>
                        </div>
                        
                        
                    </div>
                </div>

                <div class="profile-card stats-card">
                    <h3>Статистика</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-number" id="songs-count">0</div>
                            <div class="stat-label">Добавлено песен</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number" id="rating-count">0</div>
                            <div class="stat-label">Рейтинг</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-number" id="activity-days">1</div>
                            <div class="stat-label">Дней с нами</div>
                        </div>
                    </div>
                </div>

                <div class="profile-card">
                    <div class="actions-section">
                        <button id="view-songs" class="btn btn-secondary" aria-label="Мои песни">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px">
                            <path d="M9 18V5l12-2v13"></path>
                            <circle cx="6" cy="18" r="3"></circle>
                            <circle cx="18" cy="16" r="3"></circle>
                          </svg>
                          Мои песни
                        </button>
                        <button id="add-song" class="btn btn-secondary" aria-label="Добавить песню">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                          Добавить песню
                        </button>
                        <button id="logout" class="btn btn-secondary" aria-label="Выйти">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                          </svg>
                          Выйти
                        </button>
                    </div>
                </div>
                
                <div class="profile-card">
                    <h3>${currentUser.value.is_deleted ? 'Восстановить аккаунт' : 'Удалить аккаунт'}</h3>
                    <div class="danger-content">
                        ${currentUser.value.is_deleted ? 
                            `<p class="danger-warning">Ваш аккаунт будет удален ${currentUser.value.deleted_at ? new Date(currentUser.value.deleted_at).toLocaleDateString('ru-RU') : 'неизвестная дата'}. Вы можете восстановить его в любой момент.</p>` :
                            `<p class="danger-warning">Удаление аккаунта приведет к безвозвратному удалению всех ваших данных через 14 дней.</p>`
                        }
                        <div id="delete-status" style="display: none;" class="delete-status">
                            <!-- Статус удаления будет добавлен динамически -->
                        </div>
                        <button id="${currentUser.value.is_deleted ? 'restore-account-profile' : 'delete-account'}" class="btn ${currentUser.value.is_deleted ? 'btn-success' : 'btn-danger'}">
                          ${currentUser.value.is_deleted ? 
                            `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px">
                              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>
                            </svg>
                            Восстановить аккаунт` :
                            `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            Удалить аккаунт`
                          }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `
    
    setTimeout(() => {
        setupProfileListeners()
        loadUserStats()
    }, 0)
}

// Настройка обработчиков профиля
function setupProfileListeners() {
    console.log('🔧 Настройка обработчиков профиля...');
    
    const logoutBtn = document.getElementById('logout');
    console.log('🔍 Кнопка выхода:', logoutBtn);
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
        console.log('✅ Обработчик выхода добавлен');
    } else {
        console.error('❌ Кнопка выхода не найдена');
    }
    
    const viewSongsBtn = document.getElementById('view-songs');
    if (viewSongsBtn) viewSongsBtn.addEventListener('click', async () => {
        try {
            const { showAuthorSongsPage } = await import('./navigation.js')
            showAuthorSongsPage(currentUser.username)
        } catch {
            // fallback: общий список
            const { showSongsPage } = await import('./navigation.js')
            showSongsPage()
        }
    })
    const addSongBtn = document.getElementById('add-song');
    if (addSongBtn) addSongBtn.addEventListener('click', showAddSongForm)
    
    const changeAvatarBtn = document.getElementById('change-avatar');
    if (changeAvatarBtn) changeAvatarBtn.addEventListener('click', () => {
        const input = document.getElementById('avatar-input');
        input && input.click()
    })
    
    const avatarInput = document.getElementById('avatar-input');
    if (avatarInput) avatarInput.addEventListener('change', handleAvatarUpload)
    const saveBioBtn = document.getElementById('save-bio');
    if (saveBioBtn) saveBioBtn.addEventListener('click', saveBio)
    
    const changeUsernameBtn = document.getElementById('change-username');
    if (changeUsernameBtn) changeUsernameBtn.addEventListener('click', (e) => {
        if (currentUser.provider === 'google') {
            e.preventDefault();
            showModal('Информация', 'Для Google аккаунтов имя пользователя нельзя изменить', 'info');
            return;
        }
        changeUsername();
    })
    
    const changePasswordBtn = document.getElementById('change-password');
    if (changePasswordBtn) changePasswordBtn.addEventListener('click', (e) => {
        if (currentUser.provider === 'google') {
            e.preventDefault();
            showModal('Информация', 'Для Google аккаунтов пароль меняется через настройки Google аккаунта', 'info');
            return;
        }
        changePasswordProfile();
    })
    
    const deleteAccountBtn = document.getElementById('delete-account');
    if (deleteAccountBtn) deleteAccountBtn.addEventListener('click', handleDeleteAccount)
    
    const restoreAccountBtn = document.getElementById('restore-account-profile');
    if (restoreAccountBtn) {
        restoreAccountBtn.addEventListener('click', async () => {
            console.log('🔄 Клик на "Восстановить аккаунт" в профиле');
            // Показываем модальное окно восстановления
            import('../main.js').then(main => {
                main.showDeletedAccountModal(currentUser.value);
            });
        });
    }
    
    // notifications removed
}

async function handleLogout() {
    console.log('🔄 Попытка выхода из аккаунта...');
    
    const confirmed = await showConfirmModal('Подтверждение выхода', 'Вы уверены, что хотите выйти из аккаунта?');
    if (confirmed) {
        console.log('🚪 Выполняем выход...');
        await logout();
    } else {
        console.log('❌ Выход отменен пользователем');
    }
}

async function loadUserStats() {
    try {
        const stats = await getStats();
        const apply = (s) => {
            if (!s) return;
            const songs = document.getElementById('songs-count');
            const rating = document.getElementById('rating-count');
            const days = document.getElementById('activity-days');
            if (songs) songs.textContent = s.songsCount ?? s.songs ?? 0;
            if (rating) rating.textContent = s.rating ?? 0;
            if (days) days.textContent = s.activityDays ?? s.days ?? 1;
        }
        apply(stats);
        // Если почему-то пришли нули (или не авторизованы), пробуем публичный профиль по username
        const needFallback = !stats || (!stats.songsCount && !stats.rating);
        if (needFallback) {
            try {
                const { usersAPI } = await import('./api.js');
                const resp = await usersAPI.getPublicByUsername(currentUser.username);
                apply({ songsCount: resp.user.songsCount, rating: resp.user.rating, activityDays: resp.user.activityDays });
            } catch {}
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        // Фоллбек на публичный профиль
        try {
            const { usersAPI } = await import('./api.js');
            const resp = await usersAPI.getPublicByUsername(currentUser.username);
            const songs = document.getElementById('songs-count');
            const rating = document.getElementById('rating-count');
            const days = document.getElementById('activity-days');
            if (songs) songs.textContent = resp.user.songsCount ?? 0;
            if (rating) rating.textContent = resp.user.rating ?? 0;
            if (days) days.textContent = resp.user.activityDays ?? 1;
        } catch {
            document.getElementById('songs-count').textContent = '0';
            document.getElementById('rating-count').textContent = '0';
            document.getElementById('activity-days').textContent = '1';
        }
    }
}

// Публичный профиль другого пользователя с лайком/дизлайком
export const showPublicProfile = async (username) => {
    const content = document.getElementById('content');
    try {
        // Если открывают свой же профиль — показываем собственную страницу профиля
        try {
            const { getCurrentUser } = await import('./state.js');
            const me = getCurrentUser && getCurrentUser();
            if (me && me.username === username) {
                showSuccessPage();
                return;
            }
        } catch {}
        const { usersAPI } = await import('./api.js');
        const resp = await usersAPI.getPublicByUsername(username);
        const user = resp.user;
        content.innerHTML = `
            <div class="profile-section">
                <button id="back-to-songs" class="btn-back" style="margin-bottom:14px;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  Назад
                </button>
                <div class="profile-header">
                    <div class="avatar-section">
                        <div class="avatar-container">
                            <img src="${escapeHtml(user.picture_url || '/src/images/default-avatar.jpg')}" alt="Аватар" class="user-avatar">
                        </div>
                    </div>
                    <div class="profile-info">
                        <h1>${escapeHtml(user.username)}</h1>
                        <p class="user-provider">${user.provider === 'google' ? 'Вход через Google' : 'Вход через Email'}</p>
                        <p class="member-since">Участник с ${user.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU') : 'неизвестная дата'}</p>
                    </div>
                </div>

                <div class="profile-content">
                    <div class="profile-card">
                        <h3>О пользователе</h3>
                        <div class="bio-section">
                            <div class="bio-text">${escapeHtml(user.bio || 'Пока без описания')}</div>
                        </div>
                    </div>

                    <div class="profile-card stats-card">
                        <h3>Информация об авторе</h3>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <div class="stat-number" id="public-rating">${user.rating ?? 0}</div>
                                <div class="stat-label">Сумма голосов</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-number">${user.songsCount ?? 0}</div>
                                <div class="stat-label">Добавлено песен</div>
                            </div>
                            <div class="stat-item">
                                <div class="stat-number">${user.activityDays ?? 1}</div>
                                <div class="stat-label">Дней на сайте</div>
                            </div>
                        </div>
                        <div class="actions" style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
                            <button id="like-user" class="btn" style="background:#fff;color:#111;border:1px solid #cbd5e0;">👍 Лайк</button>
                            <button id="dislike-user" class="btn" style="background:#fff;color:#111;border:1px solid #cbd5e0;">👎 Дизлайк</button>
                            <button id="author-songs" class="btn btn-secondary" title="Показать песни автора">Песни автора</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('back-to-songs')?.addEventListener('click', () => {
            try { const { showSongsPage } = require('./navigation.js'); showSongsPage(); } catch { history.back(); }
        })
        document.getElementById('author-songs')?.addEventListener('click', async () => {
            try { const { showAuthorSongsPage } = await import('./navigation.js'); showAuthorSongsPage(user.username); } catch {}
        })
        const likeBtn = document.getElementById('like-user');
        const dislikeBtn = document.getElementById('dislike-user');
        const ratingEl = document.getElementById('public-rating');
        const rate = async (val) => {
            try {
                const res = await usersAPI.rateUser(user.id, val);
                if (ratingEl) ratingEl.textContent = res.rating ?? 0;
                // Дополнительно читаем профиль заново, чтобы не было расхождений
                try {
                    const fresh = await usersAPI.getPublicByUsername(user.username);
                    const u = fresh.user;
                    const ratingNode = document.getElementById('public-rating');
                    if (ratingNode) ratingNode.textContent = u.rating ?? 0;
                } catch {}
            } catch (e) {
                showModal('Ошибка', 'Не удалось отправить голос: ' + e.message, 'error');
            }
        };
        if (likeBtn) likeBtn.addEventListener('click', ()=>rate(1));
        if (dislikeBtn) dislikeBtn.addEventListener('click', ()=>rate(-1));
    } catch (e) {
        console.error(e);
        showModal('Ошибка', 'Не удалось загрузить профиль пользователя', 'error');
    }
}

async function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
        showModal('Ошибка', 'Пожалуйста, выберите файл в формате JPEG или PNG', 'error');
        e.target.value = '';
        return;
    }
    
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        showModal('Ошибка', 'Размер файла не должен превышать 5MB', 'error');
        e.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const avatarUrl = e.target.result;
        document.getElementById('user-avatar').src = avatarUrl;
        
        try {
            await updateAvatar(avatarUrl);
            currentUser.picture_url = avatarUrl;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            showModal('Успех', 'Аватар успешно обновлен!', 'success');
        } catch (error) {
            console.error('Ошибка обновления аватара:', error);
            showModal('Ошибка', 'Ошибка обновления аватара: ' + error.message, 'error');
        }
    };

    reader.readAsDataURL(file);
}

// ============================================
// РЕДАКТИРОВАНИЕ ПЕСНИ
// ============================================
export const showEditSongForm = async (songId) => {
  const content = document.getElementById('content');
  if (!content) return;
  try {
    // Загружаем песню
    const { song } = await songsAPI.getById(songId);
    // Рендерим ту же форму, что и для добавления
    showAddSongForm();
    // После рендера — подменяем тексты/значения и поведение сабмита
    setTimeout(() => {
      const container = document.querySelector('.editor-container');
      const header = container?.querySelector('.editor-header h2');
      const subtitle = container?.querySelector('.editor-header p');
      if (header) header.textContent = '✏️ Редактировать песню';
      if (subtitle) subtitle.textContent = 'Измените данные песни и сохраните изменения';

      // Берём форму добавления и клонируем, чтобы удалить ранее навешанные слушатели
      const addForm = document.getElementById('add-song-form');
      if (!addForm) return;
      const formClone = addForm.cloneNode(true);
      addForm.replaceWith(formClone);
      const form = formClone;
      form.id = 'edit-song-form';

      // Проставляем данные из БД
      const titleEl = form.querySelector('#song-title');
      const artistEl = form.querySelector('#song-artist');
      const genreEl = form.querySelector('#song-genre');
      const rhythmEl = form.querySelector('#song-rhythm');
      const customRhythmEl = form.querySelector('#custom-rhythm');
      const descrEl = form.querySelector('#song-description');
      const isPublicEl = form.querySelector('#is-public');
      const allowCommentsEl = form.querySelector('#allow-comments');
      const editor = form.querySelector('#song-editor');
      const hidden = form.querySelector('#song-content');

      if (titleEl) titleEl.value = song.title || '';
      if (artistEl) artistEl.value = song.artist || '';
      if (genreEl) genreEl.value = song.genre || '';
      // Rhythm: mirror add-form behavior. Support legacy shape {rhythm:'custom', rhythm_custom:'...'}
      if (rhythmEl) {
        const presets = ['четверка','шестерка','восьмерка','галоп'];
        const r = song.rhythm || '';
        const legacyCustom = r === 'custom' && (song.rhythm_custom || '').trim();
        const isCustom = (!!r && !presets.includes(r)) || !!legacyCustom;
        const customValue = legacyCustom || (!presets.includes(r) && r !== 'custom' ? r : '');
        rhythmEl.value = isCustom ? 'custom' : r;
        if (customRhythmEl) {
          customRhythmEl.style.display = isCustom ? 'block' : 'none';
          customRhythmEl.value = isCustom ? customValue : '';
        }
      }
      if (descrEl) descrEl.value = song.description || '';
      if (typeof song.is_public === 'boolean' && isPublicEl) isPublicEl.checked = !!song.is_public;
      if (typeof song.allow_comments === 'boolean' && allowCommentsEl) allowCommentsEl.checked = !!song.allow_comments;

      if (editor) editor.innerHTML = song.content || song.lyrics || '';
      if (hidden) hidden.value = editor?.innerHTML || '';

      // Обновим подпись кнопки сабмита
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Сохранить изменения';

      // Чисто инициализируем редактор и обработчики под новую форму
      setupSongEditor();
      installUnsavedGuards(form);

      // Reattach rhythm toggle behavior for the edit form (since we cloned the form)
      const rhythmSelect2 = form.querySelector('#song-rhythm');
      const customRhythmInput2 = form.querySelector('#custom-rhythm');
      if (rhythmSelect2 && customRhythmInput2) {
        rhythmSelect2.addEventListener('change', function() {
          customRhythmInput2.style.display = this.value === 'custom' ? 'block' : 'none';
          if (this.value !== 'custom') customRhythmInput2.value = '';
        });
      }

      // Подменяем сабмит — теперь это обновление песни
      form.addEventListener('submit', (e) => handleUpdateSong(e, songId));
    }, 50);
  } catch (e) {
    showModal('Ошибка', 'Не удалось загрузить песню для редактирования', 'error');
  }
}

function setupEditSongFormListeners(songId) {
  const form = document.getElementById('edit-song-form');
  const rhythmSelect = document.getElementById('song-rhythm');
  const customRhythmInput = document.getElementById('custom-rhythm');
  const cancelBtn = document.getElementById('cancel-edit-song');
  if (rhythmSelect && customRhythmInput) {
    rhythmSelect.addEventListener('change', function(){
      customRhythmInput.style.display = this.value==='custom' ? 'block' : 'none';
      if (this.value !== 'custom') customRhythmInput.value = '';
    });
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', async () => {
      if (window.__hasUnsavedChanges) {
        const ok = await showConfirmModal('Отмена', 'Выйти без сохранения изменений?');
        if (!ok) return;
      }
      removeUnsavedGuards();
      showSongsPage();
    });
  }
  if (form) form.addEventListener('submit', (e)=>handleUpdateSong(e, songId));
}

async function handleUpdateSong(e, songId) {
  e.preventDefault();
  const title = document.getElementById('song-title')?.value.trim();
  const artist = document.getElementById('song-artist')?.value.trim();
  const genre = document.getElementById('song-genre')?.value || '';
  const rhythmSelect = document.getElementById('song-rhythm');
  const rhythm = rhythmSelect?.value === 'custom' ? (document.getElementById('custom-rhythm')?.value.trim() || 'custom') : (rhythmSelect?.value || '');
  const description = document.getElementById('song-description')?.value.trim() || '';
  const content = document.getElementById('song-editor')?.innerHTML || '';
  if (!title || !artist || !rhythm || !content.trim()) {
    showModal('Ошибка', 'Заполните все обязательные поля', 'error');
    return;
  }
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn?.textContent;
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Сохранение...'; }
  try {
    const songData = { title, artist, genre: genre||null, rhythm, description: description||null, content, lyrics: content, chords: extractChords(content) };
    await songsAPI.update(songId, songData);
    showModal('Успех', 'Изменения сохранены', 'success');
    removeUnsavedGuards();
    setTimeout(()=>{ showSongsPage(); }, 800);
  } catch (err) {
    showModal('Ошибка', 'Не удалось сохранить: ' + err.message, 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
  }
}

async function saveBio() {
    const bio = document.getElementById('user-bio')?.value ?? '';
    try {
        const resp = await updateProfile({ bio });
        if (resp && resp.user) {
            currentUser.bio = resp.user.bio;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }
        showModal('Успех', 'Профиль успешно обновлен!', 'success');
        // Обновим статистику (рейтинг/кол-во песен/дни)
        try { await loadUserStats(); } catch {}
    } catch (error) {
        showModal('Ошибка', 'Ошибка сохранения профиля: ' + error.message, 'error');
    }
}

async function changeUsername() {
    const newUsername = await showPromptModal('Изменение имени пользователя', 'Введите новое имя пользователя:', currentUser.username);
    
    if (newUsername && newUsername.trim() && newUsername !== currentUser.username) {
        try {
            const response = await updateProfile({
                username: newUsername.trim()
            });
            
            if (response && response.user) {
                currentUser.username = response.user.username;
                currentUser.bio = response.user.bio;
                currentUser.notifications = response.user.notifications;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                showModal('Успех', 'Имя пользователя успешно изменено!', 'success');
                showSuccessPage();
            }
        } catch (error) {
            showModal('Ошибка', 'Ошибка изменения имени: ' + error.message, 'error');
        }
    }
}

async function changePasswordProfile() {
    const currentPassword = await showPromptModal('Текущий пароль', 'Введите ваш текущий пароль для подтверждения:', '', { type: 'password' });
    if (!currentPassword) return;
    
    const newPassword = await showPromptModal('Новый пароль', 'Введите новый пароль (минимум 6 символов):', '', { type: 'password' });
    if (!newPassword) return;
    
    if (newPassword.length < 6) {
        showModal('Ошибка', 'Пароль должен содержать не менее 6 символов!', 'error');
        return;
    }
    
    const confirmPassword = await showPromptModal('Подтверждение пароля', 'Повторите новый пароль для подтверждения:', '', { type: 'password' });
    if (newPassword !== confirmPassword) {
        showModal('Ошибка', 'Пароли не совпадают!', 'error');
        return;
    }
    
    try {
        await changePassword(currentPassword, newPassword);
        showModal('Успех', 'Пароль успешно изменен!', 'success');
    } catch (error) {
        showModal('Ошибка', 'Ошибка изменения пароля: ' + error.message, 'error');
    }
}

// Функции для удаления аккаунта
async function handleDeleteAccount() {
    // Проверяем, не удален ли уже аккаунт
    if (currentUser.value.is_deleted) {
        const confirmed = await showConfirmModal(
            'Аккаунт уже удален', 
            'Ваш аккаунт уже находится в процессе удаления. Вы можете восстановить его в любое время до окончательного удаления.\n\nХотите восстановить аккаунт сейчас?',
            'Восстановить', 
            'Отмена'
        );
        
        if (confirmed) {
            // Показываем модальное окно восстановления
            import('../main.js').then(main => {
                main.showDeletedAccountModal(currentUser.value);
            });
        }
        return;
    }
    
    const confirmed = await showConfirmModal(
        'Удаление аккаунта',
        'Вы уверены, что хотите удалить свой аккаунт? Все ваши данные будут удалены через 14 дней. Вы можете отменить это действие в течение 14 дней.'
    );

    if (!confirmed) return;

    try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            showModal(
                'Аккаунт удален', 
                `Ваш аккаунт будет полностью удален ${data.deletedAt ? new Date(data.deletedAt).toLocaleDateString() : 'неизвестная дата'}. ` +
                'Вы можете восстановить его в течение 14 дней. ' +
                'Сейчас вы будете перенаправлены на главную страницу.',
                'info'
            );
            
            // Выход из аккаунта и перенаправление через 3 секунды
            setTimeout(() => {
                logout();
            }, 3000);
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Не удалось удалить аккаунт');
        }
    } catch (error) {
        showModal('Ошибка', error.message, 'error');
    }
}

async function checkDeletionStatus() {
    try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
        const response = await fetch(`${API_BASE_URL}/auth/profile/deletion-status`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            updateDeleteStatusUI(data);
        } else {
            // Если пользователь не найден (возможно, уже удален), выходим из аккаунта
            if (response.status === 404) {
                showModal('Ошибка', 'Сессия истекла. Пожалуйста, войдите снова.', 'error');
                setTimeout(() => {
                    logout();
                }, 2000);
            }
        }
    } catch (error) {
        console.error('Error checking deletion status:', error);
    }
}

function updateDeleteStatusUI(status) {
    const deleteStatus = document.getElementById('delete-status');
    const deleteBtn = document.getElementById('delete-account');
    
    if (!deleteStatus || !deleteBtn) return;

    if (status.isDeleted && status.deletedAt) {
        const deletionDate = status.deletedAt ? new Date(status.deletedAt).toLocaleDateString() : 'неизвестная дата';
        const deletedAtDate = new Date(status.deletedAt);
        const daysLeft = !isNaN(deletedAtDate.getTime()) ? 
            Math.ceil((deletedAtDate - new Date()) / (1000 * 60 * 60 * 24)) : 0;
        
        deleteStatus.style.display = 'block';
        deleteStatus.innerHTML = `
            <div class="alert alert-warning">
                <h4>⚠️ Аккаунт отмечен для удаления</h4>
                <p>Ваш аккаунт будет полностью удален ${deletionDate} (через ${daysLeft} дней).</p>
                <p>Вы можете отменить удаление в любой момент до этой даты.</p>
                <button id="cancel-delete" class="btn btn-secondary">Отменить удаление</button>
            </div>
        `;
        
        deleteBtn.style.display = 'none';
        
        // Добавляем обработчик для отмены удаления
        const cancelBtn = document.getElementById('cancel-delete');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', handleCancelDelete);
        }
    } else {
        deleteStatus.style.display = 'none';
        deleteBtn.style.display = 'block';
    }
}

async function handleCancelDelete() {
    try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
        const response = await fetch(`${API_BASE_URL}/auth/profile/cancel-delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            showModal('Успех', data.message, 'success');
            
            // Обновляем UI
            updateDeleteStatusUI({ isDeleted: false });
            
            // Обновляем данные пользователя
            await loadCurrentUser();
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Не удалось отменить удаление');
        }
    } catch (error) {
        showModal('Ошибка', error.message, 'error');
    }
}

async function loadCurrentUser() {
    try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
        const response = await fetch(`${API_BASE_URL}/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });

        if (response.ok) {
            const userData = await response.json();
            localStorage.setItem('currentUser', JSON.stringify(userData));
            return userData;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        return null;
    }
}

function toggleNotifications(e) {
    const enabled = e.target.checked;
    setTimeout(async () => {
        try {
            await updateProfile({
                notifications: enabled
            });
            console.log(`Уведомления ${enabled ? 'включены' : 'отключены'}`);
        } catch (error) {
            console.error('Ошибка сохранения настроек уведомлений:', error);
            e.target.checked = !enabled;
        }
    }, 500);
}

// ============================================
// ФОРМА ДОБАВЛЕНИЯ ПЕСНИ
// ============================================

export const showAddSongForm = () => {
    const content = document.getElementById('content');
    if (!content) {
        console.error('❌ Элемент content не найден');
        return;
    }
    
    content.innerHTML = `
        <div class="editor-container">
            <div class="editor-header">
                <h2>🎵 Создать новую песню</h2>
                <p>Используйте расширенный редактор для форматирования текста, добавления медиа и аккордов</p>
            </div>
            
            <form id="add-song-form" class="song-editor-form">
                <div class="form-row">
                    <div class="form-group">
                        <label for="song-title">Название песни *</label>
                        <input type="text" id="song-title" required placeholder="Введите название песни">
                    </div>
                    <div class="form-group">
                        <label for="song-artist">Исполнитель *</label>
                        <input type="text" id="song-artist" required placeholder="Имя исполнителя или группы">
                    </div>
                </div>

                <div class="form-group">
                    <label for="song-genre">Жанр</label>
                    <select id="song-genre">
                        <option value="">Выберите жанр</option>
                        <option value="rock">Рок</option>
                        <option value="pop">Поп</option>
                        <option value="folk">Фолк</option>
                        <option value="jazz">Джаз</option>
                        <option value="blues">Блюз</option>
                        <option value="classical">Классика</option>
                        <option value="other">Другое</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="song-rhythm">Ритмический рисунок *</label>
                    <select id="song-rhythm" required>
                        <option value="">Выберите ритмический рисунок</option>
                        <option value="четверка">Четверка</option>
                        <option value="шестерка">Шестерка</option>
                        <option value="восьмерка">Восьмерка</option>
                        <option value="галоп">Галоп</option>
                        <option value="custom">Другое (бой)</option>
                    </select>
                    <input type="text" id="custom-rhythm" style="display: none; margin-top: 10px;" placeholder="Введите свой ритмический рисунок (например: бой шестерка...)">
                </div>

                <div class="form-group form-group-description">
                    <label for="song-description">Описание песни</label>
                    <textarea id="song-description" rows="4" placeholder="Краткое описание, история создания песни, интересные факты..."></textarea>
                </div>

                <div class="editor-toolbar">
                    <div class="toolbar-separator"></div>
                    <button type="button" class="toolbar-btn" id="add-chord-btn" title="Добавить аккорд">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M8 15l3-3 2 2 3-3"></path>
                      </svg>
                      Аккорд
                    </button>
                    <div class="toolbar-separator"></div>
                    <button type="button" class="toolbar-btn" id="add-image-btn" title="Изображение">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px">
                        <rect x="3" y="3" width="18" height="14" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <path d="M21 13l-5-5L5 19"></path>
                      </svg>
                      Изображение
                    </button>
                    <button type="button" class="toolbar-btn" id="add-video-btn" title="Видео">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px">
                        <polygon points="23 7 16 12 23 17 23 7"></polygon>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                      </svg>
                      Видео
                    </button>
                    <button type="button" class="toolbar-btn" id="add-audio-btn" title="Аудио">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                      </svg>
                      Аудио
                    </button>
                </div>

                <div class="form-group">
                    <label for="song-content">Текст песни *</label>
                    <div id="song-editor" class="rich-text-editor" contenteditable="true"></div>
                    <textarea id="song-content" name="song-content" style="display: none;"></textarea>
                </div>

                <div id="media-preview" class="media-preview"></div>

                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="is-public" checked>
                        Сделать песню публичной
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" id="allow-comments" checked>
                        Разрешить комментарии
                    </label>
                </div>

                <div class="form-actions">
                    <button type="button" id="preview-song" class="btn btn-secondary" data-unsaved-ignore="true">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      Предпросмотр
                    </button>
                    <button type="submit" class="btn btn-success" data-unsaved-ignore="true">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px"><path d="M19 21H5a2 2 0 0 1-2-2V7l4-4h10l4 4v12a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline></svg>
                      Сохранить песню
                    </button>
                    <button type="button" id="cancel-add-song" class="btn btn-outline">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      Отмена
                    </button>
                </div>
            </form>
        </div>

        <!-- Модальное окно для аккордов -->
        <div id="chord-modal" class="modal-overlay" style="display: none;"></div>

        <!-- Модальное окно для медиа -->
        <div id="media-modal" class="modal-overlay" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="media-modal-title">Добавить медиа</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="media-upload-options">
                        <div class="upload-option">
                            <input type="radio" id="upload-url" name="media-type" value="url" checked>
                            <label for="upload-url">Ссылка (URL)</label>
                        </div>
                        <div class="upload-option">
                            <input type="radio" id="upload-file" name="media-type" value="file">
                            <label for="upload-file">Загрузить файл</label>
                        </div>
                    </div>
                    
                    <div id="url-upload" class="upload-section">
                        <input type="url" id="media-url" placeholder="https://example.com/image.jpg" class="url-input">
                        <div class="media-preview-small" id="url-preview"></div>
                    </div>
                    
                    <div id="file-upload" class="upload-section" style="display: none;">
                        <input type="file" id="media-file" accept="image/*,video/*,audio/*">
                        <div class="file-info" id="file-info"></div>
                    </div>
                    
                    <button id="insert-media" class="btn btn-primary">Вставить в редактор</button>
                </div>
            </div>
        </div>
    `;
    
    // Даем время DOM обновиться перед настройкой
    setTimeout(() => {
        console.log('🔄 Инициализация формы добавления песни...');
        setupSongEditor();
        setupAddSongFormListeners();
        const form = document.getElementById('add-song-form');
        installUnsavedGuards(form);
    }, 50);
}

// Настройка редактора песни
// Настройка редактора песни
function setupSongEditor() {
    const editor = document.getElementById('song-editor');
    
    // ПРОВЕРКА НАЛИЧИЯ ЭЛЕМЕНТОВ
    if (!editor) {
        console.error('❌ Элемент song-editor не найден, повторная попытка через 100мс...');
        setTimeout(setupSongEditor, 100);
        return;
    }
    
    console.log('✅ Редактор найден, настройка...');
    
    // Инициализируем пустое содержимое если нужно
    if (!editor.innerHTML || editor.innerHTML.trim() === '') {
        editor.innerHTML = '<p><br></p>';
    }
    
    // Обработчики для кнопок с проверкой существования
    const setupButtonHandler = (id, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('click', handler);
            console.log(`✅ Обработчик установлен для: ${id}`);
        } else {
            console.warn(`⚠️ Элемент ${id} не найден`);
        }
    };
    
    // Настройка обработчиков
    setupButtonHandler('add-chord-btn', showChordModal);
    setupButtonHandler('add-image-btn', () => insertImagePrompt());
    setupButtonHandler('add-video-btn', () => insertVideoPrompt());
    setupButtonHandler('add-audio-btn', () => insertAudioPrompt());
    setupButtonHandler('preview-song', previewSong);
    
    // Обработчик изменения содержимого редактора
    editor.addEventListener('input', () => {
        const contentField = document.getElementById('song-content');
        if (contentField) {
            contentField.value = editor.innerHTML;
        }
    });
    
    // Фокусируемся на редакторе
    editor.focus();
    
    setupModalHandlers();
}

// Настройка обработчиков формы добавления песни
// Настройка обработчиков формы добавления песни
function setupAddSongFormListeners() {
    const form = document.getElementById('add-song-form');
    const rhythmSelect = document.getElementById('song-rhythm');
    const customRhythmInput = document.getElementById('custom-rhythm');
    const cancelBtn = document.getElementById('cancel-add-song');
    const previewBtn = document.getElementById('preview-song');
    
    console.log('🔧 Настройка обработчиков формы:', {
        form: !!form,
        rhythmSelect: !!rhythmSelect,
        customRhythmInput: !!customRhythmInput,
        cancelBtn: !!cancelBtn,
        previewBtn: !!previewBtn
    });

    if (rhythmSelect && customRhythmInput) {
        rhythmSelect.addEventListener('change', function() {
            customRhythmInput.style.display = this.value === 'custom' ? 'block' : 'none';
            if (this.value !== 'custom') {
                customRhythmInput.value = '';
            }
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', async (e) => {
            if (window.__hasUnsavedChanges) {
                const ok = await showConfirmModal('Отмена', 'Отменить редактирование? Изменения будут потеряны.');
                if (!ok) return;
            }
            removeUnsavedGuards();
            showSuccessPage();
        });
    }
    
    if (previewBtn) {
        previewBtn.addEventListener('click', previewSong);
    }
    
    if (form) {
        form.addEventListener('submit', handleAddRichSong);
    } else {
        console.error('❌ Форма add-song-form не найдена');
    }
}

// ============================================
// БАЗА АККОРДОВ ПО НОТАМ
// ============================================

const CHORDS_DATABASE = {
    'C': {
        'Открытые': ['C', 'Cm', 'C7', 'Cmaj7', 'Cm7', 'Csus4', 'Csus2', 'Cadd9'],
        'Баррэ': ['Cm(III)', 'Cm(V)', 'Cm(VIII)', 'Cm(X)', 'C(III)', 'C(V)', 'C(VIII)', 'C(X)', 'C7(III)', 'C7(V)', 'C7(VIII)'],
        'Квинты': ['C5']
    },
    'C#/Db': {
        'Открытые': ['C#', 'C#m', 'C#7', 'C#maj7', 'C#m7', 'Db', 'Dbm', 'Db7', 'Dbmaj7', 'Dbm7'],
        'Баррэ': ['C#m(IV)', 'C#m(IX)', 'C#m(XI)', 'C#(IV)', 'C#(IX)', 'C#(XI)'],
        'Квинты': ['C#5', 'Db5']
    },
    'D': {
        'Открытые': ['D', 'Dm', 'D7', 'Dmaj7', 'Dm7', 'Dsus4', 'Dsus2', 'Dadd9'],
        'Баррэ': ['Dm(V)', 'Dm(VII)', 'Dm(X)', 'Dm(XII)', 'D(V)', 'D(VII)', 'D(X)', 'D(XII)', 'D7(V)', 'D7(X)', 'D7(XII)'],
        'Квинты': ['D5']
    },
    'D#/Eb': {
        'Открытые': ['D#', 'D#m', 'D#7', 'D#maj7', 'D#m7', 'Eb', 'Ebm', 'Eb7', 'Ebmaj7', 'Ebm7'],
        'Баррэ': ['D#m(VI)', 'D#m(XI)', 'D#(VI)', 'D#(XI)'],
        'Квинты': ['D#5', 'Eb5']
    },
    'E': {
        'Открытые': ['E', 'Em', 'E7', 'Emaj7', 'Em7', 'Esus4', 'Esus2', 'Eadd9'],
        'Баррэ': ['Em(VII)', 'Em(IX)', 'Em(XII)', 'E(VII)', 'E(IX)', 'E(XII)', 'E7(VII)', 'E7(IX)', 'E7(XII)'],
        'Квинты': ['E5']
    },
    'F': {
        'Открытые': ['F', 'Fm', 'F7', 'Fmaj7', 'Fm7', 'Fsus4', 'Fsus2', 'Fadd9'],
        'Баррэ': ['Fm(I)', 'Fm(III)', 'Fm(V)', 'Fm(VIII)', 'Fm(X)', 'F(I)', 'F(III)', 'F(V)', 'F(VIII)', 'F(X)', 'F7(I)', 'F7(III)', 'F7(VIII)'],
        'Квинты': ['F5']
    },
    'F#/Gb': {
        'Открытые': ['F#', 'F#m', 'F#7', 'F#maj7', 'F#m7', 'Gb', 'Gbm', 'Gb7', 'Gbmaj7', 'Gbm7'],
        'Баррэ': ['F#m(II)', 'F#m(IV)', 'F#m(IX)', 'F#m(XI)', 'F#(II)', 'F#(IV)', 'F#(IX)', 'F#(XI)'],
        'Квинты': ['F#5', 'Gb5']
    },
    'G': {
        'Открытые': ['G', 'Gm', 'G7', 'Gmaj7', 'Gm7', 'Gsus4', 'Gsus2', 'Gadd9'],
        'Баррэ': ['Gm(III)', 'Gm(V)', 'Gm(X)', 'Gm(XII)', 'G(III)', 'G(V)', 'G(X)', 'G(XII)', 'G7(III)', 'G7(V)', 'G7(X)'],
        'Квинты': ['G5']
    },
    'G#/Ab': {
        'Открытые': ['G#', 'G#m', 'G#7', 'G#maj7', 'G#m7', 'Ab', 'Abm', 'Ab7', 'Abmaj7', 'Abm7'],
        'Баррэ': ['G#m(IV)', 'G#m(VI)', 'G#m(XI)', 'G#(IV)', 'G#(VI)', 'G#(XI)'],
        'Квинты': ['G#5', 'Ab5']
    },
    'A': {
        'Открытые': ['A', 'Am', 'A7', 'Amaj7', 'Am7', 'Asus4', 'Asus2', 'Aadd9'],
        'Баррэ': ['Am(III)', 'Am(V)', 'Am(VII)', 'Am(X)', 'Am(XII)', 'A(V)', 'A(VII)', 'A(XII)', 'A7(V)', 'A7(VII)', 'A7(XII)'],
        'Квинты': ['A5']
    },
    'A#/Bb': {
        'Открытые': ['A#', 'A#m', 'A#7', 'A#maj7', 'A#m7', 'Bb', 'Bbm', 'Bb7', 'Bbmaj7', 'Bbm7'],
        'Баррэ': ['A#m(I)', 'A#m(VI)', 'A#m(VIII)', 'A#(I)', 'A#(VI)', 'A#(VIII)'],
        'Квинты': ['A#5', 'Bb5']
    },
    'B/H': {
        'Открытые': ['B', 'Bm', 'B7', 'Bmaj7', 'Bm7', 'Bsus4', 'Bsus2', 'Badd9', 'H', 'Hm', 'H7', 'Hmaj7', 'Hm7'],
        'Баррэ': ['Bm(II)', 'Bm(V)', 'Bm(VII)', 'Bm(IX)', 'Bm(XII)', 'B(II)', 'B(VII)', 'B(IX)', 'B(XII)', 'B7(II)', 'B7(VII)', 'B7(IX)', 'Hm(II)', 'Hm(VII)', 'H(II)', 'H(VII)'],
        'Квинты': ['B5', 'H5']
    }
};

// ============================================
// МОДАЛЬНОЕ ОКНО АККОРДОВ (ПО НОТАМ)
// ============================================

function showChordModal() {
    const modal = document.getElementById('chord-modal');
    const editor = document.getElementById('song-editor');
    
    modal.innerHTML = `
        <div class="modal-content chord-modal-large">
            <div class="modal-header">
                <h3>Выберите аккорд</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="chord-tabs-scroll">
                    <div class="chord-tabs">
                        ${Object.keys(CHORDS_DATABASE).map((note, index) => `
                            <button class="chord-tab ${index === 0 ? 'active' : ''}" data-note="${note}">${note.split(' ')[0]}</button>
                        `).join('')}
                    </div>
                </div>
                
                <div class="chord-content-container">
                    ${Object.keys(CHORDS_DATABASE).map((note, index) => `
                        <div class="chord-note-content ${index === 0 ? 'active' : ''}" data-note="${note}">
                            <h3 class="chord-note-header">${note}</h3>
                            
                            ${Object.keys(CHORDS_DATABASE[note]).map(category => `
                                <div class="chord-subcategory">
                                    <h4 class="chord-subcategory-title">${category}</h4>
                                    <div class="chord-grid">
                                        ${CHORDS_DATABASE[note][category].map(chord => `
                                            <button class="chord-grid-btn" data-chord="${chord}">${chord}</button>
                                        `).join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
    
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    const tabs = modal.querySelectorAll('.chord-tab');
    const contents = modal.querySelectorAll('.chord-note-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const note = tab.dataset.note;
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            modal.querySelector(`.chord-note-content[data-note="${note}"]`).classList.add('active');
            tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
    });
    
    const chordButtons = modal.querySelectorAll('.chord-grid-btn');
    chordButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const chord = btn.dataset.chord;
            insertChord(chord);
            modal.style.display = 'none';
        });
    });
    
    editor.focus();
}

function insertChord(chord) {
    const editor = document.getElementById('song-editor');
    const selection = window.getSelection();
    
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const chordElement = document.createElement('span');
        chordElement.className = 'chord-text';
        chordElement.textContent = chord;
        chordElement.contentEditable = 'false';
        chordElement.style.fontWeight = 'bold';
        chordElement.style.color = '#2196F3';
        
        range.insertNode(chordElement);
        
        const spaceNode = document.createTextNode(' ');
        range.setStartAfter(chordElement);
        range.insertNode(spaceNode);
        range.setStartAfter(spaceNode);
        range.collapse(true);
        
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    editor.focus();
    document.getElementById('song-content').value = editor.innerHTML;
}

// ============================================
// ВСТАВКА РИТМИЧЕСКИХ РИСУНКОВ
// ============================================

function insertRhythmPattern(pattern) {
    const editor = document.getElementById('song-editor');
    const selection = window.getSelection();
    
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rhythmElement = document.createElement('span');
        rhythmElement.className = 'rhythm-pattern';
        rhythmElement.textContent = pattern;
        rhythmElement.contentEditable = 'false';
        
        range.insertNode(rhythmElement);
        range.setStartAfter(rhythmElement);
        range.collapse(true);
        
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    editor.focus();
    document.getElementById('song-content').value = editor.innerHTML;
}

// ============================================
// МЕДИА МОДАЛЬНОЕ ОКНО
// ============================================

function showMediaModal(type) {
    const modal = document.getElementById('media-modal');
    const title = document.getElementById('media-modal-title');
    
    title.textContent = 
        type === 'image' ? 'Добавить изображение' :
        type === 'video' ? 'Добавить видео' :
        'Добавить аудио';
    
    modal.style.display = 'flex';
    modal.dataset.mediaType = type;
    
    document.getElementById('media-url').value = '';
    document.getElementById('media-file').value = '';
    document.getElementById('url-preview').innerHTML = '';
    document.getElementById('file-info').textContent = '';
}

function setupModalHandlers() {
    const mediaModal = document.getElementById('media-modal');
    
    if (!mediaModal) return;
    
    mediaModal.querySelector('.modal-close').addEventListener('click', () => {
        mediaModal.style.display = 'none';
    });
    
    mediaModal.addEventListener('click', (e) => {
        if (e.target === mediaModal) {
            mediaModal.style.display = 'none';
        }
    });
    
    document.querySelectorAll('input[name="media-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const isUrl = e.target.value === 'url';
            document.getElementById('url-upload').style.display = isUrl ? 'block' : 'none';
            document.getElementById('file-upload').style.display = isUrl ? 'none' : 'block';
        });
    });
    
    document.getElementById('media-url').addEventListener('input', (e) => {
        const url = e.target.value;
        const preview = document.getElementById('url-preview');
        
        if (url && (url.match(/\.(jpeg|jpg|gif|png)$/) || url.includes('youtube') || url.includes('vimeo'))) {
            const mediaType = document.getElementById('media-modal').dataset.mediaType;
            
            if (mediaType === 'image') {
                preview.innerHTML = `<img src="${url}" alt="Preview" style="max-width: 100%; max-height: 150px;">`;
            } else if (mediaType === 'video') {
                preview.innerHTML = `<div class="video-preview">Видео ссылка: ${url}</div>`;
            } else {
                preview.innerHTML = `<div class="audio-preview">Аудио ссылка: ${url}</div>`;
            }
        } else {
            preview.innerHTML = '';
        }
    });
    
    document.getElementById('media-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        const fileInfo = document.getElementById('file-info');
        
        if (file) {
            fileInfo.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        } else {
            fileInfo.textContent = '';
        }
    });
    
    document.getElementById('insert-media').addEventListener('click', () => {
        const modal = document.getElementById('media-modal');
        const mediaType = modal.dataset.mediaType;
        const isUrlUpload = document.getElementById('upload-url').checked;
        
        let mediaHtml = '';
        
        if (isUrlUpload) {
            const url = document.getElementById('media-url').value;
            if (url) {
                if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
                    const videoId = extractYouTubeId(url);
                    if (videoId) {
                        mediaHtml = `<div class="editor-media editor-youtube">
                            <iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" 
                                frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowfullscreen style="max-width: 100%; aspect-ratio: 16/9;"></iframe>
                        </div>`;
                    }
                } else if (mediaType === 'image') {
                    mediaHtml = `<img src="${url}" alt="Image" class="editor-media editor-image">`;
                } else if (mediaType === 'video') {
                    mediaHtml = `<div class="editor-media editor-video">
                        <video controls src="${url}" style="max-width: 100%;"></video>
                    </div>`;
                } else {
                    mediaHtml = `<div class="editor-media editor-audio">
                        <audio controls src="${url}" style="width: 100%;"></audio>
                    </div>`;
                }
            }
        } else {
            const file = document.getElementById('media-file').files[0];
            if (file) {
                // Загружаем файл на сервер
                if (mediaType === 'image') {
                    // Показываем загрузчик
                    const insertBtn = document.getElementById('insert-media');
                    const originalText = insertBtn.textContent;
                    insertBtn.textContent = 'Загрузка...';
                    insertBtn.disabled = true;
                    
                    mediaAPI.uploadImage(file)
                        .then(response => {
                            mediaHtml = `<img src="${response.url}" alt="${file.name}" class="editor-media editor-image">`;
                            insertMediaToEditor(mediaHtml);
                            modal.style.display = 'none';
                        })
                        .catch(error => {
                            console.error('Error uploading image:', error);
                            showModal('Ошибка', 'Не удалось загрузить изображение. Попробуйте использовать URL.');
                        })
                        .finally(() => {
                            insertBtn.textContent = originalText;
                            insertBtn.disabled = false;
                        });
                    return; // Выходим, так как вставка произойдет асинхронно
                } else {
                    // Для видео и аудио пока используем локальные файлы
                    const objectUrl = URL.createObjectURL(file);
                    if (mediaType === 'video') {
                        mediaHtml = `<div class="editor-media editor-video">
                            <video controls src="${objectUrl}" style="max-width: 100%;"></video>
                        </div>`;
                    } else {
                        mediaHtml = `<div class="editor-media editor-audio">
                            <audio controls src="${objectUrl}" style="width: 100%;"></audio>
                        </div>`;
                    }
                }
            }
        }
        
        if (mediaHtml) {
            insertMedia(mediaHtml);
            modal.style.display = 'none';
        }
    });
}

function insertMedia(mediaHtml) {
    const editor = document.getElementById('song-editor');
    if (editor) {
        // Вставляем медиа в редактор
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            
            const div = document.createElement('div');
            div.innerHTML = mediaHtml;
            const mediaElement = div.firstChild;
            
            range.insertNode(mediaElement);
            
            // Ставим курсор после медиа
            range.setStartAfter(mediaElement);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // Если нет выделения, просто добавляем в конец
            editor.innerHTML += mediaHtml;
        }
        
        // Обновляем скрытое поле
        const contentField = document.getElementById('song-content');
        if (contentField) {
            contentField.value = editor.innerHTML;
        }
        
        // Фокус на редактор
        editor.focus();
    }
}

function insertMediaToEditor(mediaHtml) {
    insertMedia(mediaHtml);
}

// Простые функции вставки медиа через prompt
function insertImagePrompt() {
    const choice = confirm('Загрузить файл или вставить URL?\n\nOK = Загрузить файл\nОтмена = Вставить URL');
    
    if (choice) {
        // Загрузка файла
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    // Показываем загрузчик
                    const editor = document.getElementById('song-editor');
                    const originalContent = editor.innerHTML;
                    editor.innerHTML += '<div style="color: #666; padding: 10px;">Загрузка изображения...</div>';
                    
                    const response = await mediaAPI.uploadImage(file);
                    const mediaHtml = `<img src="${response.url}" alt="${file.name}" class="editor-media editor-image">`;
                    insertMedia(mediaHtml);
                } catch (error) {
                    console.error('Error uploading image:', error);
                    showModal('Ошибка', 'Не удалось загрузить изображение. Попробуйте использовать URL.', 'error');
                    // Восстанавливаем контент
                    editor.innerHTML = originalContent;
                }
            }
        };
        input.click();
    } else {
        // Вставка URL
        const url = prompt('Введите URL изображения:');
        if (url) {
            const mediaHtml = `<img src="${url}" alt="Image" class="editor-media editor-image">`;
            insertMedia(mediaHtml);
        }
    }
}

function insertVideoPrompt() {
    const url = prompt('Введите URL YouTube видео:');
    if (url) {
        const videoId = extractYouTubeId(url);
        if (videoId) {
            const mediaHtml = `<div class="editor-media editor-youtube">
                <iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" 
                    frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen style="max-width: 100%; aspect-ratio: 16/9;"></iframe>
            </div>`;
            insertMedia(mediaHtml);
        } else {
            showModal('Ошибка', 'Неверный URL YouTube видео', 'error');
        }
    }
}

function insertAudioPrompt() {
    const choice = confirm('Загрузить файл или вставить URL?\n\nOK = Загрузить файл\nОтмена = Вставить URL');
    
    if (choice) {
        // Загрузка файла
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const objectUrl = URL.createObjectURL(file);
                const mediaHtml = `<div class="editor-media editor-audio">
                    <audio controls src="${objectUrl}" style="width: 100%;"></audio>
                </div>`;
                insertMedia(mediaHtml);
            }
        };
        input.click();
    } else {
        // Вставка URL
        const url = prompt('Введите URL аудио файла:');
        if (url) {
            const mediaHtml = `<div class="editor-media editor-audio">
                <audio controls src="${url}" style="width: 100%;"></audio>
            </div>`;
            insertMedia(mediaHtml);
        }
    }
}

// ============================================
// ПРЕДПРОСМОТР И СОХРАНЕНИЕ
// ============================================

function previewSong() {
    // Проверяем существование элементов с безопасным доступом
    const titleEl = document.getElementById('song-title');
    const artistEl = document.getElementById('song-artist');
    const editorEl = document.getElementById('song-editor');
    
    console.log('🔍 Элементы предпросмотра:', {
        titleEl: !!titleEl,
        artistEl: !!artistEl,
        editorEl: !!editorEl
    });
    
    if (!titleEl || !artistEl || !editorEl) {
        showModal('Ошибка', 'Элементы формы не найдены. Пожалуйста, обновите страницу.', 'error');
        return;
    }
    
    const title = titleEl.value;
    const artist = artistEl.value;
    const content = editorEl.innerHTML;
    
    if (!title || !artist) {
        showModal('Ошибка', 'Заполните название и исполнителя', 'error');
        return;
    }
    
    if (!content || content === '<br>' || content === '<div><br></div>') {
        showModal('Ошибка', 'Добавьте текст песни в редактор', 'error');
        return;
    }
    
    showModal('Предпросмотр', 
        `🎵 <strong>${escapeHtml(title)}</strong><br>👤 <strong>${escapeHtml(artist)}</strong><br><br>📝 Содержимое:<br><div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; background: #f9f9f9;">${content}</div>`, 
        'info');
    // Mark preview modal overlay to be ignored by unsaved guard
    setTimeout(() => {
        const overlay = document.querySelector('.modal-overlay');
        if (overlay) {
            overlay.setAttribute('data-unsaved-ignore', 'true');
            const closeBtn = overlay.querySelector('.modal-close');
            if (closeBtn) closeBtn.setAttribute('data-unsaved-ignore', 'true');
        }
    }, 0);
}

const handleAddRichSong = async (e) => {
    e.preventDefault();
    
    // Проверяем существование элементов
    const titleEl = document.getElementById('song-title');
    const artistEl = document.getElementById('song-artist');
    const genreEl = document.getElementById('song-genre');
    const rhythmSelect = document.getElementById('song-rhythm');
    const customRhythmEl = document.getElementById('custom-rhythm');
    const descriptionEl = document.getElementById('song-description');
    const editorEl = document.getElementById('song-editor');
    const isPublicEl = document.getElementById('is-public');
    const allowCommentsEl = document.getElementById('allow-comments');

    // Проверяем, что все необходимые элементы существуют
    if (!titleEl || !artistEl || !rhythmSelect || !editorEl) {
        console.error('❌ Не найдены необходимые элементы формы:', {
            titleEl: !!titleEl,
            artistEl: !!artistEl,
            rhythmSelect: !!rhythmSelect,
            editorEl: !!editorEl
        });
        showModal('Ошибка', 'Ошибка загрузки формы. Пожалуйста, обновите страницу.', 'error');
        return;
    }

    const title = titleEl.value.trim();
    const artist = artistEl.value.trim();
    const genre = genreEl ? genreEl.value : '';
    const rhythm = rhythmSelect.value === 'custom' 
        ? (customRhythmEl ? customRhythmEl.value.trim() : '')
        : rhythmSelect.value;
    const description = descriptionEl ? descriptionEl.value.trim() : '';
    const content = editorEl.innerHTML;
    const isPublic = isPublicEl ? isPublicEl.checked : true;
    const allowComments = allowCommentsEl ? allowCommentsEl.checked : true;

    console.log('🎵 Добавление песни:', { 
        title, 
        artist, 
        genre, 
        rhythm,
        description: description.substring(0, 50) + '...',
        content: content.substring(0, 100) + '...',
        isPublic,
        allowComments
    });

    // Валидация обязательных полей
    if (!title) {
        showModal('Ошибка', 'Введите название песни', 'error');
        return;
    }
    
    if (!artist) {
        showModal('Ошибка', 'Введите имя исполнителя', 'error');
        return;
    }
    
    if (!rhythm) {
        showModal('Ошибка', 'Выберите ритмический рисунок', 'error');
        return;
    }
    
    if (!content || content === '<br>' || content === '<div><br></div>' || content.trim() === '') {
        showModal('Ошибка', 'Добавьте текст песни в редактор', 'error');
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (!submitBtn) {
        showModal('Ошибка', 'Не найдена кнопка отправки', 'error');
        return;
    }

    const originalText = submitBtn.textContent;
    submitBtn.innerHTML = '<div class="loader loader-small"></div> Сохранение...';
    submitBtn.disabled = true;

    try {
        // Подготовка данных
        const songData = {
            title: title,
            artist: artist,
            genre: genre || null,
            rhythm: rhythm,
            description: description || null,
            content: content,
            lyrics: content, // для обратной совместимости
            is_public: isPublic,
            allow_comments: allowComments,
            chords: extractChords(content)
        };

        console.log('📦 Отправляемые данные:', songData);

        // Проверяем токен пользователя
        if (!currentUser || !currentUser.token) {
            throw new Error('Пользователь не авторизован');
        }

        // Через API-слой (POST /api/songs)
        const result = await songsAPI.create(songData);
        console.log('✅ Песня создана:', result);
        showModal('Успех', `Песня "${escapeHtml(title)}" успешно создана!`, 'success');
        
        // Возврат в профиль через 2 секунды
        setTimeout(() => {
            removeUnsavedGuards();
            showSuccessPage();
        }, 2000);
        
    } catch (error) {
        console.error('❌ Ошибка создания песни:', error);
        
        let errorMessage = 'Ошибка при создании песни: ';
        if (error.message.includes('Unexpected token')) {
            errorMessage += 'Проблема с форматом данных. Проверьте введенные значения.';
        } else if (error.message.includes('NetworkError')) {
            errorMessage += 'Проблема с соединением. Проверьте интернет-соединение.';
        } else {
            errorMessage += error.message;
        }
        
        showModal('Ошибка', errorMessage, 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
};

function extractChords(content) {
    if (!content) return '';
    
    // Ищем аккорды в формате [Am], [C], [G7] и т.д.
    const chordRegex = /\[([A-G][#b]?[m]?[0-9]?(?:\/[A-G][#b]?)?)\]/g;
    const chords = new Set();
    let match;
    
    while ((match = chordRegex.exec(content)) !== null) {
        chords.add(match[1]);
    }
    
    return Array.from(chords).join(' ');
}

function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function cleanEditorContent(html) {
    if (!html) return '';
    
    // Удаляем лишние пробелы и переносы
    return html
        .replace(/\s+/g, ' ')
        .replace(/<div><br><\/div>/gi, '')
        .replace(/<br>\s*<br>/gi, '<br>')
        .trim();
}

// Добавляем стили для медиа-редактора
const addMediaEditorStyles = () => {
    if (document.getElementById('media-editor-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'media-editor-styles';
    styles.textContent = `
        .media-upload-options {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .upload-option {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .upload-option input[type="radio"] {
            margin: 0;
        }
        
        .upload-section {
            margin-bottom: 15px;
        }
        
        .url-input {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }
        
        .media-preview-small {
            margin-top: 10px;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: #f9f9f9;
            min-height: 50px;
        }
        
        .media-preview-small img {
            max-width: 100%;
            max-height: 150px;
            border-radius: 4px;
        }
        
        .file-info {
            margin-top: 10px;
            padding: 8px;
            background: #e9ecef;
            border-radius: 4px;
            font-size: 13px;
            color: #666;
        }
        
        .editor-media {
            margin: 15px 0;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .editor-image {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .editor-video video,
        .editor-audio audio {
            max-width: 100%;
            border-radius: 8px;
        }
        
        .editor-youtube {
            position: relative;
            padding-bottom: 56.25%;
            height: 0;
            overflow: hidden;
            max-width: 100%;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .editor-youtube iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
            border-radius: 8px;
        }
        
        .video-preview,
        .audio-preview {
            padding: 10px;
            background: #f0f0f0;
            border-radius: 4px;
            font-size: 13px;
            color: #666;
        }
        
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }
        
        .modal-content {
            background: white;
            border-radius: 12px;
            padding: 0;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid #eee;
        }
        
        .modal-header h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        }
        
        .modal-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background 0.2s;
        }
        
        .modal-close:hover {
            background: #f0f0f0;
        }
        
        .modal-body {
            padding: 24px;
        }
        
        /* Danger Zone Styles */
        .danger-zone {
            border: 2px solid #dc3545;
            background-color: #fff5f5;
            margin-top: 20px;
        }
        
        .danger-zone h3 {
            color: #dc3545;
            margin-top: 0;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid #f5c6cb;
        }
        
        .danger-content {
            padding: 15px;
        }
        
        .danger-warning {
            color: #721c24;
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 15px;
            font-size: 14px;
        }
        
        .btn-danger {
            background-color: #dc3545;
            border-color: #dc3545;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        
        .btn-danger:hover {
            background-color: #c82333;
            border-color: #bd2130;
        }
        
        .delete-status {
            margin-bottom: 15px;
        }
        
        .alert-warning {
            color: #856404;
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
        }
        
        .alert-warning h4 {
            color: #856404;
            margin-top: 0;
            margin-bottom: 10px;
        }
        
        .alert-warning p {
            margin-bottom: 8px;
        }
        
        .btn-secondary {
            background-color: #6c757d;
            border-color: #6c757d;
            color: white;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.3s ease;
        }
        
        .btn-secondary:hover {
            background-color: #5a6268;
            border-color: #545b62;
        }
    `;
    
    document.head.appendChild(styles);
};

// Вызываем стили при загрузке
addMediaEditorStyles();
