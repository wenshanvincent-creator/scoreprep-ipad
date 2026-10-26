import { writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

export async function atomicJSON(file: string, value: unknown) {
  const temp = file + '.' + randomUUID() + '.tmp';
  await writeFile(temp, JSON.stringify(value, null, 2));
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(temp, file);
      return;
    } catch (error) {
      // A briefly open Windows handle can prevent replacing project.json during
      // library polling. Keep the old JSON intact and bound this specific wait.
      if (
        process.platform !== 'win32' ||
        (error as NodeJS.ErrnoException).code !== 'EPERM' ||
        attempt === 6
      )
        throw error;
      await delay(25 * 2 ** attempt);
    }
  }
}
