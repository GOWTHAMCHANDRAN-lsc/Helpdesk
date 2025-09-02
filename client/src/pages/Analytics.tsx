
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import React, { useMemo } from 'react';
import Layout from "../components/SimpleLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";


export default function Analytics() {
  const { user } = useAuth();
  const department = String(user?.department ?? '');
  const departmentFilter = department ? `?department_id=${department}` : '';

  const statsQuery = useQuery({
    queryKey: ['/api/stats', departmentFilter],
    queryFn: async () => {
      const res = await fetch(`/api/stats${departmentFilter}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  const stats = statsQuery.data;
  const loading = statsQuery.isLoading;
  const error = statsQuery.isError;

  // Prepare data for recharts
  const data = useMemo(() => [
    { name: 'Open', tickets: stats?.open ?? 0 },
    { name: 'In Progress', tickets: stats?.in_progress ?? 0 },
    { name: 'Resolved', tickets: stats?.resolved ?? 0 },
    { name: 'Closed', tickets: stats?.closed ?? 0 },
  ], [stats]);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
        <Card>
          <CardHeader>
            <CardTitle>Ticket Status Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-10 text-gray-500">Loading…</div>
            ) : error ? (
              <div className="text-center py-10 text-red-500">Could not load stats.</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="tickets" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
