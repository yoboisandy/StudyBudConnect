import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Send, Circle, Search, Users, MessageSquare, ShieldOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import api from "@/lib/api"
import { useAuthStore } from "@/stores/authStore"
import { useSocketStore } from "@/stores/socketStore"
import { cn } from "@/lib/utils"
import { format, isToday, isYesterday } from "date-fns"

interface RemovedEntry {
  user: string
  removedAt: string
}

interface Group {
  _id: string
  name: string
  course: string
  memberCount: number
  removedMembers?: RemovedEntry[]
}

interface Message {
  _id: string
  sender: { _id: string; name: string; avatar?: string }
  content: string
  createdAt: string
}

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr)
  if (isToday(d)) return format(d, "HH:mm")
  if (isYesterday(d)) return `Yesterday ${format(d, "HH:mm")}`
  return format(d, "MMM d, HH:mm")
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

export default function ChatPage() {
  const { groupId } = useParams<{ groupId?: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { socket, onlineUsers } = useSocketStore()

  const [groups, setGroups] = useState<Group[]>([])
  const [groupSearch, setGroupSearch] = useState("")
  const [loadingGroups, setLoadingGroups] = useState(true)

  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [input, setInput] = useState("")
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [activeGroupDetail, setActiveGroupDetail] = useState<Group | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeGroup = groups.find((g) => g._id === groupId)

  // removed-member state derived from group detail
  const removedEntry = user && activeGroupDetail?.removedMembers?.find(
    (r) => r.user === user._id
  )
  const isRemoved = !!removedEntry
  const removedAt = removedEntry?.removedAt ? new Date(removedEntry.removedAt) : null

  // Load groups sidebar
  useEffect(() => {
    api.get("/groups/mine")
      .then(({ data }) => setGroups(data))
      .finally(() => setLoadingGroups(false))
  }, [])

  // Load group detail + messages when group changes
  useEffect(() => {
    if (!groupId) return
    setMessages([])
    setActiveGroupDetail(null)
    setLoadingMsgs(true)
    Promise.all([
      api.get(`/groups/${groupId}`),
      api.get(`/messages/${groupId}`),
    ]).then(([groupRes, msgsRes]) => {
      setActiveGroupDetail(groupRes.data)
      setMessages(msgsRes.data)
    }).finally(() => setLoadingMsgs(false))
  }, [groupId])

  // Socket: join/leave room
  useEffect(() => {
    if (!socket || !groupId) return
    socket.emit("join_group", groupId)
    return () => { socket.emit("leave_group", groupId) }
  }, [socket, groupId])

  // Socket: incoming events
  useEffect(() => {
    if (!socket) return

    const onMessage = (msg: Message) => {
      setMessages((prev) => [...prev, msg])
      setTypingUsers((prev) => prev.filter((n) => n !== msg.sender.name))
    }
    const onTyping = ({ userName }: { userName: string }) => {
      setTypingUsers((prev) => prev.includes(userName) ? prev : [...prev, userName])
    }
    const onStopTyping = ({ userName }: { userName: string }) => {
      setTypingUsers((prev) => prev.filter((n) => n !== userName))
    }

    socket.on("new_message", onMessage)
    socket.on("user_typing", onTyping)
    socket.on("user_stop_typing", onStopTyping)
    return () => {
      socket.off("new_message", onMessage)
      socket.off("user_typing", onTyping)
      socket.off("user_stop_typing", onStopTyping)
    }
  }, [socket])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleInputChange = (v: string) => {
    setInput(v)
    if (!socket || !groupId) return
    socket.emit("typing", { groupId })
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      socket.emit("stop_typing", { groupId })
    }, 1500)
  }

  const sendMessage = useCallback(() => {
    const content = input.trim()
    if (!content || !socket || !groupId) return
    socket.emit("send_message", { groupId, content })
    setInput("")
    if (typingTimer.current) clearTimeout(typingTimer.current)
    socket.emit("stop_typing", { groupId })
  }, [input, socket, groupId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
    g.course.toLowerCase().includes(groupSearch.toLowerCase())
  )

  return (
    <div className="flex h-[calc(100vh-3.5rem-1px)] -m-6 overflow-hidden">
      {/* Group list sidebar */}
      <div className="flex w-64 shrink-0 flex-col border-r">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              className="h-8 pl-8 text-sm"
              placeholder="Search groups"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
            />
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          {loadingGroups ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 p-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <Users className="text-muted-foreground h-6 w-6" />
              <p className="text-muted-foreground text-xs">No groups yet</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/app/discover")}>
                Discover
              </Button>
            </div>
          ) : (
            <div className="space-y-px p-2">
              {filteredGroups.map((g) => (
                <button
                  key={g._id}
                  onClick={() => navigate(`/app/chat/${g._id}`)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md p-2 text-left transition-colors hover:bg-muted/50",
                    groupId === g._id && "bg-muted"
                  )}
                >
                  <div className="bg-primary/10 text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {g.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{g.name}</p>
                    <p className="text-muted-foreground truncate text-xs">{g.course}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat area */}
      {!groupId ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <MessageSquare className="text-muted-foreground h-10 w-10" />
          <p className="font-medium">Select a group to start chatting</p>
          <p className="text-muted-foreground text-sm">Choose from your groups on the left</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Chat header */}
          <div className="flex items-center gap-3 border-b px-4 py-2.5">
            <div>
              <p className="text-sm font-semibold">{activeGroup?.name ?? "…"}</p>
              <p className="text-muted-foreground text-xs">
                {activeGroup?.course} · {activeGroup?.memberCount} members
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <Circle className="h-2 w-2 fill-green-500 text-green-500" />
              {onlineUsers.length} online
            </div>
          </div>

          {/* Removed banner */}
          {isRemoved && (
            <div className="flex items-center gap-2 border-b bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              <ShieldOff className="h-4 w-4 shrink-0" />
              <span>You were removed from this group. No new messages are available to you.</span>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="min-h-0 flex-1 px-4 py-3">
            {loadingMsgs ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={cn("flex gap-2", i % 3 === 0 && "flex-row-reverse")}>
                    <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-20" />
                      <Skeleton className="h-10 w-48 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <MessageSquare className="text-muted-foreground h-8 w-8" />
                <p className="text-muted-foreground text-sm">No messages yet. Say hello!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages
                  .filter((msg) => !removedAt || new Date(msg.createdAt) <= removedAt)
                  .map((msg) => {
                    const isMe = msg.sender._id === user?._id
                    return (
                      <div key={msg._id} className={cn("flex gap-2", isMe && "flex-row-reverse")}>
                        {!isMe && (
                          <Avatar className="h-7 w-7 shrink-0 self-end">
                            <AvatarImage src={msg.sender.avatar} alt={msg.sender.name} />
                            <AvatarFallback className="text-[10px]">{initials(msg.sender.name)}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className={cn("max-w-xs space-y-1", isMe && "items-end")}>
                          {!isMe && (
                            <p className="text-muted-foreground text-xs font-medium">{msg.sender.name}</p>
                          )}
                          <div
                            className={cn(
                              "rounded-2xl px-3 py-2 text-sm",
                              isMe
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-muted rounded-bl-sm"
                            )}
                          >
                            {msg.content}
                          </div>
                          <p className={cn("text-[11px] text-muted-foreground", isMe && "text-right")}>
                            {formatMsgTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                {!isRemoved && typingUsers.length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex gap-0.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                    </div>
                    {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing…
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input bar — hidden for removed members */}
          {!isRemoved && <div className="border-t p-3">
            <div className="flex gap-2">
              <Input
                placeholder="Type a message…"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1"
              />
              <Button size="icon" onClick={sendMessage} disabled={!input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>}
        </div>
      )}
    </div>
  )
}
