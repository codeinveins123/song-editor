import './styles/main.css'
import { setCurrentUser, getCurrentUser } from './modules/state.js'
import { setupNavListeners } from './modules/navigation.js'
import { showWelcomePage, showSuccessPage } from './modules/pages.js'
import { setupAuthForms } from './modules/auth.js'

document.addEventListener('DOMContentLoaded', function() {
    checkAuth()
    setupNavListeners()
    setupAuthForms()
})

function checkAuth() {
    const savedUser = localStorage.getItem('currentUser')
    const token = localStorage.getItem('token')
    
    if (savedUser && token) {
        const user = JSON.parse(savedUser)
        user.token = token
        setCurrentUser(user)
        showSuccessPage()
    } else {
        showWelcomePage()
    }
}