import { RepositoryError, type Repository, type Row, type TableName } from "./repository";

// Knows whether every change made so far has been confirmed by storage. The app
// only tells someone their work is safe when this says so.
export function createWriteTracker() {
  let inFlight = 0;
  const failed = new Set<string>();
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach((listener) => listener());

  async function track<T>(key: string, write: () => Promise<T>): Promise<T> {
    inFlight += 1;
    changed();
    try {
      const result = await write();
      failed.delete(key);
      return result;
    } catch (error) {
      // A duplicate means the record is already stored, so nothing was lost.
      if (error instanceof RepositoryError && error.code === "23505") failed.delete(key);
      else failed.add(key);
      throw error;
    } finally {
      inFlight -= 1;
      changed();
    }
  }

  const keyFor = (table: TableName, id: unknown) => `${table}:${typeof id === "string" ? id : "new"}`;

  return {
    isConfirmed: () => inFlight === 0 && failed.size === 0,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    wrap(repo: Repository): Repository {
      return {
        ...repo,
        insert: <T,>(table: TableName, row: Row) => track(keyFor(table, row.id), () => repo.insert<T>(table, row)),
        update: <T,>(table: TableName, key: string, patch: Row) => track(keyFor(table, key), () => repo.update<T>(table, key, patch)),
        remove: (table: TableName, key: string) => track(keyFor(table, key), () => repo.remove(table, key)),
        removeWhere: (table: TableName, column: string, value: string) => track(`${table}:${column}:${value}`, () => repo.removeWhere(table, column, value)),
      };
    },
  };
}
