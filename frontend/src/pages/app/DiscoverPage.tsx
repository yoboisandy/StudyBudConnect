import { useState, useEffect, useCallback } from "react"
import { Search, Users, Lock, Unlock, Info, Plus, CheckCircle2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import api from "@/lib/api"
import { useAuthStore } from "@/stores/authStore"
import { toast } from "sonner"

interface Group {
  _id: string
  name: string
  course: string
  description: string
  memberCount: number
  isPrivate: boolean
  accessibilityHints?: string[]
  createdBy: { name: string; avatar?: string }
  members: { _id: string }[]
}

function GroupCardSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-2/3" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-9 w-full" />
      </CardFooter>
    </Card>
  )
}

export default function DiscoverPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Group | null>(null)
  const [joining, setJoining] = useState<string | null>(null)

  const fetchGroups = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const params = q.trim() ? { course: q.trim() } : {}
      const { data } = await api.get("/groups", { params })
      setGroups(data)
    } catch {
      toast.error("Failed to load groups")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGroups("")
  }, [fetchGroups])

  useEffect(() => {
    const t = setTimeout(() => fetchGroups(search), 400)
    return () => clearTimeout(t)
  }, [search, fetchGroups])

  const handleJoin = async (group: Group) => {
    setJoining(group._id)
    try {
      await api.post(`/groups/${group._id}/join`)
      if (group.isPrivate) {
        toast.success("Join request sent! Waiting for owner approval.")
        setSelected(null)
      } else {
        toast.success("Joined group!")
        if (user?._id) {
          setGroups((prev) =>
            prev.map((g) =>
              g._id === group._id
                ? { ...g, members: [...g.members, { _id: user._id! }], memberCount: g.memberCount + 1 }
                : g
            )
          )
        }
        setSelected(null)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? "Failed to join group")
    } finally {
      setJoining(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            className="pl-9"
            placeholder="Search by course (e.g. CS739)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => navigate("/app/groups/create")} className="gap-2">
          <Plus className="h-4 w-4" />
          Create group
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <GroupCardSkeleton key={i} />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <Users className="text-muted-foreground h-10 w-10" />
          <p className="font-medium">No groups found</p>
          <p className="text-muted-foreground text-sm">
            {search ? `No groups for "${search}"` : "Be the first to create one!"}
          </p>
          <Button variant="outline" onClick={() => navigate("/app/groups/create")} className="gap-2">
            <Plus className="h-4 w-4" />
            Create group
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <Card key={g._id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{g.name}</CardTitle>
                  {g.isPrivate ? (
                    <Lock className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <Unlock className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                  )}
                </div>
                <CardDescription>
                  <Badge variant="secondary" className="text-xs">{g.course}</Badge>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-muted-foreground line-clamp-2 text-sm">{g.description}</p>
                <div className="text-muted-foreground mt-3 flex items-center gap-1 text-xs">
                  <Users className="h-3.5 w-3.5" />
                  {g.memberCount} member{g.memberCount !== 1 ? "s" : ""}
                </div>
              </CardContent>
              <CardFooter className="gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setSelected(g)}
                >
                  <Info className="h-3.5 w-3.5" />
                  Details
                </Button>
                {g.members.some((m) => m._id === user?._id) ? (
                  <Button size="sm" className="flex-1 gap-1.5" variant="secondary" disabled>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Joined
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="flex-1"
                    variant={g.isPrivate ? "outline" : "default"}
                    onClick={() => handleJoin(g)}
                    disabled={joining === g._id}
                  >
                    {joining === g._id ? "Sending…" : g.isPrivate ? "Request to join" : "Join"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Group detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>
              <Badge variant="secondary" className="text-xs">{selected?.course}</Badge>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">{selected?.description}</p>

            <div className="flex items-center gap-2">
              <Users className="text-muted-foreground h-4 w-4" />
              <span>{selected?.memberCount} member{selected?.memberCount !== 1 ? "s" : ""}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                Created by {selected?.createdBy?.name}
              </span>
            </div>

            {selected?.accessibilityHints && selected.accessibilityHints.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="mb-2 font-medium">Accessibility notes</p>
                  <ul className="text-muted-foreground list-inside list-disc space-y-1">
                    {selected.accessibilityHints.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              {selected?.members.some((m) => m._id === user?._id) ? "Close" : "Cancel"}
            </Button>
            {selected && !selected.members.some((m) => m._id === user?._id) && (
              <Button
                variant={selected.isPrivate ? "outline" : "default"}
                onClick={() => handleJoin(selected)}
                disabled={joining === selected._id}
              >
                {joining === selected._id
                  ? "Sending…"
                  : selected.isPrivate
                    ? "Request to join"
                    : "Join group"}
              </Button>
            )}
            {selected?.members.some((m) => m._id === user?._id) && (
              <Button variant="secondary" disabled className="gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Joined
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
