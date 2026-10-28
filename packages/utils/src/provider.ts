import type { ProvidersEnum } from '@baby-panda/types';
import { existsSync } from 'fs';
import fs from 'fs';
import os from 'os';
import path from 'path';

const homedir = os.homedir();
const babyPandaFolder = path.join(homedir, '.babypanda');
const babyPandaProviderFile = path.join(babyPandaFolder, 'provider.json');

export async function providerIsSet() {
  if (!existsSync(babyPandaProviderFile)) {
    return false;
  } else {
    const file = await fs.promises.readFile(babyPandaProviderFile, { encoding: 'utf-8' });
    const providerInfo = JSON.parse(file);
    if (providerInfo.current && providerInfo.current === true) {
      return true;
    } else {
      return false;
    }
  }
}

export async function setProvider(name: ProvidersEnum, apiKey: string) {
  if (!existsSync(babyPandaProviderFile)) {
    if (!existsSync(babyPandaFolder)) {
      await fs.promises.mkdir(babyPandaFolder, { recursive: true });
    }
    await fs.promises.writeFile(babyPandaProviderFile, JSON.stringify({}));
  }

  const providerInfo = JSON.parse(
    await fs.promises.readFile(babyPandaProviderFile, { encoding: 'utf-8' }),
  );
  providerInfo.providers[name] = apiKey;
  return;
}

export async function setActiveProvider(name: ProvidersEnum) {
  const providerInfo = JSON.parse(
    await fs.promises.readFile(babyPandaProviderFile, { encoding: 'utf-8' }),
  );
  if (providerInfo.providers[name] != undefined) {
    providerInfo.active = { name, key: providerInfo.providers[name] };
    return;
  } else {
    throw new Error(`Provider API key not set`);
  }
}

export async function getActiveProvider() {
  const providerInfo = JSON.parse(await fs.promises.readFile(babyPandaProviderFile, 'utf-8'));
  return providerInfo.active as { name: ProvidersEnum; key: string } | undefined;
}
