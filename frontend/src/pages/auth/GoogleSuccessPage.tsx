import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"
import { Loader2 } from "lucide-react"

export default function GoogleSuccessPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { fetchMe, setAuth } = useAuthStore()

  useEffect(() => {
    const token = params.get("token")
    if (!token) { navigate("/login?error=oauth"); return }
    localStorage.setItem("sbc_token", token)
    fetchMe().then(() => {
      const { user } = useAuthStore.getState()
      if (user) {
        setAuth(user, token)
        navigate(user.profileComplete ? "/app/discover" : "/app/profile")
      } else {
        navigate("/login?error=oauth")
      }
    })
  }, [])

  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        <p className="text-muted-foreground text-sm">Completing sign in…</p>
      </div>
    </div>
  )
}
