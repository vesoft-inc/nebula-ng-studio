import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form-mui';
import { EdgeDirectionType, MultiEdgeKeyMode } from '@vesoft-inc/utils';
import { Modal } from '@vesoft-inc/ui-components';
import { useTranslation } from 'react-i18next';

import { useStore } from '@studio/stores';
import { IEdgeTypeItem, INodeTypeItem } from '@studio/interfaces';
import EdgeTypeConfigForm from './EdgeTypeConfigForm';

interface EdgeTypeModalProps {
  edgeTypeItem?: IEdgeTypeItem;
  open: boolean;
  onCancel: () => void;
}

const getDefaultValues = () => ({
  name: '',
  properties: [],
  labels: [],
  direction: null as unknown as EdgeDirectionType,
  srcNode: null as unknown as INodeTypeItem,
  dstNode: null as unknown as INodeTypeItem,
  multiEdgeKeyMode: null as unknown as MultiEdgeKeyMode,
});

function EdgeTypeConfigModal(props: EdgeTypeModalProps) {
  const { edgeTypeItem, open, onCancel } = props;
  const { t } = useTranslation(['graphtype', 'common']);
  const { schemaStore } = useStore().graphtypeStore;

  const form = useForm<IEdgeTypeItem>({
    defaultValues: getDefaultValues(),
  });

  useEffect(() => {
    if (open) {
      if (edgeTypeItem) {
        form.reset(new IEdgeTypeItem(edgeTypeItem));
      } else {
        form.reset(getDefaultValues());
      }
    }
  }, [open, edgeTypeItem]);

  const onSubmit = (values: IEdgeTypeItem) => {
    if (edgeTypeItem) {
      schemaStore?.updateEdgeType(edgeTypeItem.id, values);
    } else {
      schemaStore?.addEdgeType(new IEdgeTypeItem(values));
    }
    onCancel();
  };

  return (
    <Modal
      title={edgeTypeItem ? t('editEdgeType', { ns: 'graphtype' }) : t('createEdgeType', { ns: 'graphtype' })}
      open={open}
      onOk={form.handleSubmit(onSubmit)}
      onCancel={onCancel}
      slotProps={{
        content: {
          dividers: true,
        },
        footer: {
          okText: edgeTypeItem ? t('confirm', { ns: 'common' }) : t('create', { ns: 'common' }),
          cancelText: t('cancel', { ns: 'common' }),
        },
      }}
      scroll="paper"
    >
      <FormProvider {...form}>
        <EdgeTypeConfigForm
          slotProps={{
            propertyList: {
              sx: {
                maxHeight: 240,
                overflow: 'auto',
              },
            },
          }}
        />
      </FormProvider>
    </Modal>
  );
}

export default EdgeTypeConfigModal;
