export type User = {
  id: string
  account: string
  email: string
  first_name: string
  last_name: string
  name: string
  role: string
  created_at: number
  complete_onboarding_reminded_at?: number
  onboarding_rejected_reminded_at?: number
  onboarding_rejected_reasons?: string
  plan_ready_reminded_at?: number
  kickoff_scheduled_at?: number
}
