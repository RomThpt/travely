import type { Leg } from '@travely/shared/trip';

import { colors } from '@/theme';

import { Symbol, symbolSizes, type SymbolName } from './Symbol';

const SYMBOL_BY_MODE: Record<Leg['modeName'], SymbolName> = {
  flight: 'airplane',
  train: 'tram.fill',
  ferry: 'ferry.fill',
  bus: 'bus.fill',
};

export interface ModeIconProps {
  mode: Leg['modeName'];
  size?: number;
  color?: string;
}

export function ModeIcon({
  mode,
  size = symbolSizes.sm,
  color = colors.textSecondary,
}: ModeIconProps) {
  return <Symbol name={SYMBOL_BY_MODE[mode]} size={size} color={color} weight="semibold" />;
}
