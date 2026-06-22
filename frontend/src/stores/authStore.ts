import { create } from "zustand"
import { persist } from "zustand/middleware"
import api from "@/lib/api"

interface User {
  _id: string
  name?: string
  email: string
  avatar?: string
  profileComplete?: boolean
  courses?: string[]
  learningStyle?: string
  availability?: { day: string; slots: string[] }[]
  accessibilityNeeds?: string[]
  communicationPrefs?: string[]
}

interface AuthState {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  setUser: (user: User) => void
  logout: () => void
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        localStorage.setItem("sbc_token", token)
        set({ user, token })
      },
      setUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem("sbc_token")
        set({ user: null, token: null })
      },
      fetchMe: async () => {
        try {
          const { data } = await api.get("/auth/me")
          set({ user: data })
        } catch {
          set({ user: null, token: null })
          localStorage.removeItem("sbc_token")
        }
      },
    }),
    {
      name: "sbc-auth",
      partialize: (s) => ({ token: s.token, user: s.user }),
    }
  )
)
