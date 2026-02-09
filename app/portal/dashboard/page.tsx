'use client'

import { useEffect, useState } from 'react'
import { Package, Ticket, FileText, Phone, TrendingUp, Clock } from 'lucide-react'

export default function PortalDashboard() {
  const [stats, setStats] = useState({
    totalOrders: 0,
    openTickets: 0,
    pendingQuotes: 0,
    upcomingCalls: 0,
  })

  const [recentActivity, setRecentActivity] = useState<any[]>([])

  useEffect(() => {
    // Fetch dashboard data
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    // TODO: Implement actual API calls
    setStats({
      totalOrders: 12,
      openTickets: 2,
      pendingQuotes: 1,
      upcomingCalls: 1,
    })

    setRecentActivity([
      { type: 'order', title: 'Order #12345 Shipped', date: '2 hours ago' },
      { type: 'ticket', title: 'Support Ticket #TKT-001 Updated', date: '1 day ago' },
      { type: 'quote', title: 'Quote Request Sent', date: '3 days ago' },
    ])
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back!</h1>
        <p className="text-gray-600">Here's what's happening with your account</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Orders"
          value={stats.totalOrders}
          icon={<Package size={24} />}
          color="blue"
        />
        <StatCard
          title="Open Tickets"
          value={stats.openTickets}
          icon={<Ticket size={24} />}
          color="orange"
        />
        <StatCard
          title="Pending Quotes"
          value={stats.pendingQuotes}
          icon={<FileText size={24} />}
          color="purple"
        />
        <StatCard
          title="Upcoming Calls"
          value={stats.upcomingCalls}
          icon={<Phone size={24} />}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock size={20} />
            Recent Activity
          </h2>
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  activity.type === 'order' ? 'bg-blue-100 text-blue-600' :
                  activity.type === 'ticket' ? 'bg-orange-100 text-orange-600' :
                  'bg-purple-100 text-purple-600'
                }`}>
                  {activity.type === 'order' && <Package size={20} />}
                  {activity.type === 'ticket' && <Ticket size={20} />}
                  {activity.type === 'quote' && <FileText size={20} />}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{activity.title}</p>
                  <p className="text-sm text-gray-500">{activity.date}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={20} />
            Quick Actions
          </h2>
          <div className="space-y-3">
            <QuickActionButton href="/portal/tickets" label="Create Support Ticket" />
            <QuickActionButton href="/portal/quotes" label="Request a Quote" />
            <QuickActionButton href="/portal/calls" label="Schedule a Call" />
            <QuickActionButton href="/portal/orders" label="View Order History" />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, color }: any) {
  const colorClasses = {
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
    purple: 'bg-purple-500',
    green: 'bg-green-500',
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg ${colorClasses[color as keyof typeof colorClasses]} text-white flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <h3 className="text-gray-600 text-sm font-medium mb-1">{title}</h3>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function QuickActionButton({ href, label }: { href: string, label: string }) {
  return (
    <a
      href={href}
      className="block w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-900 font-medium transition-colors text-center"
    >
      {label}
    </a>
  )
}
