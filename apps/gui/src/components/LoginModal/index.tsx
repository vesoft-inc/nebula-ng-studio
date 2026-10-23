import { Backdrop, Box, Button, IconButton, Typography, useTheme } from '@mui/material';
import { FormContainer, PasswordElement, TextFieldElement, useForm } from 'react-hook-form-mui';
import { useTranslation } from 'react-i18next';
import { renderPasswordIcon } from '@vesoft-inc/ui-components/theme';
import { useEffect, useState } from 'react';
import { CloseFilled } from '@vesoft-inc/icons';
import lightConnectionBoard from '/images/connect-light.svg?url';
import darkConnectionBoard from '/images/connect-dark.svg?url';
import { observer } from 'mobx-react-lite';
import { commonStore, modalStore } from '@gui/stores/session';
import { themeStore } from '@vesoft-inc/ui-components/theme';
import { consoleStore } from '@studio/stores/session';

export interface UpdatePasswordForm {
  username: string;
  password: string;
}

function LoginModal() {
  const { t } = useTranslation(['gui']);
  const [loading, setLoading] = useState(false);
  const { message } = modalStore;
  const isDarkMode = themeStore.mode === 'dark';
  const theme = useTheme();

  const form = useForm<UpdatePasswordForm>({
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const handleSubmit = () => {
    const submit = async (data: UpdatePasswordForm) => {
      try {
        setLoading(true);
        const success = await commonStore.login({
          username: data.username,
          password: data.password,
          address: '',
          port: '',
        });

        if (success) {
          consoleStore.getGraphs();
          handleClose();
        } else {
          message.error(t('loginModal.loginFailed', { ns: 'gui' }));
        }
      } catch (err) {
        console.error('Failed to login:', err);
      } finally {
        setLoading(false);
      }
    };
    form.handleSubmit(submit)();
  };

  const handleClose = () => {
    commonStore.toggleLoginModal(false);
    form.reset();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSubmit();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <Backdrop
      open={commonStore.showLoginModal}
      sx={{
        zIndex: theme.zIndex.modal,
        // https://github.com/mui/material-ui/issues/32286
        '&[style*="opacity: 0"]': {
          pointerEvents: 'none',
        },
      }}
    >
      <Box
        onClick={(e) => e.stopPropagation()}
        sx={{
          position: 'relative',
          width: '640px',
          // height: '360px',
          paddingBottom: '24px',
          backgroundImage: `url(${isDarkMode ? darkConnectionBoard : lightConnectionBoard})`,
          backgroundColor: theme.palette.vesoft.v2.bg1,
          border: `4px solid ${theme.palette.vesoft.v2.border2}`,
          borderRadius: '6px',
          backgroundPosition: '25px 20px',
          backgroundSize: '600px auto',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <IconButton
          sx={{
            position: 'absolute',
            top: '12px',
            right: '23px',
          }}
          onClick={handleClose}
        >
          <CloseFilled />
        </IconButton>

        <Box display="flex" flexDirection="column" justifyContent="flex-start" alignItems="center">
          <Typography
            variant="h5"
            sx={{
              marginTop: '36px',
              color: theme.palette.vesoft.v2.text1,
              fontSize: '20px',
              lineHeight: '24px',
              fontWeight: 600,
            }}
          >
            {t('loginModal.title', { ns: 'gui' })}
          </Typography>

          <Typography
            sx={{
              marginTop: '44px',
              marginBottom: '24px',
              color: theme.palette.vesoft.v2.text3,
              fontSize: '14px',
              fontWeight: 400,
            }}
          >
            {t('loginModal.desc', { ns: 'gui' })}
          </Typography>

          <FormContainer formContext={form} onSuccess={handleSubmit}>
            <Box display="flex" flexDirection="column" gap={2} sx={{ width: '432px' }}>
              <TextFieldElement
                label={t('loginModal.username', { ns: 'gui' })}
                name="username"
                fullWidth
                rules={{ required: t('loginModal.usernameRequired', { ns: 'gui' }) }}
              />
              <PasswordElement
                label={t('loginModal.password', { ns: 'gui' })}
                name="password"
                type="password"
                fullWidth
                rules={{ required: t('loginModal.passwordRequired', { ns: 'gui' }) }}
                renderIcon={renderPasswordIcon}
              />
            </Box>
          </FormContainer>

          <Button
            onClick={() => form.handleSubmit(handleSubmit)()}
            variant="contained"
            disabled={loading}
            sx={{
              marginTop: '44px',
              width: '240px',
              height: '32px',
              borderRadius: '6px',
              fontSize: '12px',
            }}
          >
            {loading ? 'Loading...' : t('loginModal.connect', { ns: 'gui' })}
          </Button>
        </Box>
      </Box>
    </Backdrop>
  );
}

export default observer(LoginModal);
