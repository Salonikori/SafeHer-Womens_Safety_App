// Set APP_DISGUISE=1 when building to install the app as "Calculator" with a calculator icon.
const disguised = process.env.APP_DISGUISE === '1';
const name = disguised ? 'Calculator' : 'SafeHer';
const icon = disguised ? './assets/icon-calculator.png' : './assets/icon.png';

module.exports = {
  expo: {
    name,
    slug: 'safeher',
    version: '1.0.0',
    orientation: 'portrait',
    icon,
    userInterfaceStyle: 'light',
    splash: { backgroundColor: disguised ? '#000000' : '#FFF1F6' },
    ios: {
      bundleIdentifier: 'com.safeher.app',
      supportsTablet: false,
      infoPlist: {
        UIBackgroundModes: ['location'],
        NSLocationWhenInUseUsageDescription: 'Your location is shared with your emergency contacts only when you start an SOS or live sharing.',
        NSLocationAlwaysAndWhenInUseUsageDescription: 'Keeps sharing your location with your contacts while the screen is off during an SOS or live sharing.',
        NSPhotoLibraryUsageDescription: 'Pick photos to attach to a report or to check for hidden data.'
      }
    },
    android: {
      package: 'com.safeher.app',
      adaptiveIcon: { foregroundImage: icon, backgroundColor: disguised ? '#000000' : '#FFF1F6' },
      permissions: [
        'ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_LOCATION',
        'BLUETOOTH', 'BLUETOOTH_ADMIN', 'BLUETOOTH_SCAN', 'BLUETOOTH_CONNECT'
      ],
      usesCleartextTraffic: true
    },
    plugins: [
      'expo-secure-store',
      ['expo-location', {
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
        isIosBackgroundLocationEnabled: true
      }],
      ['react-native-ble-plx', { isBackgroundEnabled: false, modes: ['central'], bluetoothAlwaysPermission: 'SafeHer uses Bluetooth to find nearby SafeHer devices that can receive your SOS.' }],
      ['expo-image-picker', { photosPermission: 'Pick photos to attach to a report or to check for hidden data.' }]
    ]
  }
};
