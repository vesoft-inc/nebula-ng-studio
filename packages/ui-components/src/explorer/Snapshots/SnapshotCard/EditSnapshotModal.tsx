import { Modal } from '../../../shared/index';
import { useTranslation } from 'react-i18next';
import { FormContainer, TextFieldElement, useForm } from 'react-hook-form-mui';
import type { SnapshotMetadata } from '../../../contracts/snapshot';
import { Box } from '@mui/material';
import { useEffect, useState } from 'react';

type EditSnapshotForm = {
  name: string;
};

interface EditSnapshotModalProps {
  data?: SnapshotMetadata;
  open: boolean;
  onCancel: () => void;
  onOk: (values: EditSnapshotForm, cb: () => void) => void;
}

function EditSnapshotModal(props: EditSnapshotModalProps) {
  const { data, open, onCancel } = props;
  const { t } = useTranslation(['common']);
  const [loading, setLoading] = useState<boolean>(false);

  const form = useForm<EditSnapshotForm>({
    defaultValues: {
      name: data?.name || '',
    },
  });

  useEffect(() => {
    form.reset({
      name: data?.name || '',
    });
  }, [data]);

  const onSubmit = (values: EditSnapshotForm) => {
    setLoading(true);
    props.onOk(values, () => {
      setLoading(false);
    });
  };

  return (
    <Modal
      title={t('editSnapshot', { ns: 'common' })}
      open={open}
      onOk={form.handleSubmit(onSubmit)}
      onCancel={onCancel}
      slotProps={{
        footer: {
          okText: t('update', { ns: 'common' }),
          cancelText: t('cancel', { ns: 'common' }),
          slotProps: {
            okButton: {
              loading,
            },
          },
        },
      }}
    >
      <FormContainer formContext={form}>
        <Box height={100} width="100%" display="flex" alignItems="center">
          <TextFieldElement required fullWidth name="name" label={t('name', { ns: 'common' })} />
        </Box>
      </FormContainer>
    </Modal>
  );
}

export default EditSnapshotModal;
