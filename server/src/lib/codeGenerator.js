const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
export function generateCode() {
  return Array.from({ length: 6 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('')
}
