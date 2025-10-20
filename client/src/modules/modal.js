// modal.js - Утилиты для модальных окон
export const showModal = (title, message, type = 'info') => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
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
                <button class="btn btn-primary modal-confirm">OK</button>
            </div>
        </div>
    `;

    const closeModal = () => {
        document.body.removeChild(modal);
    };

    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('.modal-confirm').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    document.body.appendChild(modal);

    // Автозакрытие для info сообщений через 3 секунды
    if (type === 'info') {
        setTimeout(closeModal, 3000);
    }

    return closeModal;
};

export const showConfirmModal = (title, message) => {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content modal-confirm">
                <div class="modal-header">
                    <h3>${title}</h3>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-cancel">Отмена</button>
                    <button class="btn btn-primary modal-confirm">OK</button>
                </div>
            </div>
        `;

        const closeModal = () => {
            document.body.removeChild(modal);
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

        document.body.appendChild(modal);
    });
};

export const showPromptModal = (title, placeholder = '', defaultValue = '', options = {}) => {
    return new Promise((resolve) => {
        const { type = 'text', description = '' } = options;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
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
        const closeModal = () => document.body.removeChild(modal);

        const confirm = () => {
            const value = input.value.trim();
            closeModal();
            resolve(value);
        };

        modal.querySelector('.modal-cancel').addEventListener('click', () => {
            closeModal();
            resolve(null);
        });

        modal.querySelector('.modal-confirm').addEventListener('click', confirm);
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') confirm();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
                resolve(null);
            }
        });

        document.body.appendChild(modal);
        input.focus();
        input.select();
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