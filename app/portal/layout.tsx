import type { Metadata } from 'next'
import Link from 'next/link'
import { Home, Ticket, Package, Phone, FileText, User, MessageCircle, LogOut } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Customer Portal - Audico',
  description: 'Audico Customer Self-Service Portal',
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lime-400 flex items-center justify-center text-black font-bold text-xl shadow-lg">
              A
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Audico</h1>
              <p className="text-xs text-gray-500">Customer Portal</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <NavItem href="/portal/dashboard" icon={<Home size={20} />} label="Dashboard" />
          <NavItem href="/portal/tickets" icon={<Ticket size={20} />} label="Support Tickets" />
          <NavItem href="/portal/orders" icon={<Package size={20} />} label="Order History" />
          <NavItem href="/portal/quotes" icon={<FileText size={20} />} label="Quote Requests" />
          <NavItem href="/portal/calls" icon={<Phone size={20} />} label="Scheduled Calls" />
          <NavItem href="/portal/profile" icon={<User size={20} />} label="My Profile" />
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button className="flex items-center gap-3 w-full px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 p-8">
        {children}
      </main>

      <div className="fixed bottom-6 right-6 z-50">
        <Link
          href="/portal/chat"
          className="flex items-center gap-2 bg-lime-500 text-black px-6 py-4 rounded-full shadow-lg hover:bg-lime-400 transition-all hover:shadow-xl"
        >
          <MessageCircle size={24} />
          <span className="font-semibold">Chat with AI</span>
        </Link>
      </div>
    </div>
  )
}

function NavItem({ href, icon, label }: { href: string, icon: React.ReactNode, label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
    >
      {icon}
      <span className="font-medium">{label}</span>
    </Link>
  )
}
