import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import Layout from "../components/SimpleLayout";
import { StatsCards } from "@/components/StatsCards";
import { motion, AnimatePresence } from "framer-motion";
import { fadeInUp, staggerChildren, slideIn, pageTransition } from '@/lib/animations';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Users,
  Building2,
  Settings,
  Download,
  Search,
  UserCog,
  Shield,
  AlertTriangle,
  TrendingUp,
  Activity,
  Loader2,
} from "lucide-react";

interface Ticket {
  id: string;
  subject: string;
  createdAt: string;
  resolvedAt?: string;
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  department: {
    id: string;
    name: string;
  };
}

interface Department {
  id: string;
  name: string;
}

interface Company {
  id: string;
  name: string;
}

interface StatsType {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
}

interface User {
  id: string;
  role: string;
  first_name: string;
  last_name: string;
}

export default function AdminDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");

  // Redirect non-admin users
  useEffect(() => {
    if (!authLoading && user && user.role !== 'admin') {
      toast({
        title: "Access Denied",
        description: "This page is only accessible to administrators.",
        variant: "destructive",
      });
      window.location.href = "/";
      return;
    }
  }, [user, authLoading, toast]);

  // Handle unauthorized access
  useEffect(() => {
    if (!authLoading && !user) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [user, authLoading, toast]);

  // Fetch admin statistics
  const { data: stats, isLoading: statsLoading } = useQuery<StatsType>({
    queryKey: ["/api/tickets/stats"],
    enabled: !!user && user.role === 'admin',
  });

  // Fetch all tickets for admin overview
  const { data: allTickets = [], isLoading: ticketsLoading } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
    enabled: !!user && user.role === 'admin',
  });

  // Fetch departments
  const { data: departments = [], isLoading: deptsLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    enabled: !!user && user.role === 'admin',
  });

  // Fetch companies
  const { data: companies = [], isLoading: companiesLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
    enabled: !!user && user.role === 'admin',
  });

  // Get department users
  const { data: departmentUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users", { department: selectedDepartment }],
    enabled: !!user && user.role === 'admin' && !!selectedDepartment,
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return await apiRequest("PATCH", `/api/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16"
        >
          <Activity className="w-16 h-16 text-blue-600 dark:text-blue-400" />
        </motion.div>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return null; // Will redirect in useEffect
  }

  // Calculate advanced statistics
  const totalTickets = allTickets.length;
  const todayTickets = allTickets.filter(ticket => {
    const today = new Date();
    const ticketDate = new Date(ticket.createdAt);
    return ticketDate.toDateString() === today.toDateString();
  }).length;

  const avgResolutionTime = allTickets
    .filter(ticket => ticket.resolvedAt)
    .reduce((sum, ticket) => {
      const created = new Date(ticket.createdAt).getTime();
      const resolved = new Date(ticket.resolvedAt!).getTime();
      return sum + (resolved - created);
    }, 0) / Math.max(allTickets.filter(ticket => ticket.resolvedAt).length, 1);

  const departmentStats = departments.map(dept => {
    const deptTickets = allTickets.filter(ticket => ticket.department.id === dept.id);
    return {
      name: dept.name,
      total: deptTickets.length,
      open: deptTickets.filter(t => t.status === 'open').length,
      resolved: deptTickets.filter(t => t.status === 'resolved').length,
    };
  });

  const priorityStats = {
    high: allTickets.filter(t => t.priority === 'high').length,
    medium: allTickets.filter(t => t.priority === 'medium').length,
    low: allTickets.filter(t => t.priority === 'low').length,
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "role-admin";
      default:
        return "role-employee";
    }
  };

  const formatRole = (role: string) => {
    switch (role) {
      case "admin":
        return "Admin";
      default:
        return "Employee";
    }
  };

  return (
    <Layout>
      <motion.div 
        {...pageTransition}
        className="p-6 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800"
      >
        {/* Header */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8"
        >
          <motion.h2 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600"
          >
            System Administration
          </motion.h2>
          <motion.p 
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-base text-gray-600 dark:text-gray-400"
          >
            Manage users, monitor system performance, and oversee all helpdesk operations
          </motion.p>
        </motion.div>

        {/* System Overview Stats */}
        <AnimatePresence>
          {statsLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
            >
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
                >
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
                    <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : stats ? (
            <motion.div
              variants={staggerChildren}
              initial="initial"
              animate="animate"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
            >
              <StatsCards stats={stats} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Additional Admin Stats */}
        <motion.div
          variants={staggerChildren}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          {[
            {
              title: "Today's Tickets",
              value: todayTickets,
              icon: TrendingUp,
              color: "blue"
            },
            {
              title: "Avg Resolution",
              value: `${Math.round(avgResolutionTime / (1000 * 60 * 60))}h`,
              icon: Activity,
              color: "green"
            },
            {
              title: "High Priority",
              value: priorityStats.high,
              icon: AlertTriangle,
              color: "red"
            },
            {
              title: "Total Companies",
              value: companies.length,
              icon: Building2,
              color: "purple"
            }
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              variants={fadeInUp}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardContent className="p-6">
                  <motion.div 
                    className="flex items-center justify-between"
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {stat.title}
                      </p>
                      <p className={`text-3xl font-bold text-${stat.color}-600 dark:text-${stat.color}-400`}>
                        {stat.value}
                      </p>
                    </div>
                    <motion.div 
                      className={`p-3 bg-${stat.color}-100 dark:bg-${stat.color}-900 rounded-xl shadow-lg`}
                      whileHover={{ rotate: 15 }}
                    >
                      <stat.icon className={`text-${stat.color}-500 h-6 w-6`} />
                    </motion.div>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Department Performance */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
          >
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg h-full">
              <CardHeader className="border-b border-gray-100 dark:border-gray-700">
                <CardTitle className="flex items-center text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600">
                  <Settings className="mr-2 h-5 w-5" />
                  Department Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <motion.div
                  variants={staggerChildren}
                  initial="initial"
                  animate="animate"
                  className="space-y-4"
                >
                  {departmentStats.map((dept, index) => (
                    <motion.div
                      key={dept.name}
                      variants={fadeInUp}
                      transition={{ delay: index * 0.1 }}
                      className="relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {dept.name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {dept.total} total tickets
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <Badge variant="outline" className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800">
                            {dept.open} Open
                          </Badge>
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800">
                            {dept.resolved} Resolved
                          </Badge>
                        </div>
                        <div 
                          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600"
                          style={{ 
                            width: `${(dept.resolved / Math.max(dept.total, 1)) * 100}%`,
                            transition: 'width 1s ease-in-out'
                          }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          {/* System Actions */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
          >
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg h-full">
              <CardHeader className="border-b border-gray-100 dark:border-gray-700">
                <CardTitle className="flex items-center text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600">
                  <Shield className="mr-2 h-5 w-5" />
                  System Management
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <motion.div 
                  variants={staggerChildren}
                  initial="initial"
                  animate="animate"
                  className="grid gap-4"
                >
                  {[
                    { icon: Download, label: "Export System Reports" },
                    { icon: Settings, label: "System Configuration" },
                    { icon: Users, label: "Bulk User Management" },
                    { icon: Activity, label: "Performance Analytics" }
                  ].map((action, index) => (
                    <motion.div
                      key={action.label}
                      variants={fadeInUp}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Button 
                        className="w-full justify-start h-12 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow transition-all duration-200"
                        variant="outline"
                      >
                        <motion.div
                          whileHover={{ rotate: 15 }}
                          className="mr-3"
                        >
                          <action.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </motion.div>
                        {action.label}
                      </Button>
                    </motion.div>
                  ))}
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* User Management Section */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
        >
          <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg">
            <CardHeader className="border-b border-gray-100 dark:border-gray-700">
              <CardTitle className="flex items-center text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600">
                <UserCog className="mr-2 h-5 w-5" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {/* User Management Controls */}
              <motion.div 
                variants={fadeInUp}
                className="flex flex-col sm:flex-row gap-4 mb-6"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <Select onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="w-full sm:w-[200px] h-11 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Departments</SelectItem>
                    {departments.map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.name}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>

              {/* User Table */}
              {selectedDepartment && departmentUsers.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departmentUsers
                        .filter((user: any) => 
                          !searchTerm || 
                          user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          `${user.firstName || ""} ${user.lastName || ""}`.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((user: any) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                  {user.firstName || user.lastName 
                                    ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
                                    : "Unnamed User"
                                  }
                                </p>
                                <p className="text-sm text-gray-500">ID: {user.id}</p>
                              </div>
                            </TableCell>
                            <TableCell>{user.email || "No email"}</TableCell>
                            <TableCell>{user.department || "Unassigned"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getRoleBadgeColor(user.role)}>
                                {formatRole(user.role)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Select
                                onValueChange={(value) => 
                                  updateUserRoleMutation.mutate({ userId: user.id, role: value })
                                }
                                defaultValue={user.role}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="employee">Employee</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              ) : selectedDepartment ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No users found in {selectedDepartment} department.
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  Select a department to view and manage users.
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </Layout>
  );
}