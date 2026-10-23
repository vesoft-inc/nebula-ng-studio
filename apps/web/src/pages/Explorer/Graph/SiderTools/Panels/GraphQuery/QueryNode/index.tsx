import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, Divider, Button, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { IconButton, Typography } from '@mui/material';
import { CloseFilled } from '@vesoft-inc/icons';
import { DescGraphTypeResult, DescNodeTypeResult } from '@vesoft-inc/utils';
import { useExplorerStore } from '@studio/pages/Explorer/context';
import { SiderPanel } from '@studio/interfaces/explorer/explorer';
import { QueryTitle } from '../styles';
import { FormContainer, SelectElement, TextFieldElement, useForm } from 'react-hook-form-mui';
import { SelectProps } from '@studio/utils/graph/helpers';

type QueryNodeForm = {
  nodeType: DescGraphTypeResult['type_name'];
  propertyName: string;
  values: string;
};

export default observer(function PrimaryKey() {
  const { graphWorkspace } = useExplorerStore();
  const { t } = useTranslation(['explorer']);
  const [properties, setProperties] = useState<DescNodeTypeResult[]>([]);

  const handleQueryNode = async (formValues: QueryNodeForm) => {
    const { graph } = graphWorkspace;
    const { nodeType, propertyName, values } = formValues;
    const property = properties.find((property) => property.property_name === propertyName);
    if (!property) throw new Error('property not found');
    const finValues = values.split(/\r?\n/).filter((v) => v.trim().length > 0);
    await graph.queryNode(nodeType, property, finValues);
  };

  const form = useForm<QueryNodeForm>({
    defaultValues: {},
  });

  const curNodeType = form.watch('nodeType');

  useEffect(() => {
    const selectedNodeType = graphWorkspace.curNodeTypes.find((nodeType) => nodeType.type_name === curNodeType);
    if (selectedNodeType) {
      setProperties([...(selectedNodeType.propertyInfos as DescNodeTypeResult[])]);
    } else {
      setProperties([]);
    }
  }, [curNodeType, graphWorkspace.curNodeTypes]);

  return (
    <Box display="flex" flexDirection="column" height="100%">
      <Typography
        fontWeight={500}
        sx={{ color: (theme) => theme.palette.vesoft.textColor1 }}
        flex={0}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
      >
        {t('queryNode', { ns: 'explorer' })}
        <IconButton
          onClick={() => {
            graphWorkspace.updateActiveSiderKey(SiderPanel.GraphQuery);
          }}
        >
          <CloseFilled />
        </IconButton>
      </Typography>
      <Divider />
      <QueryTitle my={2}>{t('type', { ns: 'explorer' })}</QueryTitle>
      <FormContainer formContext={form}>
        <SelectElement
          name="nodeType"
          label={t('nodeType', { ns: 'explorer' })}
          fullWidth
          size="small"
          labelKey="label"
          valueKey="value"
          required
          SelectProps={SelectProps}
          options={graphWorkspace.curNodeTypes.map((nodeType) => ({
            label: nodeType.type_name,
            value: nodeType.type_name,
          }))}
        />
        <SelectElement
          name="propertyName"
          label={t('propertyName', { ns: 'explorer' })}
          fullWidth
          size="small"
          labelKey="label"
          valueKey="value"
          required
          sx={{ mt: 2.5 }}
          SelectProps={{
            ...SelectProps,
          }}
          options={properties.map((property, index) => ({
            label: (
              <Box key={index} textTransform="none">
                {property.property_name} <Chip size="small" label={property.data_type} />
              </Box>
            ),
            value: property.property_name,
          }))}
          objectOnChange
        />
        <TextFieldElement
          fullWidth
          multiline
          name="values"
          required
          label={t('propertyValue', { ns: 'explorer' })}
          rows={8}
          placeholder={t('propertyPlaceHolder', { ns: 'explorer' })}
          sx={{ mt: 2.5, flex: 0 }}
        />
      </FormContainer>
      <Button
        sx={{ mt: 2 }}
        variant="contained"
        fullWidth
        onClick={form.handleSubmit(handleQueryNode)}
        disabled={!form.formState.isValid}
      >
        {t('query', { ns: 'explorer' })}
      </Button>
    </Box>
  );
});
