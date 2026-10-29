export interface CategorizationRule {
  id: string;
  name: string;
  pattern: string;
  clean_description?: string | null;
  category_id: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  category_name?: string | null;
  category_icon?: string | null;
  category_color?: string | null;
}

export interface CategorizationRuleCreate {
  name: string;
  pattern: string;
  clean_description?: string | null;
  category_id: string;
  priority?: number;
  is_active?: boolean;
}

export interface CategorizationRuleUpdate {
  name?: string;
  pattern?: string;
  clean_description?: string | null;
  category_id?: string | null;
  priority?: number;
  is_active?: boolean;
}

export interface RuleSimulationRequest {
  raw_text: string;
  candidate_pattern?: string | null;
  candidate_clean_description?: string | null;
  candidate_category_id?: string | null;
}

export interface RuleSimulationResponse {
  raw_text: string;
  sanitized_text: string;
  is_match: boolean;
  matched_rule_id?: string | null;
  matched_rule_name?: string | null;
  matched_rule_priority?: number | null;
  category_id?: string | null;
  category_name?: string | null;
  category_icon?: string | null;
  category_color?: string | null;
  final_description: string;
}

export interface RuleReorderRequest {
  rule_ids: string[];
}

