import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form-mui';
import { EdgeDirectionType, MultiEdgeKeyMode } from '@vesoft-inc/studio-core/contracts';
import { Modal } from '../../../shared/index';
import { useTranslation } from 'react-i18next';

import { useGraphTypeStore } from '../../context';
import { IEdgeTypeItem, INodeTypeItem } from '../../../schema/types';
import EdgeTypeConfigForm from './EdgeTypeConfigForm';
import { getEdgeTypeFormValues, getPropertyModel } from '../formValues';
import { getPropertyDecimalError } from '../validation';

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
  const { schemaStore, canvasStore } = useGraphTypeStore();

  const form = useForm<IEdgeTypeItem>({
    defaultValues: getDefaultValues(),
  });

  useEffect(() => {
    if (open) {
      canvasStore?.selectItem(null);
      if (edgeTypeItem) {
        form.reset(getEdgeTypeFormValues(edgeTypeItem));
      } else {
        form.reset(getDefaultValues());
      }
    }
  }, [open, edgeTypeItem]);

  const onSubmit = (values: IEdgeTypeItem) => {
    if (values.properties.some(getPropertyDecimalError)) return;
    const edge = new IEdgeTypeItem({
      ...values,
      properties: values.properties.map(getPropertyModel),
    });
    if (edgeTypeItem) {
      schemaStore?.commitEdgeChanges(edgeTypeItem.id, edge);
    } else {
      schemaStore?.addEdgeType(edge);
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
