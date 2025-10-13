const API_BASE_URL = 'http://localhost:3001/api';

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
  
  login: (email, password) => apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password }
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
};