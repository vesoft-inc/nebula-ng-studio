import { Modal } from '@vesoft-inc/ui-components';
import { useTranslation } from 'react-i18next';
import { FormContainer, useForm } from 'react-hook-form-mui';

import { useStore } from '@studio/stores';
import { INodeTypeItem } from '@studio/interfaces';
import NodeTypeConfigForm from './NodeTypeConfigForm';
import { useEffect } from 'react';
import { getNodeTypeFormValues } from '../formValues';
import { setActiveItem } from '../VisualBuilder/store';

interface NodeTypeModalProps {
  open: boolean;
  onCancel: () => void;
  nodeTypeItem?: INodeTypeItem;
}

function NodeTypeConfigModal(props: NodeTypeModalProps) {
  const { nodeTypeItem, open, onCancel } = props;
  const { t } = useTranslation(['graphtype', 'common']);
  const { schemaStore } = useStore().graphtypeStore;

  const form = useForm<INodeTypeItem>({
    defaultValues: {
      properties: [],
    },
  });

  useEffect(() => {
    if (open) {
      // Do not leave a second editor mounted with stale values for this node.
      setActiveItem(null);
      form.reset(getNodeTypeFormValues(new INodeTypeItem(nodeTypeItem)));
    }
  }, [open, nodeTypeItem]);

  const hanleOk = () => {
    form.handleSubmit(onSubmit)();
  };

  const onSubmit = (values: INodeTypeItem) => {
    if (nodeTypeItem) {
      schemaStore?.updateNodeType(nodeTypeItem.id, new INodeTypeItem(values));
    } else {
      schemaStore?.addNodeType(new INodeTypeItem(values));
    }
    onCancel();
  };

  return (
    <Modal
      title={nodeTypeItem ? t('editNodeType', { ns: 'graphtype' }) : t('createNodeType', { ns: 'graphtype' })}
      onCancel={onCancel}
      open={open}
      onOk={hanleOk}
      slotProps={{
        content: {
          dividers: true,
        },
        footer: {
          okText: nodeTypeItem ? t('confirm', { ns: 'common' }) : t('create', { ns: 'common' }),
          cancelText: t('cancel', { ns: 'common' }),
        },
      }}
      scroll="paper"
    >
      <FormContainer formContext={form}>
        <NodeTypeConfigForm
          slotProps={{
            propertyList: {
              sx: {
                maxHeight: 300,
                overflow: 'auto',
              },
            },
          }}
        />
      </FormContainer>
    </Modal>
  );
}

export default NodeTypeConfigModal;
