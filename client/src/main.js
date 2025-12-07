import './styles/main.css'
import { currentUser, setCurrentUser } from './modules/state.js'
import { setupNavListeners, updateNavigation } from './modules/navigation.js'
import { showWelcomePage, showSuccessPage } from './modules/pages.js'
import { setupAuthForms } from './modules/auth.js'
import { showModal } from './modules/modal.js'

// Make updateNavigation globally available
window.updateNavigation = updateNavigation;

document.addEventListener('DOMContentLoaded', function() {
    checkAuth()
    setupNavListeners()
    setupAuthForms()
    updateNavigation() // Initial navigation setup
})

async function checkAuth() {
    const savedUser = localStorage.getItem('currentUser')
    const token = localStorage.getItem('token')
    
    console.log('🔍 Проверка аутентификации...', { 
        hasUser: !!savedUser, 
        hasToken: !!token,
        savedUser: savedUser ? JSON.parse(savedUser) : null
    })
    
    if (savedUser && token) {
        try {
            // Проверяем токен на сервере и получаем актуальные данные пользователя
            console.log('🔄 Проверка токена на сервере...')
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://song-editor.onrender.com/api';
            const response = await fetch(`${API_BASE_URL}/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            
            console.log('📡 Ответ сервера:', response.status, response.statusText)
            
            if (response.ok) {
                const data = await response.json()
                console.log('📄 Данные от сервера:', data)
                
                if (data.user && data.user.deleted_at) {
                    // Аккаунт удален - устанавливаем пользователя с флагом is_deleted
                    console.log('⚠️ Аккаунт удален, устанавливаем флаг is_deleted')
                    setCurrentUser({
                        ...data.user,
                        is_deleted: true,
                        token: token
                    })
                    // Обновляем навигацию и показываем страницу
                    updateNavigation();
                    showWelcomePage()
                    return;
                } else {
                    console.log('✅ Токен валиден, пользователь найден:', data.user)
                    setCurrentUser({
                        ...data.user,
                        token: token
                    })
                    // Обновляем навигацию после входа
                    updateNavigation();
                    // Всегда показываем главную страницу как лэндинг
                    showWelcomePage()
                }
            } else {
                console.log('❌ Токен невалидный, очистка...')
                const errorText = await response.text()
                console.log('📄 Ошибка сервера:', errorText)
                // Токен невалидный, очищаем
                setCurrentUser(null)
                updateNavigation();
                showWelcomePage()
            }
        } catch (error) {
            console.error('❌ Ошибка проверки токена:', error)
            setCurrentUser(null)
            updateNavigation();
            showWelcomePage()
        }
    } else {
        console.log('🔐 Пользователь не аутентифицирован')
        setCurrentUser(null)
        updateNavigation();
        showWelcomePage()
    }
}

// Функция показа модального окна для удаленного аккаунта
async function showDeletedAccountModal(user) {
    // Проверяем, нет ли уже открытого модального окна
    if (document.querySelector('.forceful-modal-backdrop')) {
        console.log('Модальное окно уже открыто, пропускаем');
        return;
    }
    
    // Ждем, если DOM еще не готов
    if (document.readyState !== 'complete') {
        document.addEventListener('DOMContentLoaded', () => {
            showDeletedAccountModal(user);
        });
        return;
    }
    
    const deletedDate = user.deleted_at ? 
        new Date(user.deleted_at).toLocaleDateString('ru-RU', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }) : 'Неизвестная дата';
    
    const deletedAtDate = new Date(user.deleted_at);
    const daysLeft = !isNaN(deletedAtDate.getTime()) ? 
        Math.ceil((deletedAtDate - new Date()) / (1000 * 60 * 60 * 24)) : 0;
    
    const modalContent = `
        <div class="deleted-account-modal">
            <div class="deleted-account-icon">⚠️</div>
            <h3 class="deleted-account-title">Аккаунт удален</h3>
            
            <div class="deleted-account-info">
                <div class="info-item">
                    <span class="info-label">Дата полного удаления:</span>
                    <span class="info-value">${deletedDate}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Осталось дней:</span>
                    <span class="info-value days-left">${daysLeft}</span>
                </div>
            </div>
            
            <p class="deleted-account-message">
                Вы можете восстановить аккаунт в любой момент до даты удаления. После этого все данные будут удалены безвозвратно.
            </p>
            
            <div class="deleted-account-actions">
                <button id="restore-account" class="btn btn-primary">
                    🔄 Восстановить аккаунт
                </button>
                <button id="logout-deleted" class="btn btn-secondary">
                    🚪 Выйти
                </button>
            </div>
        </div>
    `;
    
    // Добавляем стили для модального окна
    const style = document.createElement('style');
    style.textContent = `
        .deleted-account-modal {
            text-align: center;
            padding: 20px;
            max-width: 400px;
        }
        .deleted-account-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        .deleted-account-title {
            color: #e74c3c;
            margin-bottom: 20px;
            font-size: 24px;
        }
        .deleted-account-info {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
        }
        .info-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }
        .info-item:last-child {
            margin-bottom: 0;
        }
        .info-label {
            color: #666;
            font-weight: 500;
        }
        .info-value {
            font-weight: bold;
        }
        .days-left {
            color: #e74c3c;
        }
        .deleted-account-message {
            color: #666;
            margin-bottom: 25px;
            line-height: 1.5;
        }
        .deleted-account-actions {
            display: flex;
            gap: 10px;
            justify-content: center;
        }
    `;
    document.head.appendChild(style);
    
    // Показываем принудительное модальное окно
    showForcefulModal('Восстановление аккаунта', modalContent);
}

// Принудительное модальное окно (нельзя закрыть)
function showForcefulModal(title, content) {
    // Создаем затемнение фона
    const backdrop = document.createElement('div');
    backdrop.className = 'forceful-modal-backdrop';
    backdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 0;
        max-width: 450px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: modalSlideIn 0.3s ease-out;
    `;
    
    modal.innerHTML = `
        <div style="background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; padding: 20px; border-radius: 12px 12px 0 0;">
            <h2 style="margin: 0; font-size: 24px; text-align: center;">${title}</h2>
        </div>
        ${content}
    `;
    
    // Добавляем анимацию
    const style = document.createElement('style');
    style.textContent = `
        @keyframes modalSlideIn {
            from {
                opacity: 0;
                transform: translateY(-50px) scale(0.9);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        }
    `;
    document.head.appendChild(style);
    
    // Предотвращаем закрытие по клику на фон
    backdrop.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
    });
    
    // Предотвращаем закрытие по ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
        }
    });
    
    backdrop.appendChild(modal);
    
    // Принудительно добавляем в body с максимальным приоритетом
    if (document.body) {
        document.body.appendChild(backdrop);
        document.body.style.overflow = 'hidden'; // Блокируем прокрутку страницы
    } else {
        // Если body еще не готов, ждем и добавляем
        setTimeout(() => {
            if (document.body) {
                document.body.appendChild(backdrop);
                document.body.style.overflow = 'hidden';
            }
        }, 0);
    }
    
    // Добавляем обработчики событий с небольшой задержкой для гарантии наличия в DOM
    setTimeout(() => {
        const restoreBtn = document.getElementById('restore-account');
        const logoutBtn = document.getElementById('logout-deleted');
        
        console.log('🔍 Поиск кнопок:', { restoreBtn: !!restoreBtn, logoutBtn: !!logoutBtn });
        
        if (restoreBtn) {
            // Удаляем старые обработчики если есть
            restoreBtn.replaceWith(restoreBtn.cloneNode(true));
            const newRestoreBtn = document.getElementById('restore-account');
            newRestoreBtn.addEventListener('click', async () => {
                console.log('🔄 Клик на "Восстановить аккаунт"');
                await restoreAccount();
            });
            console.log('✅ Обработчик для "Восстановить" добавлен');
        } else {
            console.error('❌ Кнопка "Восстановить" не найдена');
        }
        
        if (logoutBtn) {
            // Удаляем старые обработчики если есть
            logoutBtn.replaceWith(logoutBtn.cloneNode(true));
            const newLogoutBtn = document.getElementById('logout-deleted');
            newLogoutBtn.addEventListener('click', () => {
                console.log('🚪 Клик на "Выйти"');
                setCurrentUser(null);
                localStorage.removeItem('token');
                // Закрываем модальное окно
                const backdrop = document.querySelector('.forceful-modal-backdrop');
                if (backdrop) {
                    backdrop.remove();
                    document.body.style.overflow = '';
                }
                // Обновляем навигацию без перезагрузки
                updateNavigation();
                showWelcomePage();
            });
            console.log('✅ Обработчик для "Выйти" добавлен');
        } else {
            console.error('❌ Кнопка "Выйти" не найдена');
        }
    }, 50);
}

// Функция восстановления аккаунта
async function restoreAccount() {
    try {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://song-editor.onrender.com/api';
        const token = localStorage.getItem('token');
        
        const response = await fetch(`${API_BASE_URL}/auth/profile/cancel-delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Закрываем принудительное модальное окно
            const backdrop = document.querySelector('.forceful-modal-backdrop');
            if (backdrop) {
                backdrop.remove();
                document.body.style.overflow = ''; // Возвращаем прокрутку
            }
            
            // Показываем успешное сообщение
            const successModal = document.createElement('div');
            successModal.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #28a745;
                color: white;
                padding: 20px 30px;
                border-radius: 8px;
                z-index: 10000;
                font-weight: bold;
                animation: fadeInOut 2s ease-in-out;
            `;
            successModal.textContent = '✅ Аккаунт успешно восстановлен!';
            document.body.appendChild(successModal);
            
            // Удаляем через 2 секунды и обновляем данные пользователя
            setTimeout(() => {
                successModal.remove();
                // Обновляем данные пользователя без перезагрузки страницы
                checkAuth().then(() => {
                    // Если пользователь на странице профиля, обновляем ее
                    if (document.querySelector('.profile-section')) {
                        import('./modules/pages.js').then(pages => {
                            pages.showSuccessPage();
                        });
                    }
                    // Обновляем навигацию
                    updateNavigation();
                });
            }, 2000);
        } else {
            const error = await response.json();
            showModal('Ошибка', error.error || 'Не удалось восстановить аккаунт', 'error');
        }
    } catch (error) {
        console.error('Ошибка восстановления аккаунта:', error);
        showModal('Ошибка', 'Произошла ошибка при восстановлении аккаунта', 'error');
    }
}

// Экспортируем функции для использования в других модулях
export { showDeletedAccountModal, restoreAccount, showForcefulModal };