import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  userDataPath: '',
}));

vi.mock('../src/main/utils/logger', () => ({
  log: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('electron-store', () => {
  class MockStore<T extends Record<string, unknown>> {
    public path: string;
    public store: T;

    constructor(options: { name?: string; defaults?: T }) {
      const name = options.name || 'config';
      this.path = path.join(state.userDataPath, `${name}.json`);

      if (fs.existsSync(this.path)) {
        const raw = fs.readFileSync(this.path, 'utf8');
        this.store = {
          ...(options.defaults || ({} as T)),
          ...(JSON.parse(raw) as T),
        };
        return;
      }

      this.store = { ...(options.defaults || ({} as T)) };
      fs.mkdirSync(path.dirname(this.path), { recursive: true });
      fs.writeFileSync(this.path, JSON.stringify(this.store, null, 2));
    }

    get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K] {
      const keyStr = key as string;
      if (!keyStr.includes('.')) {
        return this.store[key] ?? defaultValue;
      }
      const parts = keyStr.split('.');
      let current: unknown = this.store;
      for (const part of parts) {
        if (current == null || typeof current !== 'object') {
          return defaultValue as T[K];
        }
        current = (current as Record<string, unknown>)[part];
      }
      return (current ?? defaultValue) as T[K];
    }

    set(key: string | Record<string, unknown>, value?: unknown): void {
      if (typeof key === 'string') {
        this.store = { ...this.store, [key]: value };
      } else {
        this.store = { ...this.store, ...(key as T) };
      }
      fs.writeFileSync(this.path, JSON.stringify(this.store, null, 2));
    }

    clear(): void {
      this.store = {} as T;
      fs.writeFileSync(this.path, JSON.stringify(this.store, null, 2));
    }
  }

  return { default: MockStore };
});

describe('RemoteConfigStore plain JSON behavior', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deskwand-remote-config-'));
    state.userDataPath = tempDir;
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it('reads a valid plain JSON remote-config file', async () => {
    const storePath = path.join(tempDir, 'remote-config.json');
    fs.writeFileSync(
      storePath,
      JSON.stringify(
        {
          gateway: {
            enabled: true,
            port: 19999,
            bind: '0.0.0.0',
            auth: {
              mode: 'token',
              token: 'secret-token',
              allowlist: [],
              requirePairing: false,
            },
          },
          channels: {},
          pairedUsers: [
            {
              userId: 'u123',
              userName: 'Alice',
              channelType: 'feishu',
              pairedAt: 1700000000000,
              lastActiveAt: 1700000000000,
            },
          ],
        },
        null,
        2,
      ),
    );

    const { remoteConfigStore } = await import(
      '../src/main/remote/remote-config-store'
    );

    expect(remoteConfigStore.isEnabled()).toBe(true);
    expect(remoteConfigStore.getGatewayConfig().port).toBe(19999);
    expect(remoteConfigStore.getPairedUsers()).toHaveLength(1);
    expect(remoteConfigStore.getPairedUsers()[0].userId).toBe('u123');
  });

  it('throws on invalid JSON without creating unreadable recovery backups', async () => {
    const storePath = path.join(tempDir, 'remote-config.json');
    const invalidContent = '{ invalid json {{{';
    fs.writeFileSync(storePath, invalidContent);

    const load = async () => {
      const { remoteConfigStore } = await import(
        '../src/main/remote/remote-config-store'
      );
      return remoteConfigStore;
    };

    await expect(load()).rejects.toThrow();
    expect(fs.readFileSync(storePath, 'utf8')).toBe(invalidContent);

    const backups = fs
      .readdirSync(tempDir)
      .filter((file) =>
        file.startsWith('remote-config.json.unreadable-recovery-'),
      );
    expect(backups).toHaveLength(0);
  });

  it('creates defaults when remote-config.json is missing', async () => {
    const { remoteConfigStore } = await import(
      '../src/main/remote/remote-config-store'
    );

    expect(remoteConfigStore.isEnabled()).toBe(false);
    expect(remoteConfigStore.getPairedUsers()).toEqual([]);
    expect(fs.existsSync(path.join(tempDir, 'remote-config.json'))).toBe(true);
  });
});
