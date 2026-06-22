import { useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  FileText, FileSpreadsheet, FileType, File as FileIcon,
  Film, Link2, Crown, Users,
} from "lucide-react"

interface GroupMember {
  _id: string
  name: string
  email: string
  avatar?: string
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
  sender: { _id: string; name: string }
  content: string
  createdAt: string
  attachments?: Attachment[]
}

interface GroupDetail {
  _id: string
  name: string
  course: string
  description?: string
  isPrivate?: boolean
  createdBy: { _id: string; name: string; avatar?: string }
  members: GroupMember[]
}

interface Props {
  open: boolean
  onClose: () => void
  group: GroupDetail
  messages: Message[]
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DocIcon({ mimetype }: { mimetype: string }) {
  const cls = "h-5 w-5 shrink-0"
  if (mimetype.includes("pdf")) return <FileText className={`${cls} text-red-500`} />
  if (mimetype.includes("sheet") || mimetype.includes("excel")) return <FileSpreadsheet className={`${cls} text-green-600`} />
  if (mimetype.includes("word") || mimetype.includes("msword")) return <FileType className={`${cls} text-blue-500`} />
  return <FileIcon className={`${cls} text-muted-foreground`} />
}

const URL_RE = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g

export function ChatInfoModal({ open, onClose, group, messages }: Props) {
  const apiBase = import.meta.env.VITE_API_URL ?? ""

  const media = useMemo(() =>
    messages.flatMap((m) => m.attachments ?? []).filter((a) => a.fileType === "image" || a.fileType === "video"),
    [messages]
  )

  const documents = useMemo(() =>
    messages.flatMap((m) => m.attachments ?? []).filter((a) => a.fileType === "document"),
    [messages]
  )

  const links = useMemo(() => {
    const found: string[] = []
    messages.forEach((m) => {
      const matches = m.content.match(URL_RE)
      if (matches) matches.forEach((url) => { if (!found.includes(url)) found.push(url) })
    })
    return found
  }, [messages])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-4 border-b shrink-0">
          <DialogTitle className="text-base">{group.name}</DialogTitle>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">{group.course}</span>
            {group.isPrivate && <Badge variant="secondary" className="text-xs">Private</Badge>}
          </div>
          {group.description && (
            <p className="text-sm text-muted-foreground mt-1 leading-snug">{group.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{group.members.length} members</p>
        </DialogHeader>

        <Tabs defaultValue="members" className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-5 mt-3 mb-0 shrink-0 grid grid-cols-4">
            <TabsTrigger value="members" className="text-xs">Members</TabsTrigger>
            <TabsTrigger value="media" className="text-xs">
              Media {media.length > 0 && <span className="ml-1 text-[10px] opacity-60">{media.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="docs" className="text-xs">
              Docs {documents.length > 0 && <span className="ml-1 text-[10px] opacity-60">{documents.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="links" className="text-xs">
              Links {links.length > 0 && <span className="ml-1 text-[10px] opacity-60">{links.length}</span>}
            </TabsTrigger>
          </TabsList>

          {/* Members */}
          <TabsContent value="members" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-[340px] px-5 py-3">
              <div className="space-y-1">
                {group.members.map((m) => {
                  const isOwner = m._id === group.createdBy._id
                  return (
                    <div key={m._id} className="flex items-center gap-3 py-2 rounded-md">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={m.avatar} alt={m.name} />
                        <AvatarFallback className="text-xs">{initials(m.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{m.name}</p>
                          {isOwner && <Crown className="h-3 w-3 text-amber-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Media */}
          <TabsContent value="media" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-[340px] px-5 py-3">
              {media.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Film className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No media shared yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {media.map((a, i) => (
                    <a
                      key={i}
                      href={`${apiBase}${a.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square overflow-hidden rounded-md bg-muted block"
                    >
                      {a.fileType === "image" ? (
                        <img
                          src={`${apiBase}${a.url}`}
                          alt={a.originalName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="h-6 w-6 text-muted-foreground" />
                          <span className="sr-only">{a.originalName}</span>
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Documents */}
          <TabsContent value="docs" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-[340px] px-5 py-3">
              {documents.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No documents shared yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map((a, i) => (
                    <a
                      key={i}
                      href={`${apiBase}${a.url}`}
                      download={a.originalName}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <DocIcon mimetype={a.mimetype} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{a.originalName}</p>
                        <p className="text-xs text-muted-foreground">{formatBytes(a.size)}</p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Links */}
          <TabsContent value="links" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-[340px] px-5 py-3">
              {links.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <Link2 className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No links shared yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {links.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <Link2 className="h-4 w-4 shrink-0 text-primary" />
                      <p className="text-sm text-primary truncate">{url}</p>
                    </a>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="px-5 py-3 border-t shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Owner: {group.createdBy.name}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
