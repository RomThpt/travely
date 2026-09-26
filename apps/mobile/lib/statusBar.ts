import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle, type StatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

/**
 * The app is light, so the status bar is dark on paper screens and light over the globe,
 * which is satellite imagery and swallows dark type.
 *
 * Every screen declares its own style rather than restoring a default on blur: a tab screen
 * stays mounted after its first visit, so the switch has to hang off focus, and two screens
 * restoring defaults at each other during a transition is how a status bar ends up
 * flickering. The root layout mounts the style of the initial route, so a cold start opens
 * on the right one with nothing to correct.
 */
export function useScreenStatusBar(style: StatusBarStyle) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style, true);
    }, [style]),
  );
}
