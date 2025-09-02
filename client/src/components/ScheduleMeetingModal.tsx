import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Users, Video, MapPin, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
const tokenizeEmails = (input: string): string[] => input.split(/[\,\s]+/).map(s => s.trim()).filter(Boolean);

interface ScheduleMeetingModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function ScheduleMeetingModal({ open, onOpenChange }: ScheduleMeetingModalProps) {
	const { toast } = useToast();
	const form = useForm<MeetingForm>({
		resolver: zodResolver(meetingSchema),
		defaultValues: {
			attendees: [],
			sendReminder: false,
		},
	});

	const [attendeeInput, setAttendeeInput] = useState("");
	const [showSuggestions, setShowSuggestions] = useState(false);
	const { data: emailSuggestions = [] } = useQuery<EmailSuggestion[]>({
		queryKey: ["/api/users/emails", { q: attendeeInput }],
		enabled: attendeeInput.trim().length > 0,
		select: (rows: any) => rows as EmailSuggestion[],
	});

const onSubmit = async (values: MeetingForm) => {
  try {
	let location = values.location;
	// If no Google Meet link provided, create one via backend
	if (!location) {
	  const startDateTime = new Date(`${values.date}T${values.time}`);
	  const endDateTime = new Date(startDateTime.getTime() + 30 * 60000); // default 30 min
	  const gmeetResp = await fetch('/api/gmeet/create', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
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
		toast({ title: 'Error', description: 'Failed to create Google Meet link', variant: 'destructive' });
		return;
	  }
	}
	const resp = await apiRequest('POST', '/api/meetings', { ...values, location });
	const data = await (resp as Response).json();
	toast({ title: 'Meeting scheduled', description: data.meetingLink ? `Link: ${data.meetingLink}` : `${values.title} on ${values.date} at ${values.time}` });
	onOpenChange(false);
	form.reset();
	setAttendeeInput("");
	console.log(data);
  } catch (e) {
	toast({ title: 'Error', description: 'Failed to schedule meeting', variant: 'destructive' });
	console.log(e);
  }
};

// Only Google Meet allowed, so no meetingType

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-xl">
				<DialogHeader>
					<DialogTitle>Schedule a Meeting</DialogTitle>
					<DialogDescription>Send a calendar invite to participants</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<FormField
								control={form.control}
								name="title"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Title</FormLabel>
										<FormControl>
											<Input placeholder="Team sync" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="date"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Date</FormLabel>
										<FormControl>
											<Input type="date" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="time"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Time</FormLabel>
										<FormControl>
											<Input type="time" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

{/* Only Google Meet allowed, so no meetingType field */}
						</div>

						<FormField
							control={form.control}
							name="attendees"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Attendees</FormLabel>
									<FormControl>
										<div>
											<div className="flex flex-wrap gap-2 mb-2">
												{(field.value || []).map((email: string) => (
													<span key={email} className="inline-flex items-center px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-xs">
														{email}
														<button type="button" className="ml-2" onClick={() => field.onChange((field.value as string[]).filter(e => e !== email))}>
															<X className="h-3 w-3" />
														</button>
													</span>
												))}
											</div>
											<div className="relative">
												<Input
													placeholder="Type an email to add"
													value={attendeeInput}
													onChange={(e) => { setAttendeeInput(e.target.value); setShowSuggestions(true); }}
													onKeyDown={(e) => {
														if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && attendeeInput.trim() !== '') {
															e.preventDefault();
															const emails = tokenizeEmails(attendeeInput);
															const next = Array.from(new Set([...(field.value || []), ...emails]));
															field.onChange(next);
															setAttendeeInput('');
															setShowSuggestions(false);
														}
													}}
												/>
												<Users className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
												{showSuggestions && attendeeInput.trim() && (emailSuggestions as EmailSuggestion[]).length > 0 && (
													<div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded shadow">
														{(emailSuggestions as EmailSuggestion[]).map((s) => (
															<div key={s.email} className="px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
																onClick={() => {
																const next = Array.from(new Set([...(field.value || []), s.email]));
																field.onChange(next);
																setAttendeeInput('');
																setShowSuggestions(false);
															}}>
																<div className="text-sm font-medium">{s.email}</div>
																<div className="text-xs text-muted-foreground">{s.name || ''}</div>
															</div>
														))}
													</div>
												)}
											</div>
											</div>
										</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

<FormField
  control={form.control}
  name="location"
  render={({ field }) => (
	<FormItem>
	  <FormLabel>Google Meet Link</FormLabel>
	  <FormControl>
		<div className="relative">
		  <Input placeholder="https://meet.google.com/xyz-abcd-efg" {...field} />
		  <Video className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
		</div>
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
									<FormLabel>Agenda / Notes</FormLabel>
									<FormControl>
										<Textarea rows={3} placeholder="Add talking points or context..." {...field} />
									</FormControl>
								</FormItem>
							)}
						/>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<FormField
								control={form.control}
								name="sendReminder"
								render={({ field }) => (
									<FormItem className="flex items-center space-x-2">
										<FormControl>
											<Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(!!v)} />
										</FormControl>
										<FormLabel>Send reminder email to attendees</FormLabel>
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="reminderNote"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Reminder note</FormLabel>
										<FormControl>
											<Textarea rows={2} placeholder="Include timing and details" {...field} />
										</FormControl>
									</FormItem>
								)}
							/>
						</div>

						<div className="flex justify-end space-x-3 pt-2">
							<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
								Cancel
							</Button>
							<Button type="submit" className="bg-primary-500 hover:bg-primary-600">Schedule</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
} 