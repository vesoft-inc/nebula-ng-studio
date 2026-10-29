import { Button, styled, Typography, useTheme } from '@mui/material';
import { GraphTypeBuildMode, IEdgeTypeItem, INodeTypeItem } from '../../../schema/types';
import { VisualEditorType } from '../../../shared/constants';
import { useTranslation } from 'react-i18next';
import { ContentCopyFilled, DeleteOutline } from '@vesoft-inc/icons';
import { FormContainer } from 'react-hook-form-mui';
import EdgeTypeConfigForm from '../EdgeType/EdgeTypeConfigForm';
import NodeTypeConfigForm from '../NodeType/NodeTypeConfigForm';
import { ActiveItemInfo } from '../../SchemaEditorState';
import { getEdgeTypeFormValues, getNodeTypeFormValues } from '../formValues';

export const ActionsContainer = styled('div')`
  height: 64px;
  border-bottom: 1px solid ${({ theme }) => theme.palette.vesoft.bgColor11};
  display: flex;
  align-items: center;
  padding: 10px 16px;
`;

export const ConfigForm = ({
  mode,
  activeItem,
  onCopy,
  onDelete,
  onChange,
}: {
  mode: GraphTypeBuildMode;
  activeItem?: ActiveItemInfo | null;
  onCopy: () => void;
  onDelete: () => void;
  onChange: (type: VisualEditorType, values: INodeTypeItem | IEdgeTypeItem) => void;
}) => {
  const theme = useTheme();
  const { t } = useTranslation(['graphtype']);

  return (
    <>
      {mode !== GraphTypeBuildMode.Readonly && (
        <ActionsContainer>
          <Button
            variant="outlined"
            color="primary"
            onClick={onCopy}
            startIcon={<ContentCopyFilled fontSize="medium" />}
          >
            <Typography color="primary">{t('duplicate', { ns: 'graphtype' })}</Typography>
          </Button>
          <Button
            variant="outlined"
            color="error"
            sx={{ marginLeft: theme.spacing(1) }}
            startIcon={<DeleteOutline color="error" fontSize="medium" />}
            onClick={onDelete}
          >
            <Typography color="error">{t('delete', { ns: 'graphtype' })}</Typography>
          </Button>
        </ActionsContainer>
      )}

      {activeItem?.type === VisualEditorType.Tag && (
        <FormContainer key={activeItem.value.id} defaultValues={getNodeTypeFormValues(activeItem.value)}>
          <NodeTypeConfigForm
            colorPicker
            onChange={(values) => {
              onChange(VisualEditorType.Tag, values);
            }}
          />
        </FormContainer>
      )}
      {activeItem?.type === VisualEditorType.Edge && (
        <FormContainer key={activeItem.value.id} defaultValues={getEdgeTypeFormValues(activeItem.value)}>
          <EdgeTypeConfigForm
            colorPicker
            hasSrcAndDstNode
            onChange={(values) => {
              onChange(VisualEditorType.Edge, values);
            }}
          />
        </FormContainer>
      )}
    </>
  );
};
