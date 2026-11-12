import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { DashboardMenu } from "@/components/dashboard-menu"
import { INITIAL_MODULES_CONFIG } from "@/lib/constants"

export default async function Home() {
  const supabase = await createClient()

  // Verify auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect("/login")
  }

  // Fetch Profile and App Settings in PARALLEL
  const [profileRes, settingsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("first_name, last_name, department, job_title, national_id")
      .eq("id", user.id)
      .single(),
    supabase.from("app_settings").select("*")
  ])

  const profile = profileRes.data

  // Build settings map
  const settings: Record<string, boolean> = {}
  INITIAL_MODULES_CONFIG.forEach(m => settings[m.key] = m.default)
  if (settingsRes.data) {
    settingsRes.data.forEach((item: any) => {
      settings[item.key] = item.value
    })
  }

  // Redirect to complete profile if necessary info is missing
  if (!profile?.first_name || !profile?.last_name || !profile?.national_id) {
    return redirect("/complete-profile")
  }

  return (
    <main className="min-h-screen bg-background flex flex-col justify-start px-4 sm:px-6 py-6 sm:py-12">
      <div className="max-w-2xl w-full mx-auto space-y-6 sm:space-y-8">

        {/* HEADER UNIFORME */}
        <header className="pb-6 border-b border-neutral-100 space-y-4">
          <span className="text-xs text-neutral-400 block">
            Portal de operaciones
          </span>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-neutral-900">
              Hola, {profile?.first_name || 'Usuario'}
            </h1>
            {profile?.job_title && (
              <p className="text-xs sm:text-sm text-neutral-500">
                {profile.job_title}
                {profile.department ? ` · ${profile.department}` : ''}
              </p>
            )}
          </div>
        </header>

        {/* MODULE LIST */}
        <DashboardMenu initialSettings={settings} />

      </div>
    </main>
  )
}



