import { ConsoleWorkbench } from '@vesoft-inc/studio-ui-internal/console';
import {
  useStorageSettings,
  CONSOLE_DEFAULT_LOCAL_SETTINGS,
  type ConsoleSettingsForm,
} from '@vesoft-inc/studio-ui-internal/settings';
import { CONSOLE_SETTINGS_ID } from '../../utils/preferences';
import { consoleStore } from '../../stores/console';
import { guiConsoleServices } from '../../services/console';
import { getToken } from '../../utils/auth';
import { brandConfig } from '../../utils/brand';

export default function ConsolePage() {
  const { settings, upsertSettings, isPending } = useStorageSettings<ConsoleSettingsForm>({
    settingId: CONSOLE_SETTINGS_ID,
    defaultSettings: CONSOLE_DEFAULT_LOCAL_SETTINGS,
    storageInstance: sessionStorage,
  });
  return (
    <ConsoleWorkbench
      services={guiConsoleServices}
      controller={consoleStore}
      appearance={{ prompt: brandConfig.consolePrompt }}
      loadGraphMetadata={false}
      settings={settings}
      onSettingsChange={upsertSettings}
      settingsPending={isPending}
      canOpenSettings={() => !!getToken()}
    />
  );
}
