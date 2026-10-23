import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Button, CircularProgress, FormControlLabel, Grid, Switch } from '@mui/material';
import { FormContainer, PasswordElement, TextFieldElement, useForm } from 'react-hook-form-mui';
import { useTranslation } from 'react-i18next';
import { renderPasswordIcon } from '../theme';
import { DelimiterBox } from './loginStyles';

export interface ConnectionValues {
  address: string;
  port: string;
  username: string;
  password: string;
}
export interface ConnectionLabels {
  username?: string;
  password?: string;
  usernameRequired?: string;
  passwordRequired?: string;
  submit?: string;
}
export interface ConnectionFieldsProps {
  showAddress?: boolean;
  sso?: boolean;
  labels?: ConnectionLabels;
  size?: 'small' | 'medium';
  authOption?: ReactNode;
}
export function ConnectionFields({
  showAddress = true,
  sso = false,
  labels = {},
  size = 'medium',
  authOption,
}: ConnectionFieldsProps) {
  const { t } = useTranslation(['login', 'common']);
  const background = { background: (theme: import('@mui/material').Theme) => theme.palette.vesoft.v2.bg1 };
  return (
    <>
      {showAddress && (
        <>
          <Grid size={6.5}>
            <TextFieldElement
              sx={background}
              label={t('address', { ns: 'login' })}
              name="address"
              required
              fullWidth
              size={size}
            />
          </Grid>
          <Grid size={0.5}>
            <DelimiterBox>:</DelimiterBox>
          </Grid>
          <Grid size={5}>
            <TextFieldElement
              sx={background}
              label={t('port', { ns: 'login' })}
              name="port"
              required
              fullWidth
              size={size}
            />
          </Grid>
        </>
      )}
      {authOption}
      {!sso && (
        <>
          <Grid size={12}>
            <TextFieldElement
              sx={background}
              label={labels.username ?? t('username', { ns: 'common' })}
              name="username"
              fullWidth
              size={size}
              required={showAddress}
              rules={{ required: labels.usernameRequired ?? 'username required' }}
            />
          </Grid>
          <Grid size={12}>
            <PasswordElement
              sx={background}
              label={labels.password ?? t('password', { ns: 'common' })}
              name="password"
              type="password"
              fullWidth
              size={size}
              required={showAddress}
              rules={{ required: labels.passwordRequired ?? 'password required' }}
              renderIcon={renderPasswordIcon}
            />
          </Grid>
        </>
      )}
    </>
  );
}

export interface ConnectionFormProps {
  defaultValues?: Partial<ConnectionValues>;
  showAddress?: boolean;
  oauthEnabled?: boolean;
  labels?: ConnectionLabels;
  onSubmit: (values: ConnectionValues, options: { sso: boolean }) => void | Promise<void>;
  submitAction?: (state: { loading: boolean }) => ReactNode;
}
export function ConnectionForm({
  defaultValues,
  showAddress = true,
  oauthEnabled = false,
  labels,
  onSubmit,
  submitAction,
}: ConnectionFormProps) {
  const form = useForm<ConnectionValues>({
    defaultValues: { address: '', port: '9669', username: '', password: '', ...defaultValues },
  });
  const { t } = useTranslation('login');
  const [sso, setSso] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const submit = async (values: ConnectionValues) => {
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError('');
    try {
      await onSubmit(values, { sso: oauthEnabled && sso });
    } catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : t('error', { ns: 'common' }));
    } finally {
      submitting.current = false;
      if (mounted.current) setLoading(false);
    }
  };
  return (
    <FormContainer formContext={form} onSuccess={submit} FormProps={{ style: { width: '100%' } }}>
      <Grid container rowSpacing={2}>
        {error && (
          <Grid size={12}>
            <Alert severity="error">{error}</Alert>
          </Grid>
        )}
        <ConnectionFields
          showAddress={showAddress}
          sso={oauthEnabled && sso}
          labels={labels}
          authOption={
            oauthEnabled && (
              <Grid size={12}>
                <FormControlLabel
                  control={<Switch checked={sso} onChange={(event) => setSso(event.target.checked)} />}
                  label={t('ssoLogin')}
                  sx={{
                    ml: 0,
                    width: '100%',
                    '& .MuiFormControlLabel-label': {
                      color: (theme) => theme.palette.vesoft.v2.text1,
                      textAlign: 'left',
                    },
                  }}
                />
              </Grid>
            )
          }
        />
        <Grid size={12}>
          {submitAction ? (
            submitAction({ loading })
          ) : (
            <Button
              variant="contained"
              fullWidth
              size="large"
              type="submit"
              loading={loading}
              startIcon={loading ? <CircularProgress color="inherit" size={18} /> : undefined}
              sx={{ mt: 2 }}
            >
              {labels?.submit ?? t('login')}
            </Button>
          )}
        </Grid>
      </Grid>
    </FormContainer>
  );
}
