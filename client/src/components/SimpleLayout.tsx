
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import lscLogo from "../assets/lsc-logo.png";

interface LayoutProps {
	children: React.ReactNode;
}

function SimpleLayout({ children }: LayoutProps) {
	const { logout, user } = useAuth();
	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
			<header className="sticky top-0 z-30 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
				<div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
				<div className="flex items-center gap-4 px-6 py-2 rounded-xl shadow bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800" style={{ minHeight: '64px' }}>
					<Link href="/">
						<img src={lscLogo} alt="LSC Logo" className="h-10 w-auto bg-white rounded shadow mr-3 border border-gray-200" style={{ display: 'inline-block', verticalAlign: 'middle' }} />
						<span className="text-2xl font-bold text-blue-900 dark:text-blue-200 cursor-pointer align-middle">Helpdesk</span>
					</Link>
					<nav className="hidden md:flex items-center gap-4 text-base text-gray-700 dark:text-gray-200 font-medium">
							<Link href="/dashboard">Dashboard</Link>
							<Link href="/tickets">Tickets</Link>
							{user?.role === 'admin' || user?.role === 'super_admin' ? (
								<>
									<Link href="/admin/users">Users</Link>
									<Link href="/admin/analytics">Analytics</Link>
									<Link href="/admin/settings">Settings</Link>
								</>
							) : null}
						</nav>
					</div>
					<div className="flex items-center gap-3">
						<span className="text-sm text-gray-600 dark:text-gray-300 hidden sm:inline">{user?.first_name} ({user?.role})</span>
						<Button size="sm" variant="outline" onClick={logout}>Logout</Button>
					</div>
				</div>
			</header>
			<div className="flex">
				<div className="flex-1 p-6">
					{children}
				</div>
			</div>
		</div>
	);
}

export default SimpleLayout;