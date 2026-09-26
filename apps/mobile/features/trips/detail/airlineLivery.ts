import { operatorInk } from '@/components/ui/operatorColor';

/** Primary tail colours for common carriers; unknown operators keep a stable fallback. */
const TAIL_COLORS: Readonly<Record<string, string>> = {
  '7C': '#F58220',
  AA: '#0078D2',
  AF: '#002157',
  BA: '#075AAA',
  DL: '#071D49',
  EK: '#D71920',
  FR: '#073590',
  JL: '#D71920',
  KL: '#00A1DE',
  LH: '#05164D',
  NH: '#223F99',
  QR: '#5C0632',
  SQ: '#F1C933',
  U2: '#FF6600',
  UA: '#005DAA',
};

export function airlineTailColor(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (normalized === 'DEMO') return '#0A9CF5';
  return TAIL_COLORS[normalized] ?? operatorInk(normalized);
}
