import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/fofoquinhas")({
  beforeLoad: () => {
    throw redirect({ to: "/mimos" });
  },
});
