import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sidebar } from "@/components/portal/Sidebar";
import { BottomNav } from "@/components/portal/BottomNav";
import { useApp } from "@/lib/app-state";

export const Route = createFileRoute("/_portal")({
  component: PortalLayout,
});

function PortalLayout() {
  const { isReady } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    // isReady false matlab server-side render ya client mount pending
    // Tab tak kuch mat karo — flash redirect rokta hai
    if (!isReady) return;

    // Client mount complete — ab localStorage safely check kar sakte hain
    const token = localStorage.getItem("keyss_token");
    if (!token) {
      navigate({ to: "/login", replace: true });
    }
  }, [isReady]); // sirf isReady change hone pe — user change pe nahi

  // Jab tak client mount nahi hua, minimal loader dikhao
  // Ye SSR flash aur wrong redirect dono rokta hai
  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 pb-24 lg:pb-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
