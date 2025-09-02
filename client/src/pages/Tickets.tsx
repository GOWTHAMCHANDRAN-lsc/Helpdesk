import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Layout from "../components/SimpleLayout";
import { TicketTable } from "@/components/TicketTable";
import { Button } from "@/components/ui/button";
import { Plus, Filter, Search, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { staggerChildren, pageTransition } from '@/lib/animations';
import { Link } from "wouter";

export default function Tickets() {
  const { user } = useAuth();
  const department = String(user?.department ?? '');
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ["/api/tickets", { search, status, priority, department, page }],
    enabled: !!user,
    queryFn: async () => {
      const params = [];
      if (department) params.push(`department_id=${encodeURIComponent(department)}`);
      if (search) params.push(`search=${encodeURIComponent(search)}`);
      if (status) params.push(`status=${encodeURIComponent(status)}`);
      if (priority) params.push(`priority=${encodeURIComponent(priority)}`);
      params.push(`limit=${limit}`);
      params.push(`offset=${page * limit}`);
      let url = `/api/tickets`;
      if (params.length) {
        url += '?' + params.join('&');
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch tickets');
      const data = await res.json();
      return data;
    },
  });

  if (error) {
    toast({ title: "Failed to load tickets", variant: "destructive" });
  }

  const getPageTitle = () => {
    switch (user?.role) {
      case "admin":
        return "All Tickets";
      default:
        return "My Tickets";
    }
  };

  const getPageDescription = () => {
    switch (user?.role) {
      case "admin":
        return "Manage all tickets across the organization";
      default:
        return "View and manage your support tickets";
    }
  };

  const handleSearch = (val: string) => { setSearch(val); setPage(0); };
  const handleStatusFilter = (val: string) => { setStatus(val); setPage(0); };
  const handlePriorityFilter = (val: string) => { setPriority(val); setPage(0); };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16"
        >
          <Loader2 className="w-16 h-16 text-blue-600 dark:text-blue-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <Layout>
      <motion.div 
        {...pageTransition}
        className="p-6 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800"
      >
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8 rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-700">
            <div>
              <motion.h2 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600"
              >
                {getPageTitle()}
              </motion.h2>
              <motion.p 
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-base text-gray-600 dark:text-gray-400"
              >
                {getPageDescription()}
              </motion.p>
            </div>
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-4"
            >
              <Button
                variant="outline"
                size="sm"
                className="font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20"
                onClick={() => {
                  setSearch("");
                  setStatus("");
                  setPriority("");
                }}
              >
                <Filter className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
              
              <Link href="/create-ticket">
                <Button 
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg hover:shadow-blue-200/40 dark:hover:shadow-blue-900/40 transition-all duration-200"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Ticket
                </Button>
              </Link>
            </motion.div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 p-4"
            >
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="h-20 rounded-lg bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-shine overflow-hidden"
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              variants={staggerChildren}
              initial="initial"
              animate="animate"
              exit={{ opacity: 0 }}
            >
              <div className="rounded-xl bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search tickets..."
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-900"
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                
                <TicketTable 
                  tickets={Array.isArray(tickets) ? tickets : (tickets && Array.isArray(tickets.tickets) ? tickets.tickets : [])}
                  title={getPageTitle()}
                  onSearch={handleSearch}
                  onStatusFilter={handleStatusFilter}
                  onPriorityFilter={handlePriorityFilter}
                  isLoading={isLoading}
                />
                {/* Debug: Show raw data if no tickets visible */}
                {(!isLoading && (!tickets || (Array.isArray(tickets) && tickets.length === 0) || (tickets && Array.isArray(tickets.tickets) && tickets.tickets.length === 0))) && (
                  <pre className="text-xs text-red-500 bg-gray-100 p-2 mt-2 overflow-x-auto">{JSON.stringify(tickets, null, 2)}</pre>
                )}
                <div className="flex justify-between items-center p-4 border-t border-gray-100 dark:border-gray-700">
                  <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                    Previous
                  </Button>
                  <span>Page {page + 1}</span>
                  <Button size="sm" variant="outline" onClick={() => setPage((p) => p + 1)} disabled={Array.isArray(tickets) && tickets.length < limit}>
                    Next
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Layout>
  );
}
