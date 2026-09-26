import { useEffect, useRef } from 'react';

import { notify } from './notifications';
import { useI18n } from '@/features/settings/useI18n';
import { formatTime } from '@/lib/format';

import { legAlert } from './alerts';
import { useTripsStore } from './store';

/**
 * Turns the change log into banners. Only entries recorded after this hook mounted are
 * announced: a cold start replaying a week of gate moves would be noise, and the log is
 * on screen anyway. Demo legs never notify: the catalogue is rebuilt against the clock,
 * and a fictional service has no business waking anyone up.
 */
export function useLegAlerts(): void {
  const { t, language } = useI18n();
  const legChanges = useTripsStore((state) => state.legChanges);
  const legs = useTripsStore((state) => state.legs);

  const seen = useRef<Record<string, string>>({});
  const primed = useRef(false);
  const context = useRef({ t, language, legs });
  context.current = { t, language, legs };

  useEffect(() => {
    const wasPrimed = primed.current;
    primed.current = true;

    for (const [key, changes] of Object.entries(legChanges)) {
      const latest = changes[0]?.at;
      const previous = seen.current[key];
      if (latest) seen.current[key] = latest;
      if (!wasPrimed || !latest || latest === previous) continue;

      const leg = context.current.legs[key];
      if (!leg || leg.isDemo) continue;

      const fresh = previous ? changes.filter((change) => change.at > previous) : changes.slice(0, 1);
      for (const change of fresh) {
        const alert = legAlert(leg, change, context.current.t, (iso, tz) =>
          formatTime(iso, tz, context.current.language),
        );
        if (alert) void notify(alert.title, alert.body);
      }
    }
  }, [legChanges]);
}
