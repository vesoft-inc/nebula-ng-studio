import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConsoleWorkbench } from '@vesoft-inc/ui-components/console';
import { SchemaTree } from '@vesoft-inc/ui-components/schema';
import {
  CONSOLE_DEFAULT_LOCAL_SETTINGS,
  useStorageSettings,
  type ConsoleSettingsForm,
} from '@vesoft-inc/ui-components/settings';
import { CONSOLE_SETTINGS_ID_PREFIX } from '@studio/app/settings';
import { commonStore, consoleStore, modalStore, schemaStore } from '@studio/app/session';
import { studioConsoleServices } from '@studio/stores/console';
import { useSchemaTreeBindings } from '../schemaTreeBindings';
import { brandConfig } from '@studio/utils';
import { exploreConsoleResult } from './exploreResult';

export default observer(function ConsolePage() {
  const navigate = useNavigate();
  const { t } = useTranslation('console');
  const schemaTree = useSchemaTreeBindings(true);
  const { settings, upsertSettings, isPending } = useStorageSettings<ConsoleSettingsForm>({
    settingId: `${CONSOLE_SETTINGS_ID_PREFIX}${commonStore.userInfo?.username ?? ''}`,
    defaultSettings: CONSOLE_DEFAULT_LOCAL_SETTINGS,
    storageInstance: sessionStorage,
  });
  return (
    <ConsoleWorkbench
      key={commonStore.userInfo?.curSchemaPath}
      services={studioConsoleServices}
      controller={consoleStore}
      appearance={{ prompt: brandConfig.consolePrompt, showPrompt: !!commonStore.userInfo }}
      settings={settings}
      onSettingsChange={upsertSettings}
      settingsPending={isPending}
      sidebar={<SchemaTree showDetail {...schemaTree} />}
      onExplore={(result, graph) =>
        exploreConsoleResult({
          result,
          graph,
          consoleStore,
          schemaStore,
          schemaPathFallback: commonStore.userInfo?.curSchemaPath,
          navigate,
          notifyError: (text) => modalStore.message.error(text),
          exploreFailedMessage: t('exploreFailed'),
        })
      }
    />
  );
});
