import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Send, Circle, Search, Users, MessageSquare, ShieldOff,
  Paperclip, X, Info, FileText, FileSpreadsheet, FileType, File as FileIcon, Film,
  Volume2,
} from "lucide-react"
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
import { toast } from "sonner"
import { ChatInfoModal } from "@/components/shared/ChatInfoModal"

// ─── Types ────────────────────────────────────────────────────────────────────

interface RemovedEntry {
  user: string
  removedAt: string
}

interface GroupMember {
  _id: string
  name: string
  email: string
  avatar?: string
}

interface Group {
  _id: string
  name: string
  course: string
  description?: string
  isPrivate?: boolean
  createdBy: { _id: string; name: string; avatar?: string }
  members: GroupMember[]
  removedMembers?: RemovedEntry[]
  accessibilityHints?: string[]
}

interface Attachment {
  url: string
  originalName: string
  mimetype: string
  size: number
  fileType: "image" | "video" | "document"
}

interface Message {
  _id: string
  sender: { _id: string; name: string; avatar?: string }
  content: string
  createdAt: string
  attachments?: Attachment[]
}

interface PendingFile {
  file: File
  preview: string | null
  fileType: "image" | "video" | "document"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL ?? ""

const MAX_FILE_SIZE = 5 * 1024 * 1024

const ALLOWED_TYPES: Record<string, "image" | "video" | "document"> = {
  "image/jpeg": "image", "image/png": "image", "image/gif": "image", "image/webp": "image",
  "video/mp4": "video", "video/webm": "video", "video/quicktime": "video",
  "application/pdf": "document",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/vnd.ms-excel": "document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "document",
  "application/vnd.ms-powerpoint": "document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "document",
  "text/plain": "document",
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Speech helpers ───────────────────────────────────────────────────────────

function speak(text: string) {
  if (!("speechSynthesis" in window)) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(text)
  utt.rate = 1
  utt.pitch = 1
  window.speechSynthesis.speak(utt)
}

function buildSpeechText(msg: Pick<Message, "sender" | "content" | "attachments">): string {
  const senderName = msg.sender.name
  const parts: string[] = []
  if (msg.attachments && msg.attachments.length > 0) {
    for (const att of msg.attachments) {
      if (att.fileType === "image") parts.push(`Image sent by ${senderName}.`)
      else if (att.fileType === "video") parts.push(`Video sent by ${senderName}.`)
      else parts.push(`Document "${att.originalName}" sent by ${senderName}.`)
    }
  }
  if (msg.content) parts.push(`${senderName}: ${msg.content}`)
  return parts.join(" ")
}

function MessageText({ content }: { content: string }) {
  if (!content) return null
  const parts = content.split(/(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g)
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline break-all hover:opacity-80"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

function DocIcon({ mimetype }: { mimetype: string }) {
  const cls = "h-5 w-5 shrink-0"
  if (mimetype.includes("pdf")) return <FileText className={`${cls} text-red-500`} />
  if (mimetype.includes("sheet") || mimetype.includes("excel")) return <FileSpreadsheet className={`${cls} text-green-600`} />
  if (mimetype.includes("word") || mimetype.includes("msword")) return <FileType className={`${cls} text-blue-500`} />
  return <FileIcon className={`${cls} text-muted-foreground`} />
}

function AttachmentView({ attachment, isMe }: { attachment: Attachment; isMe: boolean }) {
  const url = `${API_BASE}${attachment.url}`
  const bubbleCls = isMe ? "bg-primary/20" : "bg-muted"

  if (attachment.fileType === "image") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={url}
          alt={attachment.originalName}
          className="max-w-[240px] max-h-[200px] rounded-xl object-cover"
        />
      </a>
    )
  }

  if (attachment.fileType === "video") {
    return (
      <video
        src={url}
        controls
        className="max-w-[240px] max-h-[200px] rounded-xl"
        preload="metadata"
      />
    )
  }

  return (
    <a
      href={url}
      download={attachment.originalName}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("flex items-center gap-2 px-3 py-2 rounded-xl max-w-[240px]", bubbleCls)}
    >
      <DocIcon mimetype={attachment.mimetype} />
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{attachment.originalName}</p>
        <p className="text-xs opacity-60">{formatBytes(attachment.size)}</p>
      </div>
    </a>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

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
  const [showInfo, setShowInfo] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const userRef = useRef(user)
  const activeGroup = groups.find((g) => g._id === groupId)

  const removedEntry = user && activeGroupDetail?.removedMembers?.find(
    (r) => r.user === user._id
  )
  const isRemoved = !!removedEntry
  const removedAt = removedEntry?.removedAt ? new Date(removedEntry.removedAt) : null
  const isScreenReaderUser = user?.accessibilityNeeds?.includes("screen-reader") ?? false

  // Keep ref in sync so stale-closure-safe effects can read current values
  useEffect(() => { userRef.current = user }, [user])

  useEffect(() => {
    api.get("/groups/mine")
      .then(({ data }) => setGroups(data))
      .finally(() => setLoadingGroups(false))
  }, [])

  useEffect(() => {
    if (!groupId) return
    setMessages([])
    setActiveGroupDetail(null)
    setLoadingMsgs(true)
    setShowInfo(false)
    Promise.all([
      api.get(`/groups/${groupId}`),
      api.get(`/messages/${groupId}`),
    ]).then(([groupRes, msgsRes]) => {
      setActiveGroupDetail(groupRes.data)
      setMessages(msgsRes.data)
    }).finally(() => setLoadingMsgs(false))
  }, [groupId])

  useEffect(() => {
    if (!socket || !groupId) return
    socket.emit("join_group", groupId)
    return () => { socket.emit("leave_group", groupId) }
  }, [socket, groupId])

  useEffect(() => {
    if (!socket) return
    const onMessage = (msg: Message) => {
      setMessages((prev) => {
        // Dedup by real _id
        if (prev.some((m) => m._id === msg._id)) return prev
        // Replace the earliest temp placeholder from this sender
        const tempIdx = prev.findIndex(
          (m) => m._id.startsWith("temp-") && m.sender._id === msg.sender._id
        )
        if (tempIdx !== -1) {
          const next = [...prev]
          next[tempIdx] = msg
          return next
        }
        return [...prev, msg]
      })
      setTypingUsers((prev) => prev.filter((n) => n !== msg.sender.name))
      // Auto-read incoming messages (not own) for screen-reader users
      const currentUser = userRef.current
      const isScreenReader = currentUser?.accessibilityNeeds?.includes("screen-reader") ?? false
      if (isScreenReader && msg.sender._id !== currentUser?._id) {
        speak(buildSpeechText(msg))
      }
    }
    const onTyping = ({ name }: { name: string }) => {
      setTypingUsers((prev) => prev.includes(name) ? prev : [...prev, name])
    }
    const onStopTyping = ({ userId: uid }: { userId: string }) => { void uid }
    socket.on("new_message", onMessage)
    socket.on("user_typing", onTyping)
    socket.on("user_stop_typing", onStopTyping)
    return () => {
      socket.off("new_message", onMessage)
      socket.off("user_typing", onTyping)
      socket.off("user_stop_typing", onStopTyping)
    }
  }, [socket])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    return () => {
      pendingFiles.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview) })
    }
  }, [pendingFiles])

  const handleInputChange = (v: string) => {
    setInput(v)
    if (!socket || !groupId) return
    socket.emit("typing", { groupId })
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      socket.emit("stop_typing", { groupId })
    }, 1500)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    e.target.value = ""
    if (selected.length === 0) return
    const newEntries: PendingFile[] = []
    for (const file of selected) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" exceeds 5 MB limit.`)
        continue
      }
      const fileType = ALLOWED_TYPES[file.type]
      if (!fileType) {
        toast.error(`"${file.name}" is not a supported file type.`)
        continue
      }
      const preview = (fileType === "image" || fileType === "video")
        ? URL.createObjectURL(file)
        : null
      newEntries.push({ file, preview, fileType })
    }
    if (newEntries.length > 0) setPendingFiles((prev) => [...prev, ...newEntries])
  }

  const sendMessage = useCallback(async () => {
    const content = input.trim()
    if (!content && pendingFiles.length === 0) return
    if (!socket || !groupId) return

    let attachments: unknown[] = []
    if (pendingFiles.length > 0) {
      setUploading(true)
      try {
        attachments = await Promise.all(
          pendingFiles.map(async (pf) => {
            const formData = new FormData()
            formData.append("file", pf.file)
            const { data } = await api.post("/messages/upload", formData, {
              headers: { "Content-Type": "multipart/form-data" },
            })
            return data
          })
        )
      } catch {
        toast.error("Failed to upload one or more files")
        setUploading(false)
        return
      } finally {
        setUploading(false)
      }
    }

    socket.emit("send_message", { groupId, content, attachments })

    // Optimistically add to UI immediately; socket echo will replace it
    setMessages((prev) => [
      ...prev,
      {
        _id: `temp-${Date.now()}`,
        sender: { _id: user!._id, name: user!.name, avatar: user?.avatar },
        content,
        createdAt: new Date().toISOString(),
        attachments: attachments as Attachment[],
      },
    ])

    setInput("")
    setPendingFiles([])
    if (typingTimer.current) clearTimeout(typingTimer.current)
    socket.emit("stop_typing", { groupId })
  }, [input, socket, groupId, pendingFiles, user])

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
            <button
              className="text-left hover:opacity-70 transition-opacity disabled:pointer-events-none"
              disabled={!activeGroupDetail}
              onClick={() => activeGroupDetail && setShowInfo(true)}
            >
              <p className="text-sm font-semibold">{activeGroup?.name ?? "…"}</p>
              <p className="text-muted-foreground text-xs">
                {activeGroup?.course} · {activeGroup?.members?.length ?? 0} members
              </p>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                {onlineUsers.length} online
              </div>
              {activeGroupDetail && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowInfo(true)}
                  aria-label="Group info"
                >
                  <Info className="h-4 w-4" />
                </Button>
              )}
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
                    const hasAttachment = msg.attachments && msg.attachments.length > 0
                    return (
                      <div key={msg._id} className={cn("group/msg flex gap-2 items-end", isMe && "flex-row-reverse")}>
                        {!isMe && (
                          <Avatar className="h-7 w-7 shrink-0 self-end">
                            <AvatarImage src={msg.sender.avatar} alt={msg.sender.name} />
                            <AvatarFallback className="text-[10px]">{initials(msg.sender.name)}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className={cn("max-w-xs space-y-1", isMe && "items-end flex flex-col")}>
                          {!isMe && (
                            <p className="text-muted-foreground text-xs font-medium">{msg.sender.name}</p>
                          )}
                          {hasAttachment && msg.attachments!.map((att, ai) => (
                            <AttachmentView key={ai} attachment={att} isMe={isMe} />
                          ))}
                          {msg.content && (
                            <div
                              className={cn(
                                "rounded-2xl px-3 py-2 text-sm",
                                isMe
                                  ? "bg-primary text-primary-foreground rounded-br-sm"
                                  : "bg-muted rounded-bl-sm"
                              )}
                            >
                              <MessageText content={msg.content} />
                            </div>
                          )}
                          <p className={cn("text-[11px] text-muted-foreground", isMe && "text-right")}>
                            {formatMsgTime(msg.createdAt)}
                          </p>
                        </div>
                        {/* Read-aloud button — always visible for screen-reader users, hover-visible otherwise */}
                        <button
                          onClick={() => speak(buildSpeechText(msg))}
                          aria-label={`Read message from ${msg.sender.name} aloud`}
                          className={cn(
                            "mb-1 shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                            isScreenReaderUser
                              ? "opacity-100"
                              : "opacity-0 group-hover/msg:opacity-100"
                          )}
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                        </button>
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

          {/* Input bar */}
          {!isRemoved && (
            <div className="border-t p-3">
              {pendingFiles.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pendingFiles.map((pf, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2 max-w-[200px]">
                      {pf.fileType === "image" && pf.preview ? (
                        <img src={pf.preview} alt="preview" className="h-12 w-12 rounded object-cover shrink-0" />
                      ) : pf.fileType === "video" && pf.preview ? (
                        <video src={pf.preview} className="h-12 w-12 rounded object-cover shrink-0" muted />
                      ) : (
                        <div className="h-12 w-12 flex items-center justify-center rounded bg-background border shrink-0">
                          <DocIcon mimetype={pf.file.type} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{pf.file.name}</p>
                        <p className="text-[11px] text-muted-foreground">{formatBytes(pf.file.size)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => {
                          if (pf.preview) URL.revokeObjectURL(pf.preview)
                          setPendingFiles((prev) => prev.filter((_, i) => i !== idx))
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept={Object.keys(ALLOWED_TYPES).join(",")}
                  onChange={handleFileSelect}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  aria-label="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Input
                  placeholder="Type a message…"
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                  disabled={uploading}
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  disabled={(!input.trim() && pendingFiles.length === 0) || uploading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeGroupDetail && (
        <ChatInfoModal
          open={showInfo}
          onClose={() => setShowInfo(false)}
          group={activeGroupDetail}
          messages={messages}
        />
      )}
    </div>
  )
}
