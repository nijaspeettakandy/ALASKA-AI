import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ai")({
  component: AiLayout,
});

function AiLayout() {
  return (
    <div className="flex h-full min-h-0">
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
