import { useEffect, useState } from 'react';
import Layout from '@/components/SimpleLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface Prefs {
	notifications: boolean;
	dailySummary: boolean;
	defaultPriority: 'low' | 'medium' | 'high';
}

const DEFAULT_PREFS: Prefs = {
	notifications: true,
	dailySummary: false,
	defaultPriority: 'medium',
};

export default function AdminSettings() {
	const { toast } = useToast();
	const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		(async () => {
			try {
				const res = await fetch('/api/admin/prefs', { credentials: 'include' });
				if (res.ok) {
					const data = await res.json();
					setPrefs(p => ({ ...p, notifications: !!data.notifications, dailySummary: !!data.daily_summary }));
				} else {
					// fallback to local
					const saved = localStorage.getItem('admin-settings');
					if (saved) setPrefs(JSON.parse(saved));
				}
			} catch {
				const saved = localStorage.getItem('admin-settings');
				if (saved) setPrefs(JSON.parse(saved));
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	const save = async () => {
		setSaving(true);
		try {
			const res = await fetch('/api/admin/prefs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ notifications: prefs.notifications, dailySummary: prefs.dailySummary }),
			});
			if (!res.ok) throw new Error('Failed');
			localStorage.setItem('admin-settings', JSON.stringify(prefs));
			toast({ title: 'Settings saved' });
		} catch {
			toast({ title: 'Failed to save settings', variant: 'destructive' });
		} finally {
			setSaving(false);
		}
	};

	return (
		<Layout>
			<div className="p-6 space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Admin Settings</CardTitle>
						<CardDescription>Configure default behaviors</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="font-medium">Enable notifications</p>
								<p className="text-sm text-muted-foreground">Send email notifications for ticket activity (admins and super admins)</p>
							</div>
							<Switch disabled={loading} checked={prefs.notifications} onCheckedChange={(v) => setPrefs(p => ({ ...p, notifications: v }))} />
						</div>

						<div className="flex items-center justify-between">
							<div>
								<p className="font-medium">Daily summary</p>
								<p className="text-sm text-muted-foreground">Receive a daily email summary of ticket stats (admins and super admins)</p>
							</div>
							<Switch disabled={loading} checked={prefs.dailySummary} onCheckedChange={(v) => setPrefs(p => ({ ...p, dailySummary: v }))} />
						</div>

						<div>
							<p className="font-medium mb-2">Default ticket priority</p>
							<Select disabled={loading} value={prefs.defaultPriority} onValueChange={(v) => setPrefs(p => ({ ...p, defaultPriority: v as Prefs['defaultPriority'] }))}>
								<SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
								<SelectContent>
									<SelectItem value="low">Low</SelectItem>
									<SelectItem value="medium">Medium</SelectItem>
									<SelectItem value="high">High</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="flex justify-end">
							<Button disabled={saving || loading} onClick={save} className="bg-primary-500 hover:bg-primary-600">Save Changes</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</Layout>
	);
} 