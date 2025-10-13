import emailjs from "@emailjs/browser"

// EmailJS настройки
const SERVICE_ID = "service_hcsxffy"
const TEMPLATE_ID = "template_8gmrnbu"
const PUBLIC_KEY = "DCJDcWp4UuFK8O6GQ"

// Инициализация EmailJS
emailjs.init(PUBLIC_KEY)

export const sendVerificationCode = async (email, code) => {
    const expireTime = new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString([], { 
        hour: "2-digit", 
        minute: "2-digit" 
    })

    try {
        await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
            passcode: code,
            time: expireTime,
            to_email: email
        }, PUBLIC_KEY)

        console.log("✅ Код отправлен:", code)
        return true
    } catch (err) {
        console.error("❌ Ошибка при отправке письма:", err)
        throw new Error("Не удалось отправить письмо. Проверь настройки EmailJS.")
    }
}