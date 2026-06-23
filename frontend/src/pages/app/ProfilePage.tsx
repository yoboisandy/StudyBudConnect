import { useState, useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Save, Edit2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { CreatableTagInput } from "@/components/shared/CreatableTagInput"
import { AvailabilityPicker } from "@/components/shared/AvailabilityPicker"
import { MultiSelectCheckbox } from "@/components/shared/MultiSelectCheckbox"
import { useAuthStore } from "@/stores/authStore"
import api from "@/lib/api"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const LEARNING_STYLES = [
  { value: "visual", label: "Visual — diagrams, charts, videos" },
  { value: "auditory", label: "Auditory — lectures, discussions" },
  { value: "reading-writing", label: "Reading/Writing — notes, texts" },
  { value: "mixed", label: "Mixed — combination of above" },
]

const ACCESSIBILITY_OPTIONS = [
  { value: "screen-reader", label: "Screen reader" },
  { value: "none", label: "No specific needs" },
]

const COMM_OPTIONS = [
  { value: "text-chat", label: "Text chat" },
]

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  courses: z.array(z.string()).min(1, "Add at least one course"),
  learningStyle: z.string().min(1, "Select a learning style"),
  availability: z.array(z.object({ day: z.string(), slots: z.array(z.string()) })),
  accessibilityNeeds: z.array(z.string()),
  communicationPrefs: z.array(z.string()).min(1, "Select at least one"),
})
type FormValues = z.infer<typeof schema>

export default function ProfilePage() {
  const { user, setUser } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.name ?? "",
      courses: user?.courses ?? [],
      learningStyle: user?.learningStyle ?? "",
      availability: user?.availability ?? [],
      accessibilityNeeds: user?.accessibilityNeeds ?? [],
      communicationPrefs: user?.communicationPrefs ?? [],
    },
  })

  const { formState: { isSubmitting } } = form

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name ?? "",
        courses: user.courses ?? [],
        learningStyle: user.learningStyle ?? "",
        availability: user.availability ?? [],
        accessibilityNeeds: user.accessibilityNeeds ?? [],
        communicationPrefs: user.communicationPrefs ?? [],
      })
    }
  }, [user])

  const onSubmit = async (values: FormValues) => {
    try {
      const { data } = await api.put("/users/me", values)
      setUser(data)
      toast.success("Profile saved!")
      setIsEditing(false)
    } catch {
      toast.error("Failed to save profile")
    }
  }

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "SB"

  const getLearningStyleLabel = (value: string) => LEARNING_STYLES.find((s) => s.value === value)?.label || value
  const getCommPrefLabel = (value: string) => COMM_OPTIONS.find((c) => c.value === value)?.label || value
  const getA11yLabel = (value: string) => ACCESSIBILITY_OPTIONS.find((a) => a.value === value)?.label || value

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  const SLOTS = ["Morning", "Afternoon", "Evening"]

  return (
    <div className="mx-auto max-w-6xl w-full space-y-6">
      {/* Header with avatar and edit button */}
      <Card>
        <CardContent>
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.avatar} alt={user?.name} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xl font-semibold">{user?.name || "Complete your profile"}</p>
                <p className="text-muted-foreground text-sm">{user?.email}</p>
              </div>
            </div>
            <Button
              variant={isEditing ? "outline" : "default"}
              size="sm"
              onClick={() => {
                if (isEditing) {
                  setIsEditing(false)
                  form.reset()
                } else {
                  setIsEditing(true)
                }
              }}
              className="gap-2"
            >
              {isEditing ? (
                <>
                  <X className="h-4 w-4" />
                  Cancel
                </>
              ) : (
                <>
                  <Edit2 className="h-4 w-4" />
                  Edit
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* View mode */}
      {!isEditing ? (
        <div className="space-y-6">
          {/* Basic info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Full name</p>
                <p className="text-lg">{user?.name || "—"}</p>
              </div>
              {user?.courses && user.courses.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Courses</p>
                  <div className="flex flex-wrap gap-2">
                    {user.courses.map((c) => (
                      <Badge key={c} variant="secondary">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Learning prefs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Learning preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {user?.learningStyle && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Learning style</p>
                  <p className="text-base">{getLearningStyleLabel(user.learningStyle)}</p>
                </div>
              )}
              {user?.communicationPrefs && user.communicationPrefs.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Communication preferences</p>
                  <div className="flex flex-wrap gap-2">
                    {user.communicationPrefs.map((c) => (
                      <Badge key={c} variant="outline">{getCommPrefLabel(c)}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Availability */}
          {user?.availability && user.availability.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Availability</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {user.availability.map((a) => (
                    <div key={a.day}>
                      <p className="text-sm font-medium">{a.day}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {a.slots.map((s) => (
                          <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Accessibility */}
          {user?.accessibilityNeeds && user.accessibilityNeeds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Accessibility needs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {user.accessibilityNeeds.map((a) => (
                    <Badge key={a}>{getA11yLabel(a)}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* Edit mode */
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
            {/* Basic info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Basic information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Controller
                  control={form.control}
                  name="courses"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Courses</FormLabel>
                      <FormControl>
                        <CreatableTagInput
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="e.g. CS739, MATH201 — press Enter to add"
                        />
                      </FormControl>
                      <FormDescription>Type a course code and press Enter or comma.</FormDescription>
                      {fieldState.error && (
                        <p className="text-destructive text-sm font-medium">{fieldState.error.message}</p>
                      )}
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Learning prefs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Learning preferences</CardTitle>
                <CardDescription>Helps us match you with compatible study partners.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="learningStyle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Learning style</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your primary learning style" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {LEARNING_STYLES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Controller
                  control={form.control}
                  name="communicationPrefs"
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <FormLabel>Communication preferences</FormLabel>
                      <FormControl>
                        <MultiSelectCheckbox options={COMM_OPTIONS} value={field.value} onChange={field.onChange} />
                      </FormControl>
                      {fieldState.error && (
                        <p className="text-destructive text-sm font-medium">{fieldState.error.message}</p>
                      )}
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Availability */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Availability</CardTitle>
                <CardDescription>Select when you're generally available to study.</CardDescription>
              </CardHeader>
              <CardContent>
                <Controller
                  control={form.control}
                  name="availability"
                  render={({ field }) => (
                    <AvailabilityPicker value={field.value} onChange={field.onChange} />
                  )}
                />
              </CardContent>
            </Card>

            {/* Accessibility */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Accessibility needs</CardTitle>
                <CardDescription>Generates accommodation cues for your study groups.</CardDescription>
              </CardHeader>
              <CardContent>
                <Controller
                  control={form.control}
                  name="accessibilityNeeds"
                  render={({ field }) => (
                    <MultiSelectCheckbox options={ACCESSIBILITY_OPTIONS} value={field.value} onChange={field.onChange} />
                  )}
                />
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1 gap-2" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSubmitting ? "Saving…" : "Save profile"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditing(false)
                  form.reset()
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  )
}
