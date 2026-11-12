import { ShieldCheck } from "lucide-react"
import { LogoutButton } from "@/components/ui/logout-button"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardMenu } from "@/components/dashboard-menu"

export default async function Home() {
  const supabase = await createClient()

  // Verify auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect("/login")
  }

  // Fetch Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, department, job_title, national_id")
    .eq("id", user.id)
    .single()

  // Redirect to complete profile if necessary info is missing
  if (!profile?.first_name || !profile?.last_name || !profile?.national_id) {
    return redirect("/complete-profile")
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-3xl w-full space-y-12">

        {/* HEADER */}
        <header className="pb-8 border-b border-neutral-100 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-neutral-400 text-xs">
              <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Portal de operaciones</span>
            </div>
            <h1 className="text-3xl font-light tracking-tight text-neutral-900">
              Hola, {profile?.first_name || 'Usuario'}
            </h1>
            {profile?.job_title && (
              <p className="text-sm text-neutral-500">
                {profile.job_title}
                {profile.department ? ` · ${profile.department}` : ''}
              </p>
            )}
          </div>
          <LogoutButton />
        </header>

        {/* MODULE LIST */}
        <DashboardMenu />

      </div>
    </main>
  )
}


