export type SafetyLevel = 'standard' | 'trusted-adult' | 'urgent';

const urgentPatterns = [
  /soak(?:ing)? (?:a |one )?(?:pad|tampon).*(?:hour|60 minutes)/i,
  /faint(?:ed|ing)?/i,
  /cannot (?:stand|walk|wake)/i,
  /hurt (?:myself|my self)/i,
  /suicid/i,
  /immediate danger/i,
  /someone (?:hurt|touched|hit) me/i,
];

const adultPatterns = [
  /very heavy/i,
  /severe pain/i,
  /medicine|dose|dosage|how many pills/i,
  /diagnos/i,
  /period.*(?:more than|over) (?:7|seven) days/i,
];

export function classifySafety(text: string): SafetyLevel {
  if (urgentPatterns.some((pattern) => pattern.test(text))) return 'urgent';
  if (adultPatterns.some((pattern) => pattern.test(text))) return 'trusted-adult';
  return 'standard';
}

export const SAFETY_RESPONSES: Record<Exclude<SafetyLevel, 'standard'>, string> = {
  urgent: 'This sounds important. Please tell a trusted grown-up right now. If you feel unsafe or might hurt yourself, call or text 988 in the U.S. If there is immediate danger, call 911.',
  'trusted-adult': 'A trusted grown-up or health professional should help with this question. AvaCado can share general information, but it cannot diagnose or tell you how much medicine to take.',
};
