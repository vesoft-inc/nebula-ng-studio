import { Modal } from '@vesoft-inc/ui-components';
import { useTranslation } from 'react-i18next';
import { FormContainer, TextFieldElement, useForm } from 'react-hook-form-mui';
import { Grid } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';

type CreateSchemaForm = {
  path: string;
};

interface CreateSchemaModalProps {
  open: boolean;
  onCancel: () => void;
  onOk: (path: string) => void;
}

function CreateSchemaModal(props: CreateSchemaModalProps) {
  const { open, onCancel, onOk } = props;
  const { t } = useTranslation();
  const form = useForm<CreateSchemaForm>({
    defaultValues: {},
  });

  useEffect(() => {
    form.reset();
  }, []);

  const onSubmit = (values: CreateSchemaForm) => {
    const { path } = values;
    onOk(path);
  };

  const handleCancel = () => {
    form.reset();
    onCancel();
  };

  return (
    <Modal
      title={t('createSchema', { ns: 'common' })}
      open={open}
      onOk={form.handleSubmit(onSubmit)}
      onCancel={handleCancel}
      slotProps={{
        content: {
          sx: {
            width: 360,
          },
        },
        footer: {
          okText: t('create', { ns: 'common' }),
          cancelText: t('cancel', { ns: 'common' }),
        },
      }}
    >
      <FormContainer formContext={form} onSuccess={onSubmit}>
        <Grid container rowSpacing={2} mb={2}>
          <Grid size={{ md: 12 }}>
            <TextFieldElement
              label={t('path', { ns: 'common' })}
              name="path"
              required
              fullWidth
              size="small"
              rules={{ required: 'path required' }}
              placeholder={t('pathPlaceHolder', { ns: 'common' })}
            />
          </Grid>
        </Grid>
      </FormContainer>
    </Modal>
  );
}

export default observer(CreateSchemaModal);
