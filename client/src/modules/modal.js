// modal.js - Утилиты для модальных окон
export const showModal = (title, message, type = 'info') => {
    // Удаляем существующие модальные окна
    const existingModals = document.querySelectorAll('.modal-overlay');
    existingModals.forEach(modal => {
        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    });

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content modal-${type}">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <p>${message}</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary modal-confirm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  OK
                </button>
            </div>
        </div>
    `;

    const closeModal = () => {
        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    };

    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-confirm').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Добавляем в body
    document.body.appendChild(modal);
    
    // Фокус на модальное окно
    modal.querySelector('.modal-confirm').focus();

    // Автозакрытие для info сообщений через 3 секунды
    if (type === 'info') {
        setTimeout(closeModal, 3000);
    }

    return closeModal;
};

export const showConfirmModal = (title, message) => {
    return new Promise((resolve) => {
        // Удаляем существующие модальные окна
        const existingModals = document.querySelectorAll('.modal-overlay');
        existingModals.forEach(modal => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        });

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content modal-confirm">
                <div class="modal-header">
                    <h3>${title}</h3>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-cancel">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      Отмена
                    </button>
                    <button class="btn btn-primary modal-confirm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="margin-right:6px"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      OK
                    </button>
                </div>
            </div>
        `;

        const closeModal = () => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        };

        modal.querySelector('.modal-cancel').addEventListener('click', () => {
            closeModal();
            resolve(false);
        });

        modal.querySelector('.modal-confirm').addEventListener('click', () => {
            closeModal();
            resolve(true);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
                resolve(false);
            }
        });

        // Добавляем в body
        document.body.appendChild(modal);
        
        // Фокус на кнопку подтверждения
        modal.querySelector('.modal-confirm').focus();
    });
};

export const showPromptModal = (title, placeholder = '', defaultValue = '', options = {}) => {
    return new Promise((resolve) => {
        const { type = 'text', description = '' } = options;
        
        // Удаляем существующие модальные окна
        const existingModals = document.querySelectorAll('.modal-overlay');
        existingModals.forEach(modal => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        });
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content modal-prompt large-modal">
                <div class="modal-header">
                    <h3>${title}</h3>
                </div>
                <div class="modal-body">
                    ${description ? `<p class="modal-description">${description}</p>` : ''}
                    <input type="${type}" 
                           class="modal-input" 
                           placeholder="${placeholder}"
                           value="${defaultValue}"
                           ${type === 'password' ? 'autocomplete="new-password"' : ''}>
                    ${type === 'password' ? '<div class="password-requirements">Минимальная длина: 6 символов</div>' : ''}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-cancel">Отмена</button>
                    <button class="btn btn-primary modal-confirm">OK</button>
                </div>
            </div>
        `;

        const input = modal.querySelector('.modal-input');
        const closeModal = () => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        };

        modal.querySelector('.modal-cancel').addEventListener('click', () => {
            closeModal();
            resolve(null);
        });

        modal.querySelector('.modal-confirm').addEventListener('click', () => {
            closeModal();
            resolve(input.value);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
                resolve(null);
            }
        });

        // Добавляем в body
        document.body.appendChild(modal);
        
        // Фокус на input
        input.focus();
        input.select();
        
        // Enter для подтверждения
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                closeModal();
                resolve(input.value);
            } else if (e.key === 'Escape') {
                closeModal();
                resolve(null);
            }
        });
    });
};

// Специализированные функции для паролей
export const showPasswordPrompt = (title, description = '') => {
    return showPromptModal(title, 'Введите пароль', '', {
        type: 'password',
        description: description
    });
};

export const showCurrentPasswordPrompt = () => {
    return showPasswordPrompt('Текущий пароль', 'Введите ваш текущий пароль для подтверждения');
};

export const showNewPasswordPrompt = () => {
    return showPasswordPrompt('Новый пароль', 'Введите новый пароль (минимум 6 символов)');
};

export const showConfirmPasswordPrompt = () => {
    return showPasswordPrompt('Подтверждение пароля', 'Повторите новый пароль для подтверждения');
};