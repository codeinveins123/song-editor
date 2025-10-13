import './styles/main.css'
import { currentUser, setCurrentUser } from './modules/state.js'
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
    if (savedUser) {
        const user = JSON.parse(savedUser)
        setCurrentUser(user)
        showSuccessPage()
    } else {
        showWelcomePage()
    }
}