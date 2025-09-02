import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/components/ui/theme-provider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, Moon, Sun, ChevronDown } from "lucide-react";
import lscLogo from "../assets/lsc-logo.png";
import { useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";

export function Header() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState<Array<{ title: string; body?: string; ts: string }>>([]);
  const isLoginPage = window.location.pathname === '/login';

  useWebSocket({
    onMessage: (msg) => {
      if (msg?.type === 'notification' && msg.notification) {
        const { title = 'Helpdesk', body = '' } = msg.notification || {};
        setNotifications((prev) => [{ title, body, ts: new Date().toISOString() }, ...prev].slice(0, 10));
      }
    },
  });

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const getRoleDisplayName = (role?: string) => {
    switch (role) {
      case "super_admin":
        return "Super Admin";
      case "admin":
        return "Admin";
      default:
        return "Employee";
    }
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case "super_admin":
        return "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300";
      case "admin":
        return "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300";
      default:
        return "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300";
    }
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            {!isLoginPage && (
              <div className="flex-shrink-0">
                <img src={lscLogo} alt="LSC Logo" className="h-12 w-auto" style={{ background: 'white', borderRadius: 8, padding: 2 }} />
              </div>
            )}
            {user && (
              <div className="hidden md:block">
                <Badge 
                  variant="outline" 
                  className={getRoleBadgeColor(user.role)}
                >
                  {getRoleDisplayName(user.role)}
                </Badge>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-0 overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-sm font-medium">Notifications</p>
                </div>
                {notifications.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">You're all caught up</div>
                ) : (
                  <div className="max-h-80 overflow-auto">
                    {notifications.map((n, idx) => (
                      <div key={idx} className="px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                        {n.body && <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
            
            {/* User Menu */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-3 h-auto p-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={undefined} />
                      <AvatarFallback className="bg-primary-500 text-white">
                        {getInitials(user.first_name, user.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:block font-medium text-gray-700 dark:text-gray-300">
                      {user.first_name || user.last_name 
                        ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                        : user.email || "User"
                      }
                    </span>
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-2">
                    <p className="text-sm font-medium">{user.first_name || user.last_name 
                      ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
                      : "User"
                    }</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                    {user.department && (
                      <p className="text-xs text-gray-500">{user.department}</p>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Profile Settings</DropdownMenuItem>
                  <DropdownMenuItem>Preferences</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => window.location.href = "/api/logout"}>
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
