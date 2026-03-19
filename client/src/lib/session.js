export function getSessionToken() {
  let token = localStorage.getItem('sessionToken')
  if (!token) {
    try {
      token = crypto.randomUUID()
    } catch (err) {
      token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    }
    localStorage.setItem('sessionToken', token)
  }
  return token
}

export function clearSession() {
  localStorage.removeItem('sessionToken')
}
