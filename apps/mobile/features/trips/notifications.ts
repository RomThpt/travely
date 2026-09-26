import * as Notifications from 'expo-notifications';

let configured = false;
let permissionGranted: boolean | undefined;

function configure(): void {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function notify(title: string, body: string): Promise<void> {
  if (permissionGranted === undefined) {
    configure();
    try {
      const current = await Notifications.getPermissionsAsync();
      permissionGranted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    } catch {
      permissionGranted = false;
    }
  }
  if (!permissionGranted) return;
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
  } catch {
    // A notification failure must not interrupt travel updates.
  }
}
