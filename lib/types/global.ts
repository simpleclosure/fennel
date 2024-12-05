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

export enum SubmissionStatus {
  INITIAL = 'initial',
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum SubmitType {
  DE_DISSOLUTION = 'de_dissolution',
  FL_PAYROLL = 'fl_payroll',
}

export type PlanTask = {
  label: string
  body: string
  case_number: string
  submission_status: SubmissionStatus
  state: string
}
