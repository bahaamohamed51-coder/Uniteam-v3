import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uniteam.attendance',
  appName: 'Uniteam',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
