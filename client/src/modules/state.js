// Состояние приложения
export let currentUser = null

export const setCurrentUser = (user) => {
    currentUser = user
    if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user))
        localStorage.setItem('token', user.token)
    } else {
        localStorage.removeItem('currentUser')
        localStorage.removeItem('token')
    }
}

export const getCurrentUser = () => {
    return currentUser
}

export const clearAuthState = () => {
    currentUser = null
    localStorage.removeItem('currentUser')
    localStorage.removeItem('token')
}