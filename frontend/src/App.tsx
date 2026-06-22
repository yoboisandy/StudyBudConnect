import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider } from "@/components/theme-provider"

import AppLayout from "@/components/layout/AppLayout"
import LoginPage from "@/pages/auth/LoginPage"
import RegisterPage from "@/pages/auth/RegisterPage"
import GoogleSuccessPage from "@/pages/auth/GoogleSuccessPage"
import ProfilePage from "@/pages/app/ProfilePage"
import DiscoverPage from "@/pages/app/DiscoverPage"
import MyGroupsPage from "@/pages/app/MyGroupsPage"
import CreateGroupPage from "@/pages/app/CreateGroupPage"
import ChatPage from "@/pages/app/ChatPage"

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="theme">
      <TooltipProvider>
        <BrowserRouter>
          <Routes>
            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/auth/google/success" element={<GoogleSuccessPage />} />

            {/* App (protected via AppLayout) */}
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Navigate to="/app/discover" replace />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="discover" element={<DiscoverPage />} />
              <Route path="groups" element={<MyGroupsPage />} />
              <Route path="groups/create" element={<CreateGroupPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="chat/:groupId" element={<ChatPage />} />
            </Route>

            {/* Fallback */}
            <Route path="/" element={<Navigate to="/app/discover" replace />} />
            <Route path="*" element={<Navigate to="/app/discover" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors closeButton />
      </TooltipProvider>
    </ThemeProvider>
  )
}
