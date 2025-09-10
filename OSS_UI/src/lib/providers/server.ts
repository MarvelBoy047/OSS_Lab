// src/lib/providers/server.ts
import 'server-only';
import { getAvailableChatModelProviders } from './index';

export async function getAvailableChatModelProvidersServer() {
  return await getAvailableChatModelProviders();
}
