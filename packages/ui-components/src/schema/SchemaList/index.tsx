import { observer } from 'mobx-react-lite';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  ClickAwayListener,
  Container,
  Grid,
  IconButton,
  List,
  ListItemButton,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useModal } from '../../shared/useModal';
import { useSchema } from '../context';
import { useEffect, useState } from 'react';
import { FolderFilled, MoreHorizFilled } from '@vesoft-inc/icons';
import { isDefaultSchema } from '../../shared/utilities';
import PopupState, { bindPopover, bindTrigger } from 'material-ui-popup-state';
import { ISchemaItem } from '../types';
import CreateSchemaModal from '../CreateSchemaDialog/index';
import { FormContainer, TextFieldElement, useForm } from 'react-hook-form-mui';
import { DEFAULT_SCHEMA_PATH } from '../../shared/constants';

export interface SchemaListProps {
  onOpen?: (schema: ISchemaItem) => void;
  onSchemaChange?: (path: string) => void;
}

function SchemaList({ onOpen, onSchemaChange }: SchemaListProps) {
  const schemaStore = useSchema();
  const { schemas, currentSchema, switchSchema } = schemaStore;
  const { t } = useTranslation(['common']);
  const modalStore = useModal();
  const message = useModal().message;
  useEffect(() => {
    schemaStore.getSchemas();
  }, []);

  const handleDropSchema = async (path: string) => {
    const res = await schemaStore.dropSchema(path);
    if (res.code === 0) {
      if (schemaStore.currentSchema.path === path) {
        const { code } = await switchSchema(DEFAULT_SCHEMA_PATH);
        if (code === 0) {
          onSchemaChange?.(DEFAULT_SCHEMA_PATH);
          schemaStore.getSchemas();
          modalStore.hide();
          form.reset();
          return;
        }
      }
      schemaStore.getSchemas();
      modalStore.hide();
      form.reset();
    }
  };

  const NewSchemaButton = observer(function NewExplorerButtonComp() {
    const [open, setOpen] = useState<boolean>(false);

    const handleCreateSchema = async (path: string) => {
      const res = await schemaStore.createSchema(path);
      if (res.code === 0) {
        setOpen(false);
        schemaStore.getSchemas();
      }
    };

    return (
      <>
        <Button variant="contained" onClick={() => setOpen(true)}>
          {t('createSchema', { ns: 'common' })}
        </Button>
        <CreateSchemaModal open={open} onCancel={() => setOpen(false)} onOk={handleCreateSchema} />
      </>
    );
  });

  const form = useForm<{ path: string }>({
    defaultValues: { path: '' },
  });

  const renderDeleteSchemaContent = (schema: ISchemaItem) => {
    return (
      <>
        <Box
          sx={{
            mb: 1.6,
            padding: '4px 12px',
            borderRadius: '6px',
            color: (theme) => theme.palette.vesoft.v2.text2,
            backgroundColor: (theme) => theme.palette.vesoft.v2.error1,
          }}
        >
          {t('deleteSchemaTips', { ns: 'common' })}
        </Box>
        <Box display="flex" sx={{ mb: 2.6, fontSize: 14 }}>
          {t('deleteSchemaLabel', { ns: 'common' })}
          <Box fontWeight={600} ml={1}>
            {schema.path}
          </Box>
        </Box>
        <FormContainer formContext={form} onSuccess={() => {}}>
          <Grid container rowSpacing={2}>
            <TextFieldElement
              label={t('path', { ns: 'common' })}
              name="path"
              required
              fullWidth
              size="small"
              rules={{ required: 'path required' }}
            />
          </Grid>
        </FormContainer>
      </>
    );
  };

  const handleOpenSchema = async (schema: ISchemaItem) => {
    if (schemaStore.switchingSchema) return;
    try {
      const res = await schemaStore.switchSchema(schema.path);
      if (res.code === 0) onOpen?.(schema);
    } catch {
      // Transport errors are presented by the host; cancelled switches must not navigate.
    }
  };

  return (
    <Container maxWidth="lg" sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2} py={3}>
        <Typography fontSize={24} fontWeight={500}>
          {t('catalog', { ns: 'common' })}
        </Typography>
        <Box>
          <NewSchemaButton />
        </Box>
      </Box>
      <Box pb={3}>
        <Grid container spacing={3}>
          {schemas.map((schema) => (
            <Grid key={schema.path} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                variant="outlined"
                sx={{
                  borderRadius: '10px',
                  position: 'relative',
                  backgroundColor: (theme) => theme.palette.vesoft.v2.bg1,
                  borderColor: (theme) =>
                    currentSchema.path === schema.path
                      ? theme.palette.vesoft.v2.primary3
                      : theme.palette.vesoft.v2.border2,
                  boxShadow: 'none',
                  transition: (theme) => theme.transitions.create('border-color'),
                  '&:hover': { borderColor: (theme) => theme.palette.vesoft.v2.primary3 },
                }}
              >
                <CardActionArea
                  onClick={() => handleOpenSchema(schema)}
                  disabled={schemaStore.switchingSchema}
                  aria-label={`${t('path', { ns: 'common' })}: ${schema.path}`}
                  sx={{
                    p: 2,
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, pr: 4 }}>
                    <FolderFilled
                      fontSize="small"
                      sx={{ flexShrink: 0, color: (theme) => theme.palette.vesoft.v2.text2 }}
                    />
                    <Typography
                      noWrap
                      fontSize={16}
                      fontWeight={500}
                      sx={{ color: (theme) => theme.palette.vesoft.v2.text2 }}
                    >
                      {schema.path}
                    </Typography>
                  </Stack>
                  <Stack sx={{ mt: 1.5, minWidth: 0, color: (theme) => theme.palette.vesoft.v2.text3 }}>
                    <Typography variant="body2">{t('owner', { ns: 'common' })}</Typography>
                    <Typography variant="body2" noWrap>
                      {schema.owner || '—'}
                    </Typography>
                  </Stack>
                </CardActionArea>
                {!isDefaultSchema(schema.path) && (
                  <PopupState variant="popover" popupId={`schema-action-${schema.path}`}>
                    {(popupState) => (
                      <>
                        <Box position="absolute" right={8} top={8}>
                          <IconButton
                            {...bindTrigger(popupState)}
                            size="small"
                            aria-label={`${t('schemaActions', { ns: 'common' })}: ${schema.path}`}
                            sx={{ p: 0.75 }}
                          >
                            <MoreHorizFilled
                              fontSize="medium"
                              sx={{
                                color: (theme) => theme.palette.text.secondary,
                              }}
                            />
                          </IconButton>
                        </Box>
                        <Popover
                          {...bindPopover(popupState)}
                          anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 16,
                          }}
                          transformOrigin={{
                            vertical: 'top',
                            horizontal: 'left',
                          }}
                        >
                          <ClickAwayListener onClickAway={() => popupState.close()}>
                            <List sx={{ width: 140 }}>
                              <ListItemButton
                                sx={{
                                  color: (theme) => theme.palette.vesoft.v2.error2,
                                }}
                                onClick={() => {
                                  popupState.close();
                                  modalStore.severity(
                                    {
                                      title: t('deleteSchema', { ns: 'common' }),
                                      content: renderDeleteSchemaContent(schema),
                                      onOk: () => {
                                        if (form.getValues().path === schema.path) {
                                          handleDropSchema(schema.path);
                                        } else {
                                          message.error(t('schemaVerificationFailed', { ns: 'common' }));
                                        }
                                      },
                                      okText: t('delete', { ns: 'common' }),
                                      cancelText: t('cancel', { ns: 'common' }),
                                    },
                                    {
                                      slotProps: {
                                        footer: {
                                          onCancel: () => {
                                            form.reset();
                                            modalStore.hide();
                                          },
                                          // slotProps: {
                                          //   okButton: {
                                          //     disabled: !!disabled,
                                          //   },
                                          // },
                                        },
                                      },
                                    }
                                  );
                                }}
                              >
                                {t('delete', { ns: 'common' })}
                              </ListItemButton>
                            </List>
                          </ClickAwayListener>
                        </Popover>
                      </>
                    )}
                  </PopupState>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Container>
  );
}

export default observer(SchemaList);
