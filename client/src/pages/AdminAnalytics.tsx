import Layout from '@/components/SimpleLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const weeklyData = [
	{ day: 'Mon', open: 12, resolved: 5 },
	{ day: 'Tue', open: 15, resolved: 8 },
	{ day: 'Wed', open: 10, resolved: 12 },
	{ day: 'Thu', open: 18, resolved: 9 },
	{ day: 'Fri', open: 20, resolved: 16 },
];

type TicketStats = {
	total: number;
	open: number;
	in_progress: number;
	resolved: number;
	closed: number;
};

export default function AdminAnalytics() {
	const { data: stats } = useQuery<TicketStats>({ queryKey: ['/api/stats'] });

	return (
		<Layout>
			<div className="p-6 space-y-6">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<Card>
						<CardHeader>
							<CardTitle>Total Tickets</CardTitle>
							<CardDescription>All statuses</CardDescription>
						</CardHeader>
						<CardContent className="text-3xl font-bold">{stats?.total ?? 0}</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>Open</CardTitle>
							<CardDescription>Currently open</CardDescription>
						</CardHeader>
						<CardContent className="text-3xl font-bold text-yellow-600">{stats?.open ?? 0}</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>Resolved</CardTitle>
							<CardDescription>This week</CardDescription>
						</CardHeader>
						<CardContent className="text-3xl font-bold text-green-600">{stats?.resolved ?? 0}</CardContent>
					</Card>
				</div>

				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle>Weekly Volume</CardTitle>
								<CardDescription>Open vs Resolved</CardDescription>
							</div>
							<TrendingUp className="text-green-600" />
						</div>
					</CardHeader>
					<CardContent style={{ height: 300 }}>
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={weeklyData}>
								<XAxis dataKey="day" stroke="#94a3b8" />
								<YAxis stroke="#94a3b8" />
								<Tooltip />
								<Area type="monotone" dataKey="open" stroke="#f59e0b" fill="#fef3c7" />
								<Area type="monotone" dataKey="resolved" stroke="#22c55e" fill="#dcfce7" />
							</AreaChart>
						</ResponsiveContainer>
					</CardContent>
				</Card>
			</div>
		</Layout>
	);
} 