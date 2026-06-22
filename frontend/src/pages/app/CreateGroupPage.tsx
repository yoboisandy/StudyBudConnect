import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Search, X, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import api from "@/lib/api"
import { toast } from "sonner"

const schema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  course: z.string().min(2, "Course code required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  isPrivate: z.boolean().optional(),
})
type FormValues = z.infer<typeof schema>

interface UserResult {
  _id: string
  name: string
  email: string
  avatar?: string
  courses?: string[]
}

export default function CreateGroupPage() {
  const navigate = useNavigate()
  const [userSearch, setUserSearch] = useState("")
  const [results, setResults] = useState<UserResult[]>([])
  const [invited, setInvited] = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", course: "", description: "", isPrivate: false },
  })

  const { formState: { isSubmitting } } = form

  useEffect(() => {
    if (!userSearch.trim()) { setResults([]); return }
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await api.get("/users/search", { params: { q: userSearch.trim() } })
        setResults(data)
      } catch {
        /* silent */
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => { if (searchRef.current) clearTimeout(searchRef.current) }
  }, [userSearch])

  const toggleInvite = (u: UserResult) => {
    setInvited((prev) =>
      prev.find((x) => x._id === u._id) ? prev.filter((x) => x._id !== u._id) : [...prev, u]
    )
  }

  const onSubmit = async (values: FormValues) => {
    try {
      const { data: group } = await api.post("/groups", values)
      // fire invitations (non-blocking)
      await Promise.allSettled(
        invited.map((u) =>
          api.post("/invitations", { groupId: group._id, inviteeId: u._id })
        )
      )
      toast.success("Group created!")
      navigate(`/app/chat/${group._id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? "Failed to create group")
    }
  }

  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
          {/* Group details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Group details</CardTitle>
              <CardDescription>Set up your study group's identity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. CS739 Wednesday crew" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="course"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. CS739" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What will this group focus on? When do you meet?"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Controller
                control={form.control}
                name="isPrivate"
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="isPrivate"
                      checked={!!field.value}
                      onCheckedChange={field.onChange}
                    />
                    <Label htmlFor="isPrivate" className="cursor-pointer font-normal">
                      Private group (invite only)
                    </Label>
                  </div>
                )}
              />
            </CardContent>
          </Card>

          {/* Invite members */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invite members</CardTitle>
              <CardDescription>Search and add people to invite. Optional.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {invited.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {invited.map((u) => (
                    <Badge key={u._id} variant="secondary" className="gap-1.5 pr-1.5">
                      {u.name}
                      <button
                        type="button"
                        onClick={() => toggleInvite(u)}
                        className="ml-0.5 rounded-full"
                        aria-label={`Remove ${u.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <div className="relative">
                <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  className="pl-9"
                  placeholder="Search by name or email"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>

              {searching && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </div>
              )}

              {results.length > 0 && (
                <ScrollArea className="h-48 rounded-md border">
                  <div className="divide-y">
                    {results.map((u) => {
                      const isSelected = !!invited.find((x) => x._id === u._id)
                      return (
                        <button
                          key={u._id}
                          type="button"
                          onClick={() => toggleInvite(u)}
                          className={`flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50 ${isSelected ? "bg-muted/30" : ""}`}
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={u.avatar} alt={u.name} />
                            <AvatarFallback className="text-xs">{initials(u.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{u.name}</p>
                            <p className="text-muted-foreground truncate text-xs">{u.email}</p>
                          </div>
                          {isSelected ? (
                            <X className="text-muted-foreground h-4 w-4 shrink-0" />
                          ) : (
                            <UserPlus className="text-muted-foreground h-4 w-4 shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Creating…" : "Create group"}
          </Button>
        </form>
      </Form>
    </div>
  )
}
