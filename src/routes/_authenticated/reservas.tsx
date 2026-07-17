import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/reservas")({
  beforeLoad: () => {
    throw redirect({ to: "/eventos", search: { event: undefined } });
  },
});
