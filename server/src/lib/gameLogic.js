export function pickRandomQuestion(questions) {
  const unused = questions.filter(q => !q.used)
  if (unused.length === 0) return null
  const randomIndex = Math.floor(Math.random() * unused.length)
  return unused[randomIndex]
}

export function isPoolExhausted(questions) {
  if (questions.length === 0) return true
  return questions.every(q => q.used)
}

export function advanceTurn(currentTurnIndex) {
  return currentTurnIndex + 1
}

export function getNextHost(currentHostToken, players) {
  if (players.length <= 1) return null
  const currentIndex = players.findIndex(p => p.sessionToken === currentHostToken)
  if (currentIndex === -1) return players[0].sessionToken
  const nextIndex = (currentIndex + 1) % players.length
  return players[nextIndex].sessionToken
}
