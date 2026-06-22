import { create } from "zustand"
import api from "@/lib/api"

export interface AppNotification {
  _id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  read: boolean
  createdAt: string
}

interface NotificationState {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  fetch: () => Promise<void>
  add: (n: AppNotification) => void
  markRead: (id: string) => void
  markAllRead: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  fetch: async () => {
    set({ loading: true })
    try {
      const { data } = await api.get("/notifications")
      set({
        notifications: data,
        unreadCount: data.filter((n: AppNotification) => !n.read).length,
      })
    } finally {
      set({ loading: false })
    }
  },

  add: (n) => {
    set((s) => ({
      notifications: [n, ...s.notifications],
      unreadCount: s.unreadCount + (n.read ? 0 : 1),
    }))
  },

  markRead: async (id) => {
    const notif = get().notifications.find((n) => n._id === id)
    if (!notif || notif.read) return
    try {
      await api.put(`/notifications/${id}/read`)
      set((s) => ({
        notifications: s.notifications.map((n) => n._id === id ? { ...n, read: true } : n),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }))
    } catch { /* silent */ }
  },

  markAllRead: async () => {
    try {
      await api.put("/notifications/read-all")
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }))
    } catch { /* silent */ }
  },
}))
