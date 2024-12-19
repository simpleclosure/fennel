export const RETRYABLE_ERROR_PATTERNS = [
  /network/i,
  /timeout/i,
  /disconnected/i,
  /econnreset/i,
  /socket hang up/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /ESOCKETTIMEDOUT/i,
  /failed to fetch/i,
  /net::ERR/i,
  /Target closed/i,
  /Navigation failed/i,
  /Execution context was destroyed/i,
  /Session closed/i,
  /Target page, context or browser has been closed/i,
]

export enum TableType {
  SHAREHOLDERS = 'shareholders',
  MEMBERS = 'boardmembers',
}
