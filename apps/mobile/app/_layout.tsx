import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AccountProvider, useAccount } from '@/features/auth/AccountProvider';
import { useLegAlerts } from '@/features/trips/useLegAlerts';
import {
  deserialisePersistedClient,
  serialisePersistedClient,
  shouldDehydrateQuery,
} from '@/lib/queryPersist';
import { asyncMmkvStorage } from '@/lib/storage';
import { colors } from '@/theme';

const ONE_DAY = 24 * 60 * 60 * 1000;

/**
 * How long the first frame waits on the mono faces. A blank sheet of paper is a worse
 * failure than the wrong typeface: past this the app draws anyway, and every mono style
 * carries `fontVariant: ['tabular-nums']` so a missing family degrades to the system font
 * with its digits still aligned.
 */
const FONT_TIMEOUT_MS = 3_000;

/** Turn live travel changes into local notifications. */
function TravelAlerts() {
  useLegAlerts();
  return null;
}

function AuthenticatedNavigation() {
  const { session, loading, locked } = useAccount();
  if (loading) return <View style={styles.root} />;

  return (
    <>
      {session && !locked ? <TravelAlerts /> : null}
      <Stack screenOptions={{ headerShown: false, contentStyle: styles.content }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="login" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session) && locked}>
          <Stack.Screen name="unlock" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(session) && !locked}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="trip/[legId]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="stamp/[stampId]"
            options={{ presentation: 'fullScreenModal', headerShown: false }}
          />
          <Stack.Screen name="add" options={{ presentation: 'modal', headerShown: false }} />
          <Stack.Screen name="market/[legId]" options={{ animation: 'slide_from_right' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  /**
   * Every number in the app is set in Plex Mono, so a first frame in the fallback family
   * would reflow the whole sheet a moment later: nothing is drawn until the faces are in,
   * or until they have failed or taken too long.
   */
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });
  const [fontsTimedOut, setFontsTimedOut] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const timer = setTimeout(() => setFontsTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (fontError) console.warn('[travely] IBM Plex Mono failed to load', fontError);
  }, [fontError]);

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: { queries: { gcTime: ONE_DAY, staleTime: 10_000, retry: 1 } },
      }),
    [],
  );

  const persister = useMemo(
    () =>
      createAsyncStoragePersister({
        storage: asyncMmkvStorage,
        key: 'travely.query',
        serialize: serialisePersistedClient,
        deserialize: deserialisePersistedClient,
      }),
    [],
  );

  if (!fontsLoaded && !fontError && !fontsTimedOut) return <View style={styles.root} />;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: ONE_DAY,
            dehydrateOptions: { shouldDehydrateQuery },
          }}
        >
          <BottomSheetModalProvider>
            <StatusBar style="light" />
            <AccountProvider>
              <AuthenticatedNavigation />
            </AccountProvider>
          </BottomSheetModalProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    backgroundColor: colors.background,
  },
});
