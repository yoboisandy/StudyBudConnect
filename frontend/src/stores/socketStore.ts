import { create } from "zustand"
import { io, Socket } from "socket.io-client"

interface SocketState {
  socket: Socket | null
  onlineUsers: string[]
  connect: (token: string) => void
  disconnect: () => void
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  onlineUsers: [],
  connect: (token) => {
    if (get().socket?.connected) return
    const socket = io({ auth: { token }, transports: ["websocket"] })
    socket.on("online_users", (users: string[]) => set({ onlineUsers: users }))
    set({ socket })
  },
  disconnect: () => {
    get().socket?.disconnect()
    set({ socket: null, onlineUsers: [] })
  },
}))
