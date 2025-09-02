import { 
  Home, 
  Ticket, 
  Users, 
  Settings, 
  BarChart3, 
  MessageSquare,
  Plus,
  Bell,
  Search,
  Building2,
  ChevronDown,
  LogOut
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ isCollapsed = false }: SidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const mainNavItems = [
    {
      title: 'Dashboard',
      href: '/dashboard',
      icon: Home,
      badge: null,
    },
    {
      title: 'My Tickets',
      href: '/tickets',
      icon: Ticket,
      badge: '5',
    },
    {
      title: 'Create Ticket',
      href: '/create-ticket',
      icon: Plus,
      badge: null,
    },
    {
      title: 'Messages',
      href: '/messages',
      icon: MessageSquare,
      badge: '2',
    },
  ];

  const adminNavItems = [
    {
      title: 'All Tickets',
      href: '/admin/tickets',
      icon: Ticket,
      badge: '12',
    },
    {
      title: 'Users',
      href: '/admin/users',
      icon: Users,
      badge: null,
    },
    {
      title: 'Analytics',
      href: '/admin/analytics',
      icon: BarChart3,
      badge: null,
    },
    {
      title: 'Settings',
      href: '/admin/settings',
      icon: Settings,
      badge: null,
    },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard' && location === '/') return true;
    return location === href || location.startsWith(href + '/');
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  };

  return (
    <div className={cn(
      "flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
            >
              <h1 className="text-lg font-bold gradient-primary bg-clip-text text-transparent">
                Helpdesk
              </h1>
              <p className="text-xs text-muted-foreground">Enterprise System</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Search */}
      {!isCollapsed && (
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tickets..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {!isCollapsed && (
        <div className="px-4 pb-4">
          <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg">
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        <nav className="p-2 space-y-1">
          {/* Main Navigation */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-2 py-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Main
                </h3>
              </div>
            )}
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              
              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                      active
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-r-2 border-blue-600"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                    )}
                  >
                    <Icon className={cn(
                      "w-5 h-5 flex-shrink-0",
                      isCollapsed ? "mr-0" : "mr-3",
                      active ? "text-blue-600" : "text-muted-foreground group-hover:text-gray-700 dark:group-hover:text-gray-300"
                    )} />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1">{item.title}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="ml-auto text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </div>

          {/* Admin Navigation */}
          {user?.role === 'admin' && (
            <div className="space-y-1 pt-4">
              {!isCollapsed && (
                <div className="px-2 py-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Administration
                  </h3>
                </div>
              )}
              {adminNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                
                return (
                  <Link key={item.href} href={item.href}>
                    <motion.div
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                        active
                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-r-2 border-blue-600"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                      )}
                    >
                      <Icon className={cn(
                        "w-5 h-5 flex-shrink-0",
                        isCollapsed ? "mr-0" : "mr-3",
                        active ? "text-blue-600" : "text-muted-foreground group-hover:text-gray-700 dark:group-hover:text-gray-300"
                      )} />
                      {!isCollapsed && (
                        <>
                          <span className="flex-1">{item.title}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="ml-auto text-xs">
                              {item.badge}
                            </Badge>
                          )}
                        </>
                      )}
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        {!isCollapsed ? (
          <div className="space-y-3">
            {/* Notifications */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Notifications</span>
              </div>
              <Badge variant="destructive" className="text-xs">
                3
              </Badge>
            </div>

            {/* User Info */}
            <div className="flex items-center space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.first_name} ${user?.last_name}`} />
                <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-xs">
                  {user ? getInitials(user.first_name, user.last_name) : 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user ? `${user.first_name} ${user.last_name}` : 'User'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.department || 'Department'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.first_name} ${user?.last_name}`} />
              <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-xs">
                {user ? getInitials(user.first_name, user.last_name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}