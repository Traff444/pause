import Dexie, { type Table } from 'dexie';
import { createInitialState, type AppState } from './domain';

type AppRecord = {
  id: string;
  state: AppState;
};

class PauzaDatabase extends Dexie {
  app!: Table<AppRecord, string>;

  constructor() {
    super('pauza-pwa');
    this.version(1).stores({ app: 'id' });
  }
}

export const db = new PauzaDatabase();
let saveQueue: Promise<void> = Promise.resolve();

const recordId = (ownerId: string) => `state:${ownerId}`;

function migrateLegacy(raw: unknown): AppState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const legacy = raw as Partial<AppState> & {
    packPrice?: number;
    cigarettesPerPack?: number;
    moneyGoal?: number;
  };

  return {
    ...createInitialState(),
    ...legacy,
    version: 2,
    onboarded: true,
    dailyGoals: legacy.dailyGoals ?? {},
    skippedCount: legacy.skippedCount ?? 0,
    settings: {
      ...(legacy.settings ?? {}),
      packPrice: legacy.settings?.packPrice ?? legacy.packPrice,
      cigarettesPerPack: legacy.settings?.cigarettesPerPack ?? legacy.cigarettesPerPack,
      moneyGoal: legacy.settings?.moneyGoal ?? legacy.moneyGoal,
    },
    events: (legacy.events ?? []).map((event) => ({
      ...event,
      createdAt: event.createdAt ?? event.occurredAt,
    })),
  };
}

export async function loadAppState(ownerId = 'local') {
  try {
    const id = recordId(ownerId);
    const record = await db.app.get(id);
    if (record?.state) return record.state;

    if (ownerId !== 'local') {
      const localRecord = await db.app.get(recordId('local'));
      if (localRecord?.state) {
        await saveAppState(localRecord.state, ownerId);
        await db.app.delete(recordId('local'));
        return localRecord.state;
      }
    }

    // Migrate the single-user pilot record into the first real account.
    const pilotRecord = await db.app.get('main');
    if (pilotRecord?.state) {
      await saveAppState(pilotRecord.state, ownerId);
      await db.app.delete('main');
      return pilotRecord.state;
    }

    const legacyRaw = localStorage.getItem('pauza');
    const legacy = legacyRaw ? migrateLegacy(JSON.parse(legacyRaw)) : undefined;
    if (legacy) {
      await saveAppState(legacy, ownerId);
      localStorage.removeItem('pauza');
      return legacy;
    }
  } catch {
    // A damaged legacy payload should never prevent the app from opening.
  }

  return createInitialState();
}

export function saveAppState(state: AppState, ownerId = 'local') {
  saveQueue = saveQueue
    .catch(() => undefined)
    .then(async () => {
      await db.app.put({ id: recordId(ownerId), state });
    });
  return saveQueue;
}

export async function clearAppState(ownerId = 'local') {
  await saveQueue.catch(() => undefined);
  await db.app.delete(recordId(ownerId));
  localStorage.removeItem('pauza');
}
