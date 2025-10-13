// Состояние приложения
export let currentUser = null
export let pendingUser = null // временно хранит незарегистрированного юзера (до подтверждения кода)
export let verificationCode = null

export const setCurrentUser = (user) => {
    currentUser = user
}

export const setPendingUser = (user) => {
    pendingUser = user
}

export const setVerificationCode = (code) => {
    verificationCode = code
}

export const clearAuthState = () => {
    currentUser = null
    pendingUser = null
    verificationCode = null
}

