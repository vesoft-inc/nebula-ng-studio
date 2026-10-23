import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { ConnectionDialog } from '@vesoft-inc/ui-components/shell';
import { themeStore } from '@vesoft-inc/ui-components/theme';
import { commonStore, modalStore } from '@gui/stores/session';
import { consoleStore } from '@gui/stores/console';
import lightConnectionBoard from '/images/connect-light.svg?url';
import darkConnectionBoard from '/images/connect-dark.svg?url';

export default observer(function LoginModal() {
  const { t } = useTranslation('gui');
  return (
    <ConnectionDialog
      open={commonStore.showLoginModal}
      onClose={() => commonStore.toggleLoginModal(false)}
      title={t('loginModal.title')}
      description={t('loginModal.desc')}
      background={themeStore.mode === 'dark' ? darkConnectionBoard : lightConnectionBoard}
      labels={{
        username: t('loginModal.username'),
        password: t('loginModal.password'),
        usernameRequired: t('loginModal.usernameRequired'),
        passwordRequired: t('loginModal.passwordRequired'),
        submit: t('loginModal.connect'),
      }}
      onSubmit={async (values) => {
        const success = await commonStore.login({
          username: values.username,
          password: values.password,
          address: '',
          port: '',
        });
        if (success) {
          void consoleStore.getGraphs();
          commonStore.toggleLoginModal(false);
        } else modalStore.message.error(t('loginModal.loginFailed'));
      }}
    />
  );
});
