import { setupRoomHandlers } from './roomHandlers.js'
import { setupGameHandlers } from './gameHandlers.js'

export function registerHandlers(io) {
  io.on('connection', (socket) => {
    setupRoomHandlers(io, socket)
    setupGameHandlers(io, socket)
  })
}
