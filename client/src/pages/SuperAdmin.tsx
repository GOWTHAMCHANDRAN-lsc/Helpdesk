import { useQuery } from '@tanstack/react-query';
import Layout from '@/components/SimpleLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Link } from 'wouter';

export default function SuperAdmin() {
	const { data: stats } = useQuery<{ total: number; open: number; in_progress: number; resolved: number; closed: number }>({ queryKey: ['/api/stats'] });
	return (
		<Layout>
			<div className="p-6 space-y-6">
				<h1 className="text-2xl font-bold">Super Admin</h1>
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<Card>
						<CardHeader><CardTitle>Total</CardTitle><CardDescription>All tickets</CardDescription></CardHeader>
						<CardContent className="text-3xl font-bold">{stats?.total ?? 0}</CardContent>
					</Card>
					<Card>
						<CardHeader><CardTitle>Open</CardTitle></CardHeader>
						<CardContent className="text-3xl font-bold">{stats?.open ?? 0}</CardContent>
					</Card>
					<Card>
						<CardHeader><CardTitle>In Progress</CardTitle></CardHeader>
						<CardContent className="text-3xl font-bold">{stats?.in_progress ?? 0}</CardContent>
					</Card>
					<Card>
						<CardHeader><CardTitle>Resolved</CardTitle></CardHeader>
						<CardContent className="text-3xl font-bold">{stats?.resolved ?? 0}</CardContent>
					</Card>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<Card>
						<CardHeader><CardTitle>Manage Users</CardTitle></CardHeader>
						<CardContent><Link href="/admin/users" className="text-blue-600">Go to Users</Link></CardContent>
					</Card>
					<Card>
						<CardHeader><CardTitle>All Tickets</CardTitle></CardHeader>
						<CardContent><Link href="/tickets" className="text-blue-600">View Tickets</Link></CardContent>
					</Card>
					<Card>
						<CardHeader><CardTitle>Analytics</CardTitle></CardHeader>
						<CardContent><Link href="/admin/analytics" className="text-blue-600">View Analytics</Link></CardContent>
					</Card>
				</div>
			</div>
		</Layout>
	);
}
