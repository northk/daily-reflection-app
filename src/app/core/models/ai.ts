export interface ReflectDeeperResponse {
  follow_up_questions: string[];
  reframes: string[];
  micro_actions: string[];
  crisis_note?: string;
}

export interface WeeklySummaryResponse {
  themes: string[];
  wins: string[];
  stressors: string[];
  suggested_experiments: string[];
  tone: {
    overall: string;
    trend: string;
  };
  crisis_note?: string;
}
