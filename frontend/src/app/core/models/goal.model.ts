export type GoalStatus = 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED';

export interface GoalContribution {
  id: string;
  goal_id: string;
  amount: string;
  contribution_date: string;
  notes?: string | null;
  created_at: string;
}

export interface FinancialGoal {
  id: string;
  name: string;
  description?: string | null;
  target_amount: string;
  current_amount: string;
  deadline_date?: string | null;
  account_id?: string | null;
  auto_sync_account: boolean;
  icon?: string | null;
  color?: string | null;
  status: GoalStatus;
  percentage: string;
  remaining_amount: string;
  days_remaining?: number | null;
  monthly_pace_needed?: string | null;
  account_name?: string | null;
  created_at: string;
  updated_at: string;
  contributions: GoalContribution[];
}

export interface FinancialGoalCreate {
  name: string;
  description?: string | null;
  target_amount: string;
  initial_amount?: string;
  deadline_date?: string | null;
  account_id?: string | null;
  auto_sync_account?: boolean;
  icon?: string | null;
  color?: string | null;
}

export interface FinancialGoalUpdate {
  name?: string;
  description?: string | null;
  target_amount?: string;
  deadline_date?: string | null;
  account_id?: string | null;
  auto_sync_account?: boolean;
  icon?: string | null;
  color?: string | null;
  status?: GoalStatus;
}

export interface GoalContributionCreate {
  amount: string;
  contribution_date?: string;
  notes?: string | null;
}

export interface FinancialGoalSummaryResponse {
  total_target: string;
  total_current: string;
  overall_percentage: string;
  goals_in_progress_count: number;
  goals_completed_count: number;
  goals: FinancialGoal[];
}

