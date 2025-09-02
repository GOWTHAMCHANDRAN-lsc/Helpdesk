import { useMemo, useState } from 'react';
import Layout from '@/components/SimpleLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

interface UserRow {
	id: string;
	employeeId: string;
	firstName: string;
	lastName: string;
	email: string;
	department: string;
	role: 'super_admin' | 'admin' | 'employee';
}

export default function AdminUsers() {
	const { user } = useAuth();
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const { data: users = [] } = useQuery<UserRow[]>({ queryKey: ['/api/admin/users'] });
	const [search, setSearch] = useState('');
	const [roleFilter, setRoleFilter] = useState<string>('all');
	const [editing, setEditing] = useState<UserRow | null>(null);
	const [newRole, setNewRole] = useState<UserRow['role']>('employee');
	const [creatingOpen, setCreatingOpen] = useState(false);
	const [form, setForm] = useState({ employeeId: '', username: '', firstName: '', lastName: '', email: '', departmentId: '', role: 'employee', password: '' });

	const createUser = useMutation({
		mutationFn: async () => {
			await apiRequest('POST', '/api/admin/users', form);
		},
		onSuccess: () => {
			toast({ title: 'User created' });
			setForm({ employeeId: '', username: '', firstName: '', lastName: '', email: '', departmentId: '', role: 'employee', password: '' });
			setCreatingOpen(false);
			queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
		},
		onError: () => toast({ title: 'Failed to create user', variant: 'destructive' }),
	});

	const updateRole = useMutation({
		mutationFn: async () => {
			await apiRequest('PATCH', `/api/admin/users/${editing!.id}/role`, { role: newRole });
		},
		onSuccess: () => {
			toast({ title: 'Role updated' });
			setEditing(null);
			queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
		},
		onError: () => toast({ title: 'Failed to update role', variant: 'destructive' }),
	});

	const filtered = useMemo(() => {
		return users.filter(u => {
			const matchesSearch = `${u.firstName} ${u.lastName} ${u.email} ${u.employeeId}`.toLowerCase().includes(search.toLowerCase());
			const matchesRole = roleFilter === 'all' ? true : u.role === roleFilter;
			return matchesSearch && matchesRole;
		});
	}, [users, search, roleFilter]);

	const roleBadge = (role: UserRow['role']) => {
		switch (role) {
			case 'super_admin': return <Badge className="priority-high">Super Admin</Badge>;
			case 'admin': return <Badge className="priority-high">Admin</Badge>;
			default: return <Badge>Employee</Badge>;
		}
	};

	const canSeeSuperAdmin = user?.role === 'super_admin';

	return (
		<Layout>
			<div className="p-6 space-y-6">
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle>Users Management</CardTitle>
								<CardDescription>Manage roles and departments</CardDescription>
							</div>
							<div className="flex gap-3 items-center">
								<div className="w-64">
									<Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
								</div>
								<Select onValueChange={(v) => setRoleFilter(v)} defaultValue="all">
									<SelectTrigger className="w-[180px]"><SelectValue placeholder="Role" /></SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All Roles</SelectItem>
										{canSeeSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
										<SelectItem value="admin">Admin</SelectItem>
										<SelectItem value="employee">Employee</SelectItem>
									</SelectContent>
								</Select>
								<Button onClick={() => setCreatingOpen(true)}>Create User</Button>
							</div>
						</div>
					</CardHeader>
					<CardContent className="p-0">
						<div className="overflow-x-auto">
							<Table>
								<TableHeader className="bg-gray-50 dark:bg-gray-700">
									<TableRow>
										<TableHead>Employee ID</TableHead>
										<TableHead>Name</TableHead>
										<TableHead>Email</TableHead>
										<TableHead>Department</TableHead>
										<TableHead>Role</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filtered.map(u => (
										<TableRow key={u.id}>
											<TableCell>{u.employeeId}</TableCell>
											<TableCell>{u.firstName} {u.lastName}</TableCell>
											<TableCell>{u.email}</TableCell>
											<TableCell>{u.department}</TableCell>
											<TableCell>{roleBadge(u.role)}</TableCell>
											<TableCell className="text-right">
												<Button variant="outline" size="sm" onClick={() => { setEditing(u); setNewRole(u.role); }}>Edit Role</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>

				<Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>Edit Role</DialogTitle>
						</DialogHeader>
						<div className="space-y-4">
							<p className="text-sm text-muted-foreground">{editing?.firstName} {editing?.lastName} — {editing?.email}</p>
							<Select onValueChange={(v) => setNewRole(v as UserRow['role'])} defaultValue={editing?.role || 'employee'}>
								<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
								<SelectContent>
									{canSeeSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
									<SelectItem value="admin">Admin</SelectItem>
									<SelectItem value="employee">Employee</SelectItem>
								</SelectContent>
							</Select>
							<div className="flex justify-end gap-2">
								<Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
								<Button onClick={() => updateRole.mutate()} disabled={updateRole.isPending}>Save</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>

				<Dialog open={creatingOpen} onOpenChange={setCreatingOpen}>
					<DialogContent className="max-w-2xl">
						<DialogHeader>
							<DialogTitle>Create User</DialogTitle>
						</DialogHeader>
						<div className="space-y-3">
							<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
								<Input placeholder="Employee ID" value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} />
								<Input placeholder="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
								<Input placeholder="First Name" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
								<Input placeholder="Last Name" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
								<Input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
								{canSeeSuperAdmin && <Input placeholder="Department ID (optional)" value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} />}
								<Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
									<SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
									<SelectContent>
										{canSeeSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
										<SelectItem value="admin">Admin</SelectItem>
										<SelectItem value="employee">Employee</SelectItem>
									</SelectContent>
								</Select>
								<Input type="password" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
							</div>
							<div className="flex justify-end">
								<Button onClick={() => createUser.mutate()} disabled={createUser.isPending}>Create</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</Layout>
	);
} 