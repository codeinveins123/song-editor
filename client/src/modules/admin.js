import { adminAPI } from './api.js';
import { showModal, showConfirmModal } from './modal.js';
import { currentUser } from './state.js';

// Показываем админ-панель
export async function showAdminPanel() {
  // Проверяем, является ли пользователь администратором
  if (!currentUser.value?.is_admin) {
    showModal('Доступ запрещен', 'У вас нет прав доступа к админ-панели.');
    return;
  }

  // Создаем контейнер админ-панели
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="admin-container">
      <h1>Админ-панель</h1>
      
      <div class="admin-tabs">
        <button class="tab-btn active" data-tab="songs">Песни</button>
        <button class="tab-btn" data-tab="users">Пользователи</button>
      </div>
      
      <div id="admin-content">
        <!-- Контент будет загружен при переключении вкладок -->
        <p>Загрузка...</p>
      </div>
    </div>
  `;

  // Добавляем стили
  addAdminStyles();
  
  // Загружаем первую вкладку
  loadTab('songs');
  
  // Настраиваем переключение вкладок
  setupTabSwitcher();
}

// Настройка переключения вкладок
function setupTabSwitcher() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Обновляем активную кнопку
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      
      // Загружаем контент выбранной вкладки
      const tabName = button.dataset.tab;
      loadTab(tabName);
    });
  });
}

// Загрузка контента вкладки
async function loadTab(tabName) {
  const contentDiv = document.getElementById('admin-content');
  contentDiv.innerHTML = '<p>Загрузка...</p>';
  
  try {
    if (tabName === 'songs') {
      await loadSongsTab();
    } else if (tabName === 'users') {
      await loadUsersTab();
    }
  } catch (error) {
    console.error('Ошибка загрузки вкладки:', error);
    contentDiv.innerHTML = `
      <div class="error-message">
        Произошла ошибка при загрузке данных. Пожалуйста, попробуйте обновить страницу.
      </div>
    `;
  }
}

// Загрузка вкладки с песнями
async function loadSongsTab() {
  const contentDiv = document.getElementById('admin-content');
  
  try {
    const songs = await adminAPI.getAllSongs();
    
    if (!songs || songs.length === 0) {
      contentDiv.innerHTML = '<p>Песни не найдены</p>';
      return;
    }
    
    let html = `
      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Название</th>
              <th>Исполнитель</th>
              <th>Автор</th>
              <th>Дата</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    songs.forEach(song => {
      const date = new Date(song.created_at).toLocaleDateString();
      const status = song.is_verified ? '✅ Проверена' : '❌ Не проверена';
      const blockedStatus = song.author_blocked ? '🔒 Автор заблокирован' : '';
      
      html += `
        <tr>
          <td>${song.id}</td>
          <td>${escapeHtml(song.title)}</td>
          <td>${escapeHtml(song.artist)}</td>
          <td>${song.author_username || 'Неизвестен'}</td>
          <td>${date}</td>
          <td>${status} ${blockedStatus}</td>
          <td class="actions">
            <button class="btn btn-sm ${song.is_verified ? 'btn-warning' : 'btn-success'}" 
                    onclick="admin.toggleSongVerification(${song.id}, ${!song.is_verified})">
              ${song.is_verified ? 'Снять проверку' : 'Подтвердить'}
            </button>
            <button class="btn btn-sm btn-danger" 
                    onclick="admin.deleteSong(${song.id})">
              Удалить
            </button>
            <a href="/#/song/${song.id}" class="btn btn-sm btn-info" target="_blank">
              Просмотр
            </a>
          </td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    
    contentDiv.innerHTML = html;
  } catch (error) {
    console.error('Ошибка загрузки песен:', error);
    contentDiv.innerHTML = `
      <div class="error-message">
        Ошибка при загрузке списка песен. Пожалуйста, попробуйте позже.
      </div>
    `;
  }
}

// Загрузка вкладки с пользователями
async function loadUsersTab() {
  const contentDiv = document.getElementById('admin-content');
  
  try {
    const users = await adminAPI.getUsers();
    
    if (!users || users.length === 0) {
      contentDiv.innerHTML = '<p>Пользователи не найдены</p>';
      return;
    }
    
    let html = `
      <div class="admin-table-container">
        <table class="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Имя пользователя</th>
              <th>Email</th>
              <th>Дата регистрации</th>
              <th>Роль</th>
              <th>Блокировка</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    users.forEach(user => {
      const date = new Date(user.created_at).toLocaleDateString();
      const role = user.is_admin ? '👑 Администратор' : '👤 Пользователь';
      const blockStatus = user.is_blocked ? '🔒 Заблокирован' : '✅ Активен';
      
      html += `
        <tr>
          <td>${user.id}</td>
          <td>${escapeHtml(user.username)}</td>
          <td>${escapeHtml(user.email)}</td>
          <td>${date}</td>
          <td>${role}</td>
          <td>${blockStatus}</td>
          <td class="actions">
            ${!user.is_admin && parseInt(user.id) !== parseInt(currentUser.value?.id) ? `
              <button class="btn btn-sm ${user.is_blocked ? 'btn-success' : 'btn-warning'}" 
                      onclick="admin.toggleUserBlock(${user.id}, ${!user.is_blocked})">
                ${user.is_blocked ? 'Разблокировать' : 'Заблокировать'}
              </button>
            ` : '<span class="text-muted">-</span>'}
          </td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    
    contentDiv.innerHTML = html;
  } catch (error) {
    console.error('Ошибка загрузки пользователей:', error);
    contentDiv.innerHTML = `
      <div class="error-message">
        Ошибка при загрузке списка пользователей. Пожалуйста, попробуйте позже.
      </div>
    `;
  }
}

// Добавление стилей для админ-панели
function addAdminStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .admin-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .admin-tabs {
      display: flex;
      margin-bottom: 20px;
      border-bottom: 1px solid #ddd;
    }
    
    .tab-btn {
      padding: 10px 20px;
      background: none;
      border: none;
      border-bottom: 3px solid transparent;
      cursor: pointer;
      font-size: 16px;
      color: #666;
      transition: all 0.3s;
    }
    
    .tab-btn:hover {
      color: #333;
    }
    
    .tab-btn.active {
      color: #007bff;
      border-bottom-color: #007bff;
      font-weight: 600;
    }
    
    .admin-table-container {
      overflow-x: auto;
      margin-top: 20px;
    }
    
    .admin-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      font-size: 14px;
    }
    
    .admin-table th,
    .admin-table td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }
    
    .admin-table th {
      background-color: #f8f9fa;
      font-weight: 600;
      color: #495057;
    }
    
    .admin-table tr:hover {
      background-color: #f8f9fa;
    }
    
    .admin-table .actions {
      white-space: nowrap;
    }
    
    .admin-table .btn {
      margin: 0 2px;
      padding: 4px 8px;
      font-size: 12px;
    }
    
    .error-message {
      color: #dc3545;
      padding: 15px;
      background-color: #f8d7da;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
      margin-top: 15px;
    }
    
    .success-message {
      color: #155724;
      padding: 15px;
      background-color: #d4edda;
      border: 1px solid #c3e6cb;
      border-radius: 4px;
      margin-bottom: 15px;
    }
    
    .text-muted {
      color: #6c757d;
    }
    
    /* Verified badges for songs list and song view */
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
  
  document.head.appendChild(style);
}

// Экранирование HTML для безопасности
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Глобальный объект для вызова из HTML
window.admin = {
  // Переключение проверки песни
  toggleSongVerification: async (songId, verify) => {
    try {
      await adminAPI.verifySong(songId, verify);
      showSuccessMessage(`Песня успешно ${verify ? 'подтверждена' : 'снята с проверки'}`);
      loadTab('songs');
    } catch (error) {
      console.error('Ошибка обновления статуса песни:', error);
      showModal('Ошибка', 'Не удалось обновить статус песни. Пожалуйста, попробуйте снова.');
    }
  },
  
  // Удаление песни
  deleteSong: async (songId) => {
    const confirmed = await showConfirmModal('Удаление песни', 'Вы уверены, что хотите удалить эту песню? Это действие нельзя отменить.');
    if (!confirmed) {
      return;
    }
    
    try {
      await adminAPI.deleteSong(songId);
      showSuccessMessage('Песня успешно удалена');
      loadTab('songs');
    } catch (error) {
      console.error('Ошибка удаления песни:', error);
      showModal('Ошибка', 'Не удалось удалить песню. Пожалуйста, попробуйте снова.');
    }
  },
  
  // Блокировка/разблокировка пользователя
  toggleUserBlock: async (userId, block) => {
    const action = block ? 'заблокировать' : 'разблокировать';
    const confirmed = await showConfirmModal(`${action} пользователя`, `Вы уверены, что хотите ${action} этого пользователя?`);
    if (!confirmed) {
      return;
    }
    
    try {
      await adminAPI.blockUser(userId, block);
      showSuccessMessage(`Пользователь успешно ${block ? 'заблокирован' : 'разблокирован'}`);
      loadTab('users');
    } catch (error) {
      console.error('Ошибка изменения статуса блокировки пользователя:', error);
      showModal('Ошибка', 'Не удалось изменить статус блокировки пользователя. Пожалуйста, попробуйте снова.');
    }
  }
};

// Вспомогательная функция для отображения сообщения об успехе
function showSuccessMessage(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'success-message';
  messageDiv.textContent = message;
  
  const contentDiv = document.getElementById('admin-content');
  contentDiv.insertBefore(messageDiv, contentDiv.firstChild);
  
  // Автоматически скрыть сообщение через 5 секунд
  setTimeout(() => {
    messageDiv.remove();
  }, 5000);
}
