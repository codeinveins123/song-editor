
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';


// Общая функция для API запросов
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    ...options,
  };

  if (config.body) {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Ошибка сервера');
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Auth API
export const authAPI = {
  register: (userData) => apiRequest('/auth/register', { 
    method: 'POST', 
    body: userData 
  }),
  
  verifyEmail: (email, code, userData) => apiRequest('/auth/verify-email', {
    method: 'POST',
    body: { email, code, userData }
  }),
  
  login: (email, password) => apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password }
  }),
  
  googleAuth: (userData) => apiRequest('/auth/google', {
    method: 'POST',
    body: userData
  }),
  
  getProfile: () => apiRequest('/auth/profile'),
};

// Songs API
export const songsAPI = {
  create: (songData) => apiRequest('/songs', {
    method: 'POST',
    body: songData
  }),
  
  getAll: () => apiRequest('/songs'),
  
  getMySongs: () => apiRequest('/songs/my'),
  
  getById: (id) => apiRequest(`/songs/${id}`),
  
  update: (id, songData) => apiRequest(`/songs/${id}`, {
    method: 'PUT',
    body: songData
  }),
  
  delete: (id) => apiRequest(`/songs/${id}`, {
    method: 'DELETE'
  }),
};

// Profile API
export const profileAPI = {
  changePassword: (data) => apiRequest('/auth/change-password', {
    method: 'PUT',
    body: data
  }),
  
  updateProfile: (data) => apiRequest('/auth/profile', {
    method: 'PUT', 
    body: data
  }),
  
  updateAvatar: (avatarUrl) => apiRequest('/auth/avatar', {
    method: 'PUT',
    body: { avatarUrl }
  }),
  
  getStats: () => apiRequest('/auth/stats')
};

// Смена пароля
export const changePassword = async (currentPassword, newPassword) => {
  try {
    const response = await profileAPI.changePassword({
      currentPassword,
      newPassword
    });
    return response;
  } catch (error) {
    throw error;
  }
};

// Обновление профиля
export const updateProfile = async (profileData) => {
  try {
    const response = await profileAPI.updateProfile(profileData);
    return response;
  } catch (error) {
    throw error;
  }
};

// Обновление аватара
export const updateAvatar = async (avatarUrl) => {
  try {
    const response = await profileAPI.updateAvatar(avatarUrl);
    return response;
  } catch (error) {
    throw error;
  }
};

// Получение статистики
export const getStats = async () => {
  try {
    const response = await profileAPI.getStats();
    return response;
  } catch (error) {
    throw error;
  }
};

