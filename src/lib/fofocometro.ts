export type FofocometroGoal = {
  id: string;
  event_id: string;
  campaign_id?: string | null;
  event_name?: string;
  name: string;
  stage_order: number;
  target_count: number;
  current_count: number;
  status: "scheduled" | "active" | "completed" | "cancelled" | string;
  starts_at: string | null;
  completed_at: string | null;
  reward_description: string | null;
};

export function fofocometroPercent(goal: FofocometroGoal): number {
  return Math.min(100, Math.round((goal.current_count / Math.max(goal.target_count, 1)) * 100));
}

export function selectFofocometroGoal(
  goals: FofocometroGoal[],
  eventId?: string | null,
): FofocometroGoal | null {
  const matching = eventId ? goals.filter((goal) => goal.event_id === eventId) : goals;
  return (
    matching.find((goal) => goal.status === "active") ??
    matching.find((goal) => goal.status === "scheduled") ??
    [...matching]
      .filter((goal) => goal.status === "completed")
      .sort((a, b) => b.stage_order - a.stage_order)[0] ??
    null
  );
}
