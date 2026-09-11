import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
