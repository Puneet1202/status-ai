import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_portal/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
