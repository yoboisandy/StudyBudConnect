import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Users, MessageSquare, Plus, FolderOpen, Settings2, Loader2,
  Bell, Check, X, UserMinus, Search, UserPlus, Crown,
} from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import api from "@/lib/api"
import { useAuthStore } from "@/stores/authStore"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Member {
  _id: string
  name: string
  email?: string
  avatar?: string
}

interface JoinRequest {
  _id: string
  user: { _id: string; name: string; email: string; avatar?: string }
  requestedAt: string
}

interface Group {
  _id: string
  name: string
  course: string
  description: string
  memberCount: number
  members: Member[]
  isPrivate?: boolean
  createdBy: { _id: string; name: string }
}

// ─── Zod schema ───────────────────────────────────────────────────────────────

const editSchema = z.object({
  name: z.string().min(3, "At least 3 characters"),
  course: z.string().min(2, "Course code required"),
  description: z.string().min(10, "At least 10 characters"),
  isPrivate: z.boolean().optional(),
})
type EditValues = z.infer<typeof editSchema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
}

function GroupSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </CardHeader>
      <CardContent><Skeleton className="h-4 w-full" /></CardContent>
      <CardFooter><Skeleton className="h-9 w-full" /></CardFooter>
    </Card>
  )
}

// ─── Manage dialog (Details / Members / Join Requests / Invite) ───────────────

function ManageGroupDialog({
  group,
  userId,
  open,
  onClose,
  onGroupUpdated,
}: {
  group: Group
  userId?: string
  open: boolean
  onClose: () => void
  onGroupUpdated: (updated: Partial<Group> & { _id: string }) => void
}) {
  // ── Details tab ──
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: group.name,
      course: group.course,
      description: group.description,
      isPrivate: group.isPrivate ?? false,
    },
  })
  const { formState: { isSubmitting } } = form

  useEffect(() => {
    if (open) {
      form.reset({
        name: group.name,
        course: group.course,
        description: group.description,
        isPrivate: group.isPrivate ?? false,
      })
    }
  }, [open, group])

  const saveDetails = async (values: EditValues) => {
    try {
      const { data } = await api.put(`/groups/${group._id}`, values)
      toast.success("Group updated!")
      onGroupUpdated(data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? "Failed to update group")
    }
  }

  // ── Members tab ──
  const [members, setMembers] = useState<Member[]>(group.members)
  const [removing, setRemoving] = useState<string | null>(null)

  useEffect(() => { setMembers(group.members) }, [group.members])

  const removeMember = async (memberId: string) => {
    setRemoving(memberId)
    try {
      await api.delete(`/groups/${group._id}/members/${memberId}`)
      setMembers((prev) => prev.filter((m) => m._id !== memberId))
      onGroupUpdated({ _id: group._id, memberCount: members.length - 1 })
      toast.success("Member removed")
    } catch {
      toast.error("Failed to remove member")
    } finally {
      setRemoving(null)
    }
  }

  // ── Join Requests tab ──
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [loadingReqs, setLoadingReqs] = useState(false)
  const [responding, setResponding] = useState<string | null>(null)
  const reqsFetched = useRef(false)

  const fetchRequests = useCallback(async () => {
    if (!group.isPrivate) return
    setLoadingReqs(true)
    reqsFetched.current = true
    try {
      const { data } = await api.get(`/groups/${group._id}/join-requests`)
      setRequests(data)
    } catch {
      toast.error("Failed to load requests")
    } finally {
      setLoadingReqs(false)
    }
  }, [group._id, group.isPrivate])

  useEffect(() => {
    if (open && !reqsFetched.current) fetchRequests()
    if (!open) reqsFetched.current = false
  }, [open, fetchRequests])

  const respondRequest = async (requestUserId: string, action: "accept" | "decline") => {
    setResponding(requestUserId)
    try {
      await api.post(`/groups/${group._id}/join-requests/respond`, { userId: requestUserId, action })
      setRequests((prev) => prev.filter((r) => r.user._id !== requestUserId))
      if (action === "accept") {
        toast.success("Member added!")
        onGroupUpdated({ _id: group._id, memberCount: group.memberCount + 1 })
      } else {
        toast.success("Request declined")
      }
    } catch {
      toast.error("Failed to respond")
    } finally {
      setResponding(null)
    }
  }

  // ── Invite tab ──
  const [inviteSearch, setInviteSearch] = useState("")
  const [inviteResults, setInviteResults] = useState<Member[]>([])
  const [searchingInvite, setSearchingInvite] = useState(false)
  const [inviting, setInviting] = useState<string | null>(null)
  const inviteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!inviteSearch.trim()) { setInviteResults([]); return }
    if (inviteTimer.current) clearTimeout(inviteTimer.current)
    inviteTimer.current = setTimeout(async () => {
      setSearchingInvite(true)
      try {
        const { data } = await api.get("/users/search", { params: { q: inviteSearch.trim() } })
        // exclude existing members
        const memberIds = new Set(members.map((m) => m._id))
        setInviteResults(data.filter((u: Member) => !memberIds.has(u._id)))
      } catch { /* silent */ }
      finally { setSearchingInvite(false) }
    }, 350)
    return () => { if (inviteTimer.current) clearTimeout(inviteTimer.current) }
  }, [inviteSearch, members])

  const sendInvite = async (inviteeId: string) => {
    setInviting(inviteeId)
    try {
      await api.post("/invitations", { groupId: group._id, inviteeId })
      toast.success("Invitation sent!")
      setInviteResults((prev) => prev.filter((u) => u._id !== inviteeId))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? "Failed to send invitation")
    } finally {
      setInviting(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage group</DialogTitle>
          <DialogDescription>{group.name}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
            <TabsTrigger value="members" className="flex-1">
              Members ({members.length})
            </TabsTrigger>
            {group.isPrivate && (
              <TabsTrigger value="requests" className="flex-1">
                Requests
                {requests.length > 0 && (
                  <Badge variant="destructive" className="ml-1.5 h-4 min-w-4 px-1 text-[10px]">
                    {requests.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="invite" className="flex-1">Invite</TabsTrigger>
          </TabsList>

          {/* ── Details ── */}
          <TabsContent value="details" className="mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(saveDetails)} className="space-y-4" noValidate>
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="course" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course code</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea className="resize-none" rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="isPrivate" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={!!field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <Label className="cursor-pointer font-normal">Private group (invite only)</Label>
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              </form>
            </Form>
          </TabsContent>

          {/* ── Members ── */}
          <TabsContent value="members" className="mt-4">
            <ScrollArea className="max-h-72">
              <div className="space-y-1">
                {members.map((m, i) => {
                  const isOwner = m._id === group.createdBy._id
                  return (
                    <div key={m._id}>
                      {i > 0 && <Separator className="my-1" />}
                      <div className="flex items-center gap-3 rounded-md p-2">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs">{initials(m.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-medium">{m.name}</p>
                            {isOwner && <Crown className="h-3 w-3 shrink-0 text-amber-500" />}
                          </div>
                          {m.email && <p className="text-muted-foreground truncate text-xs">{m.email}</p>}
                        </div>
                        {!isOwner && userId === group.createdBy._id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={removing === m._id}
                            onClick={() => removeMember(m._id)}
                            aria-label={`Remove ${m.name}`}
                          >
                            {removing === m._id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <UserMinus className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── Join Requests ── */}
          {group.isPrivate && (
            <TabsContent value="requests" className="mt-4">
              {loadingReqs ? (
                <div className="space-y-3 py-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : requests.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Bell className="text-muted-foreground h-7 w-7" />
                  <p className="text-muted-foreground text-sm">No pending join requests</p>
                </div>
              ) : (
                <ScrollArea className="max-h-72">
                  <div className="space-y-1">
                    {requests.map((r, i) => (
                      <div key={r._id}>
                        {i > 0 && <Separator className="my-1" />}
                        <div className="flex items-center gap-3 rounded-md p-2">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-xs">{initials(r.user.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{r.user.name}</p>
                            <p className="text-muted-foreground truncate text-xs">{r.user.email}</p>
                          </div>
                          <div className="flex shrink-0 gap-1.5">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                              disabled={responding === r.user._id}
                              onClick={() => respondRequest(r.user._id, "accept")}
                              aria-label="Accept"
                            >
                              {responding === r.user._id
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Check className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                              disabled={responding === r.user._id}
                              onClick={() => respondRequest(r.user._id, "decline")}
                              aria-label="Decline"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          )}

          {/* ── Invite ── */}
          <TabsContent value="invite" className="mt-4 space-y-3">
            <div className="relative">
              <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                className="pl-9"
                placeholder="Search by name or email"
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
              />
            </div>

            {searchingInvite && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </div>
            )}

            {!searchingInvite && inviteSearch && inviteResults.length === 0 && (
              <p className="text-muted-foreground text-center text-sm py-4">No users found</p>
            )}

            {inviteResults.length > 0 && (
              <ScrollArea className="max-h-56 rounded-md border">
                <div className="divide-y">
                  {inviteResults.map((u) => (
                    <div key={u._id} className="flex items-center gap-3 p-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs">{initials(u.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{u.name}</p>
                        {u.email && <p className="text-muted-foreground truncate text-xs">{u.email}</p>}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 gap-1.5"
                        disabled={inviting === u._id}
                        onClick={() => sendInvite(u._id)}
                      >
                        {inviting === u._id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <UserPlus className="h-3.5 w-3.5" />}
                        {inviting === u._id ? "Sending…" : "Invite"}
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// ─── Group card ───────────────────────────────────────────────────────────────

function GroupCard({
  group,
  userId,
  onManage,
}: {
  group: Group
  userId?: string
  onManage: (g: Group) => void
}) {
  const navigate = useNavigate()
  const isOwner = group.createdBy?._id === userId

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">{group.name}</CardTitle>
          <div className="flex shrink-0 items-center gap-1.5">
            {isOwner && <Badge variant="secondary" className="text-xs">Owner</Badge>}
            {isOwner && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onManage(group)}
                aria-label="Manage group"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          <Badge variant="outline" className="text-xs">{group.course}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        <p className="text-muted-foreground line-clamp-2 text-sm">{group.description}</p>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {group.members.slice(0, 5).map((m) => (
              <Avatar key={m._id} className="h-6 w-6 border-2 border-background">
                <AvatarFallback className="text-[10px]">
                  {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {group.memberCount > 5 && (
              <div className="bg-muted text-muted-foreground flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px]">
                +{group.memberCount - 5}
              </div>
            )}
          </div>
          <span className="text-muted-foreground text-xs">
            {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
          </span>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full gap-2" onClick={() => navigate(`/app/chat/${group._id}`)}>
          <MessageSquare className="h-4 w-4" />
          Open chat
        </Button>
      </CardFooter>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MyGroupsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [manageTarget, setManageTarget] = useState<Group | null>(null)

  useEffect(() => {
    api.get("/groups/mine")
      .then(({ data }) => setGroups(data))
      .catch(() => toast.error("Failed to load groups"))
      .finally(() => setLoading(false))
  }, [])

  const handleGroupUpdated = (updated: Partial<Group> & { _id: string }) => {
    setGroups((prev) =>
      prev.map((g) => (g._id === updated._id ? { ...g, ...updated } : g))
    )
    // keep manage target in sync
    setManageTarget((prev) => (prev && prev._id === updated._id ? { ...prev, ...updated } : prev))
  }

  const myGroups = groups.filter((g) => g.createdBy?._id === user?._id)
  const joinedGroups = groups.filter((g) => g.createdBy?._id !== user?._id)

  const Empty = ({ label }: { label: string }) => (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <FolderOpen className="text-muted-foreground h-8 w-8" />
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  )

  const renderGrid = (list: Group[]) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((g) => (
        <GroupCard key={g._id} group={g} userId={user?._id} onManage={setManageTarget} />
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {groups.length} group{groups.length !== 1 ? "s" : ""} total
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/app/discover")} className="gap-2">
            <Users className="h-4 w-4" />
            Discover
          </Button>
          <Button onClick={() => navigate("/app/groups/create")} className="gap-2">
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({groups.length})</TabsTrigger>
          <TabsTrigger value="created">Created ({myGroups.length})</TabsTrigger>
          <TabsTrigger value="joined">Joined ({joinedGroups.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 4 }).map((_, i) => <GroupSkeleton key={i} />)}
            </div>
          ) : groups.length === 0 ? (
            <Empty label="You haven't joined any groups yet." />
          ) : renderGrid(groups)}
        </TabsContent>

        <TabsContent value="created" className="mt-4">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 2 }).map((_, i) => <GroupSkeleton key={i} />)}
            </div>
          ) : myGroups.length === 0 ? (
            <Empty label="You haven't created any groups." />
          ) : renderGrid(myGroups)}
        </TabsContent>

        <TabsContent value="joined" className="mt-4">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 2 }).map((_, i) => <GroupSkeleton key={i} />)}
            </div>
          ) : joinedGroups.length === 0 ? (
            <Empty label="You haven't joined any groups created by others." />
          ) : renderGrid(joinedGroups)}
        </TabsContent>
      </Tabs>

      {manageTarget && (
        <ManageGroupDialog
          group={manageTarget}
          userId={user?._id}
          open={!!manageTarget}
          onClose={() => setManageTarget(null)}
          onGroupUpdated={handleGroupUpdated}
        />
      )}
    </div>
  )
}
