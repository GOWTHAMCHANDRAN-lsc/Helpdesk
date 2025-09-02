import { Card, CardContent } from "@/components/ui/card";
import { Ticket, Clock, Loader2, CheckCircle2 } from "lucide-react";
import type { TicketStats } from "@shared/schema";

interface StatsCardsProps {
  stats: TicketStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: "Total Tickets",
      value: stats.total,
      icon: Ticket,
      bgColor: "bg-primary-100 dark:bg-primary-900",
      iconColor: "text-primary-500",
      textColor: "text-gray-900 dark:text-white"
    },
    {
      title: "Open",
      value: stats.open,
      icon: Clock,
      bgColor: "bg-orange-100 dark:bg-orange-900",
      iconColor: "text-orange-500",
      textColor: "text-orange-600 dark:text-orange-400"
    },
    {
      title: "In Progress",
      value: stats.inProgress,
      icon: Loader2,
      bgColor: "bg-blue-100 dark:bg-blue-900",
      iconColor: "text-blue-500",
      textColor: "text-blue-600 dark:text-blue-400"
    },
    {
      title: "Resolved",
      value: stats.resolved,
      icon: CheckCircle2,
      bgColor: "bg-green-100 dark:bg-green-900",
      iconColor: "text-green-500",
      textColor: "text-green-600 dark:text-green-400"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="border border-gray-200 dark:border-gray-700">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {card.title}
                  </p>
                  <p className={`text-3xl font-bold ${card.textColor}`}>
                    {card.value}
                  </p>
                </div>
                <div className={`p-3 ${card.bgColor} rounded-full`}>
                  <Icon className={`${card.iconColor} h-6 w-6`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
