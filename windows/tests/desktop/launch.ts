import { _electron as electron, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function launchDesktop(data: string) {
  const executablePath = process.env.SCOREPREP_VERIFY_EXE;
  const app = await electron.launch({
    ...(executablePath ? { executablePath } : {}),
    args: executablePath ? [`--user-data-dir=${data}`] : [path.resolve('.')],
    env: {
      ...process.env,
      SCOREPREP_TEST_DATA: data,
      ...(executablePath
        ? { PATH: path.join(process.env.SystemRoot || 'C:\\Windows', 'System32') }
        : {}),
      JAVA_TOOL_OPTIONS:
        '-Dhttp.proxyHost=127.0.0.1 -Dhttp.proxyPort=1 -Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=1 -Djava.net.useSystemProxies=false',
    },
  });
  const state = await app.evaluate(({ app }) => ({
    data: app.getPath('userData'),
    packaged: app.isPackaged,
    version: app.getVersion(),
    appPath: app.getAppPath(),
  }));
  expect(state.data).toBe(data);
  expect(state.packaged).toBe(Boolean(executablePath));
  expect(state.version).toBe(JSON.parse(await readFile('package.json', 'utf8')).version);
  if (executablePath)
    expect(state.appPath).toBe(path.join(path.dirname(executablePath), 'resources', 'app.asar'));
  return app;
}
