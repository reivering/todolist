import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/sidebar/AppSidebar'
import { MobileBottomNav } from '@/components/nav/MobileBottomNav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="flex h-full bg-slate-950">
      {/* Sidebar: hidden on mobile, visible on sm+ */}
      <div className="hidden sm:flex">
        <AppSidebar userId={user.id} />
      </div>
      <main className="flex-1 overflow-hidden flex flex-col pb-14 sm:pb-0">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  )
}
