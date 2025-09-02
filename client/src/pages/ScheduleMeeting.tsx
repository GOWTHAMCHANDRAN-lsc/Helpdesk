import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Users, Video } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Layout from "@/components/SimpleLayout";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

const meetingSchema = z.object({
  title: z.string().min(3, "Title is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  attendees: z.array(z.string().email()).min(1, "Add at least one attendee"),
  location: z.string().optional(),
  description: z.string().optional(),
  sendReminder: z.boolean().optional().default(false),
  reminderNote: z.string().optional(),
});

type MeetingForm = z.infer<typeof meetingSchema>;
type EmailSuggestion = { email: string; name?: string };

const tokenizeEmails = (input: string): string[] =>
  input.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);

export default function ScheduleMeetingPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const form = useForm<MeetingForm>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      attendees: [],
      sendReminder: false,
    },
  });

  const [attendeeInput, setAttendeeInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: emailSuggestions = [] } = useQuery<EmailSuggestion[]>({
    queryKey: ["/api/users/emails", { q: attendeeInput }],
    enabled: attendeeInput.trim().length > 0,
    select: (rows: any) => rows as EmailSuggestion[],
  });

  const onSubmit = async (values: MeetingForm) => {
    setLoading(true);
    try {
      let location = values.location;

      if (!location) {
        const startDateTime = new Date(`${values.date}T${values.time}`);
        const endDateTime = new Date(startDateTime.getTime() + 30 * 60000);

        const gmeetResp = await fetch("/api/gmeet/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            title: values.title,
            description: values.description,
            start: startDateTime.toISOString(),
            end: endDateTime.toISOString(),
            attendees: values.attendees,
          }),
        });

        const gmeetData = await gmeetResp.json();

        if (gmeetData.meetLink) {
          location = gmeetData.meetLink;
        } else {
          toast({
            title: "Error",
            description: "Failed to create Google Meet link",
            variant: "destructive",
          });
          return;
        }
      }

      const resp = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...values, location }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || "Failed to schedule meeting");
      }

      toast({
        title: "Meeting scheduled",
        description: data.meetingLink
          ? `Link: ${data.meetingLink}`
          : `${values.title} on ${values.date} at ${values.time}`,
      });

      form.reset();
      setAttendeeInput("");
      // Proactively refresh meetings list so dashboard shows the new item immediately
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      queryClient.refetchQueries({ queryKey: ['/api/meetings'] });
      // Navigate to dashboard so the upcoming meetings widget refreshes visibly
      navigate("/dashboard");
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to schedule meeting",
        variant: "destructive",
      });
      console.log(e);
  }
  setLoading(false);
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-white via-teal-50 to-blue-100 dark:from-gray-900 dark:via-teal-900 dark:to-blue-950 p-6">
        <div className="w-full max-w-2xl mx-auto">
          <div className="rounded-xl shadow bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-2 border-teal-400 dark:border-blue-900 p-8">
            <h2 className="text-xl font-bold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-3">
              <Video className="w-7 h-7" /> Schedule Meeting
            </h2>
            <p className="text-base text-gray-600 dark:text-gray-300 mb-8">Send a calendar invite to participants</p>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
              {/* Meeting Details */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary-600 dark:text-primary-300">
                  Meeting Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block font-medium mb-1">Title</label>
                    <Input placeholder="Team sync" {...form.register("title")} />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Date</label>
                    <Input type="date" {...form.register("date")} />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Time</label>
                    <Input type="time" {...form.register("time")} />
                  </div>
                </div>
              </div>

              {/* Attendees */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary-600 dark:text-primary-300">
                  Attendees
                </h3>
                <label className="block font-medium mb-1">Add Participants</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(form.watch("attendees") || []).map((email: string) => (
                    <span
                      key={email}
                      className="inline-flex items-center px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-xs"
                    >
                      {email}
                      <button
                        type="button"
                        className="ml-2"
                        onClick={() =>
                          form.setValue(
                            "attendees",
                            (form.getValues("attendees") as string[]).filter(
                              e => e !== email
                            )
                          )
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="relative">
                  <Input
                    placeholder="Type an email to add"
                    value={attendeeInput}
                    onChange={e => {
                      setAttendeeInput(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onKeyDown={e => {
                      if (
                        (e.key === "Enter" || e.key === "," || e.key === "Tab") &&
                        attendeeInput.trim() !== ""
                      ) {
                        e.preventDefault();
                        const emails = tokenizeEmails(attendeeInput);
                        const next = Array.from(
                          new Set([...(form.getValues("attendees") || []), ...emails])
                        );
                        form.setValue("attendees", next);
                        setAttendeeInput("");
                        setShowSuggestions(false);
                      }
                    }}
                  />
                  <Users className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  {showSuggestions &&
                    attendeeInput.trim() &&
                    (emailSuggestions as EmailSuggestion[]).length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow">
                        {(emailSuggestions as EmailSuggestion[]).map(s => (
                          <div
                            key={s.email}
                            className="px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                            onClick={() => {
                              const next = Array.from(
                                new Set([...(form.getValues("attendees") || []), s.email])
                              );
                              form.setValue("attendees", next);
                              setAttendeeInput("");
                              setShowSuggestions(false);
                            }}
                          >
                            <div className="text-sm font-medium">{s.email}</div>
                            <div className="text-xs text-muted-foreground">
                              {s.name || ""}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              </div>

              {/* Meeting Link */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary-600 dark:text-primary-300">
                  Meeting Link
                </h3>
                <label className="block font-medium mb-1">Google Meet Link</label>
                <div className="relative">
                  <Input
                    placeholder="https://meet.google.com/xyz-abcd-efg"
                    {...form.register("location")}
                  />
                  <Video className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
              </div>

              {/* Agenda */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-primary-600 dark:text-primary-300">
                  Agenda / Notes
                </h3>
                <Textarea
                  rows={3}
                  placeholder="Add talking points or context..."
                  {...form.register("description")}
                />
              </div>

              {/* Reminder */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={!!form.watch("sendReminder")}
                    onCheckedChange={v => form.setValue("sendReminder", !!v)}
                  />
                  <label>Send reminder email to attendees</label>
                </div>
                <div>
                  <label className="block font-medium mb-1">Reminder note</label>
                  <Textarea
                    rows={2}
                    placeholder="Include timing and details"
                    {...form.register("reminderNote")}
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 text-lg rounded-full"
                  disabled={loading}
                >
                  {loading && <Loader2 className="animate-spin mr-2" />}
                  Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
