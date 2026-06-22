import { useEffect } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CreatableTagInput } from "@/components/shared/CreatableTagInput"
import { AvailabilityPicker } from "@/components/shared/AvailabilityPicker"
import { MultiSelectCheckbox } from "@/components/shared/MultiSelectCheckbox"
import { useAuthStore } from "@/stores/authStore"
import api from "@/lib/api"
import { toast } from "sonner"

const LEARNING_STYLES = [
  { value: "visual", label: "Visual — diagrams, charts, videos" },
  { value: "auditory", label: "Auditory — lectures, discussions" },
  { value: "reading-writing", label: "Reading/Writing — notes, texts" },
  // { value: "kinesthetic", label: "Kinesthetic — hands-on practice" },
  { value: "mixed", label: "Mixed — combination of above" },
]

const ACCESSIBILITY_OPTIONS = [
  { value: "screen-reader", label: "Screen reader" },
  { value: "captions", label: "Captions / subtitles" },
  { value: "keyboard-nav", label: "Keyboard navigation" },
  { value: "high-contrast", label: "High contrast" },
  { value: "none", label: "No specific needs" },
]

const COMM_OPTIONS = [
  { value: "text-chat", label: "Text chat" },
  // { value: "voice", label: "Voice call" },
  // { value: "video", label: "Video call" },
  // { value: "async", label: "Async (recorded/notes)" },
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
    } catch {
      toast.error("Failed to save profile")
    }
  }

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "SB"

  return (
    <div className="mx-auto max-w-6xl w-full space-y-6">
      {/* Avatar card */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={user?.avatar} alt={user?.name} />
              <AvatarFallback className="text-base">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{user?.name || "Complete your profile"}</p>
              <p className="text-muted-foreground text-sm">{user?.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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

          <Button type="submit" className="w-full gap-2" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isSubmitting ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </Form>
    </div>
  )
}
