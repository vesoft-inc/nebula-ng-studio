import { Grid } from '@mui/material';
import { Modal } from '../../shared/index';

import { Box, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { FormContainer, SelectElement, TextFieldElement, useForm } from 'react-hook-form-mui';
import { useEffect } from 'react';
import { useModal } from '../../shared/useModal';
import { GraphType } from '../types';

export interface CreateGraphFormValues {
  graphType: string;
  graphName: string;
}

interface CreateGraphModalProps {
  open: boolean;
  graphTypes: GraphType[];
  onCancel?: () => void;
  onOk?: () => void;
  onCreate: (values: CreateGraphFormValues) => Promise<{ code: number }>;
}

const getDefaultValues = () => ({
  graphType: '',
  graphName: '',
});

const CreateGraphModal = (props: CreateGraphModalProps) => {
  const { open, onCancel, graphTypes, onOk, onCreate } = props;
  const theme = useTheme();
  const form = useForm<CreateGraphFormValues>({
    defaultValues: getDefaultValues(),
  });

  const { message } = useModal();

  const { t } = useTranslation(['graphtype', 'common']);

  const onSubmit = async (values: CreateGraphFormValues) => {
    const { graphName, graphType } = values;
    const res = await onCreate({ graphName, graphType });
    if (res.code === 0) {
      message.success(t('createGraphSuccess', { ns: 'graphtype' }));
      onOk?.();
    }
  };

  useEffect(() => {
    if (open) {
      form.reset(getDefaultValues());
    }
  }, [open]);

  return (
    <Modal
      title={t('createGraph', { ns: 'graphtype' })}
      open={open}
      slotProps={{
        footer: {
          onOk: form.handleSubmit(onSubmit),
          okText: t('confirm', { ns: 'common' }),
          cancelText: t('cancel', { ns: 'common' }),
        },
      }}
      onCancel={onCancel}
    >
      <Box sx={{ padding: `${theme.spacing(2)} ${theme.spacing(3)}` }}>
        <FormContainer formContext={form}>
          <Grid container rowSpacing={2}>
            <Grid size={{ md: 12 }}>
              <SelectElement
                label={t('graphType', { ns: 'graphtype' })}
                name="graphType"
                required
                fullWidth
                size="small"
                options={graphTypes}
                onChange={(item) => {
                  form.setValue('graphType', item);
                }}
                labelKey="graph_type"
                valueKey="graph_type"
                SelectProps={{
                  MenuProps: {
                    slotProps: {
                      paper: {
                        sx: {
                          maxHeight: 300,
                          overflowY: 'auto',
                        },
                      },
                    },
                  },
                }}
              />
            </Grid>
            <Grid size={{ md: 12 }} rowSpacing={2}>
              <TextFieldElement
                size="small"
                label={t('graphName', { ns: 'graphtype' })}
                name="graphName"
                required
                fullWidth
              />
            </Grid>
            {/* <Grid item md={12}>
              <CheckboxElement label={t('ifNotExsits', { ns: 'graphtype' })} name="ifNotExists" required />
            </Grid> */}
          </Grid>
        </FormContainer>
      </Box>
    </Modal>
  );
};

export default CreateGraphModal;
