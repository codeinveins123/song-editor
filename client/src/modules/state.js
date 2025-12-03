// Состояние приложения
let _currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

// Создаем реактивный объект для текущего пользователя
export const currentUser = new Proxy({}, {
  get(target, prop) {
    if (prop === 'value') {
      return _currentUser;
    }
    if (prop === 'isAdmin') {
      return _currentUser?.is_admin === true;
    }
    return _currentUser?.[prop];
  }
});

export const setCurrentUser = (user) => {
  _currentUser = user;
  if (user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
    if (user.token) {
      localStorage.setItem('token', user.token);
    }
  } else {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
  }
  // Вызываем обновление навигации
  if (typeof window.updateNavigation === 'function') {
    window.updateNavigation();
  }
  return _currentUser;
};

export const getCurrentUser = () => {
  return _currentUser;
};

export const clearAuthState = () => {
  _currentUser = null;
  localStorage.removeItem('currentUser');
  localStorage.removeItem('token');
  if (typeof window.updateNavigation === 'function') {
    window.updateNavigation();
  }
};

export const getToken = () => {
  return _currentUser?.token || localStorage.getItem('token');
};