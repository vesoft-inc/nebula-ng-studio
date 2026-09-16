import { Modal } from '@vesoft-inc/ui-components';
import { useTranslation } from 'react-i18next';
import { FormContainer, SelectElement, TextFieldElement, useForm } from 'react-hook-form-mui';
import { Grid } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { IGraph } from '@studio/interfaces/explorer';

type CreateSnapshotForm = {
  name: string;
  graph: string;
};

interface CreateSnapshotModalProps {
  open: boolean;
  loading: boolean;
  graphs: IGraph[];
  onCancel: () => void;
  onOk: (values: CreateSnapshotForm) => void;
}

function CreateSnapshotModal(props: CreateSnapshotModalProps) {
  const { open, onCancel, loading, graphs } = props;
  const { t } = useTranslation(['common']);
  const form = useForm<CreateSnapshotForm>({
    defaultValues: {},
  });

  const onSubmit = (values: CreateSnapshotForm) => {
    props.onOk(values);
  };

  const handleCancel = () => {
    form.reset();
    onCancel();
  };

  return (
    <Modal
      title={t('createSnapshot', { ns: 'common' })}
      open={open}
      onOk={form.handleSubmit(onSubmit)}
      onCancel={handleCancel}
      slotProps={{
        footer: {
          okText: t('create', { ns: 'common' }),
          cancelText: t('cancel', { ns: 'common' }),
          slotProps: {
            okButton: {
              loading,
            },
          },
        },
      }}
    >
      <FormContainer formContext={form} onSuccess={onSubmit}>
        <Grid container rowSpacing={2} mb={2}>
          <Grid size={{ md: 12 }}>
            <TextFieldElement
              label={t('name', { ns: 'common' })}
              name="name"
              required
              fullWidth
              size="small"
              rules={{ required: 'name required' }}
            />
          </Grid>
          <Grid size={{ md: 12 }}>
            <SelectElement
              label={t('graph', { ns: 'common' })}
              name="graph"
              required
              fullWidth
              size="small"
              rules={{ required: 'graph required' }}
              labelKey="label"
              valueKey="id"
              options={graphs.slice().map((g) => ({ id: g.name, label: g.name }))}
            />
          </Grid>
        </Grid>
      </FormContainer>
    </Modal>
  );
}

export default observer(CreateSnapshotModal);
