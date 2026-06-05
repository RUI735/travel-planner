import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  extra: {
    deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? '',
    amapApiKey: process.env.AMAP_API_KEY ?? '',
  },
} as ExpoConfig);
