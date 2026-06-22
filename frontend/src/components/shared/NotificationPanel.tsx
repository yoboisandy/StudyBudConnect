import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Bell, Users, UserCheck, UserX, ShieldOff, MailOpen,
  CheckCheck, Loader2, Check, X,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useNotificationStore, type AppNotification } from "@/stores/notificationStore"
import api from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// ─── Icon per notification type ───────────────────────────────────────────────

function NotifIcon({ type }: { type: string }) {
  const cls = "h-4 w-4 shrink-0 mt-0.5"
  switch (type) {
    case "group_invite":       return <MailOpen className={cn(cls, "text-primary")} />
    case "join_request":       return <Users className={cn(cls, "text-amber-500")} />
    case "invite_accepted":    return <UserCheck className={cn(cls, "text-green-500")} />
    case "invite_declined":    return <UserX className={cn(cls, "text-red-400")} />
    case "join_request_accepted": return <UserCheck className={cn(cls, "text-green-500")} />
    case "join_request_declined": return <UserX className={cn(cls, "text-red-400")} />
    case "member_removed":     return <ShieldOff className={cn(cls, "text-destructive")} />
    default:                   return <Bell className={cn(cls, "text-muted-foreground")} />
  }
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotifRow({
  notif,
  onClose,
}: {
  notif: AppNotification
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { markRead } = useNotificationStore()
  const [responding, setResponding] = useState<"accept" | "decline" | null>(null)

  const handleClick = async () => {
    await markRead(notif._id)
    const { groupId } = notif.data as { groupId?: string }
    switch (notif.type) {
      case "join_request":
        navigate("/app/groups")
        break
      case "invite_accepted":
      case "join_request_accepted":
        if (groupId) navigate(`/app/chat/${groupId}`)
        else navigate("/app/groups")
        break
      default:
        break
    }
    onClose()
  }

  const respondInvite = async (action: "accepted" | "declined") => {
    const { invitationId, groupId } = notif.data as { invitationId?: string; groupId?: string }
    if (!invitationId) return
    setResponding(action === "accepted" ? "accept" : "decline")
    try {
      await api.put(`/invitations/${invitationId}`, { status: action })
      await markRead(notif._id)
      toast.success(action === "accepted" ? "Joined group!" : "Invitation declined")
      if (action === "accepted" && groupId) navigate(`/app/chat/${groupId}`)
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? "Failed to respond")
    } finally {
      setResponding(null)
    }
  }

  const isInvite = notif.type === "group_invite"
  const isClickable = ["join_request", "invite_accepted", "join_request_accepted", "join_request_declined", "member_removed"].includes(notif.type)

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 transition-colors",
        !notif.read && "bg-primary/5",
        isClickable && "cursor-pointer hover:bg-muted/50"
      )}
      onClick={isClickable ? handleClick : undefined}
    >
      <NotifIcon type={notif.type} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm leading-tight", !notif.read && "font-medium")}>
            {notif.title}
          </p>
          {!notif.read && (
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          )}
        </div>
        <p className="text-muted-foreground text-xs leading-snug">{notif.body}</p>
        <p className="text-muted-foreground text-[11px]">
          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
        </p>

        {/* Inline accept / decline for invitations */}
        {isInvite && (
          <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              disabled={!!responding}
              onClick={() => respondInvite("accepted")}
            >
              {responding === "accept" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              disabled={!!responding}
              onClick={() => respondInvite("declined")}
            >
              {responding === "decline" ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
              Decline
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bell trigger + popover ───────────────────────────────────────────────────

export function NotificationPanel() {
  const [open, setOpen] = useState(false)
  const { notifications, unreadCount, loading, markAllRead } = useNotificationStore()

  const handleOpenChange = (val: boolean) => {
    setOpen(val)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center p-0 text-[10px]"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <p className="font-semibold text-sm">Notifications</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
              onClick={markAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>
        <Separator />

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Bell className="text-muted-foreground h-7 w-7" />
            <p className="text-muted-foreground text-sm">No notifications yet</p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="divide-y">
              {notifications.map((n) => (
                <NotifRow key={n._id} notif={n} onClose={() => setOpen(false)} />
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  )
}
