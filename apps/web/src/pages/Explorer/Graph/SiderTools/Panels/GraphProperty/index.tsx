import { observer } from 'mobx-react-lite';
import { useExplorerStore } from '@studio/pages/Explorer/context';
import { Box, Button, ButtonGroup, Divider, IconButton, List, Typography } from '@mui/material';
import { CloseFilled, KeyVariant } from '@vesoft-inc/icons';
import { useTranslation } from 'react-i18next';
import { GroupButton } from '@vesoft-inc/ui-components';
import { useState } from 'react';
import { GraphEntityType } from '@vesoft-inc/utils';
import CollapseItem from '@studio/components/GraphWorkbench/Collapse';
import { CheckboxButtonGroup, FormContainer, useForm } from 'react-hook-form-mui';
import { DisplayedPropertyItem } from '@studio/interfaces/explorer';

type GraphPropertyForm = {
  propertyGroups: Array<string[] | undefined>;
};

export default observer(function GraphProperty() {
  const { graphWorkspace } = useExplorerStore();
  const { updateActiveSiderKey, graphTypeDetails, isPropertyPrimaryKey } = graphWorkspace;
  const { t } = useTranslation(['explorer']);
  const [curTab, setCurTab] = useState<GraphEntityType>(GraphEntityType.Node);

  const FunctionTabs = [
    {
      name: t('nodeType', { ns: 'explorer' }),
      type: GraphEntityType.Node,
    },
    {
      name: t('edgeType', { ns: 'explorer' }),
      type: GraphEntityType.Edge,
    },
  ];

  const getEntityTypesByType = (entityType: GraphEntityType) => {
    if (!graphTypeDetails) return [];
    if (entityType === GraphEntityType.Node) {
      return graphTypeDetails.filter((item) => item.entity_type === GraphEntityType.Node);
    }
    if (entityType === GraphEntityType.Edge) {
      return graphTypeDetails.filter((item) => item.entity_type === GraphEntityType.Edge);
    }
    return [];
  };

  const getCurrentPropertyGroups = (entityType: GraphEntityType) => {
    const entityTypes = getEntityTypesByType(entityType);
    const { displayedNodePropertyItems, displayedEdgePropertyItems } = graphWorkspace.graph;
    const displayedPropertyItems =
      entityType === GraphEntityType.Node ? displayedNodePropertyItems : displayedEdgePropertyItems;
    return entityTypes.map((entityType) => {
      const displayedPropertyItem = displayedPropertyItems.find((item) => item.type_name === entityType.type_name);
      if (displayedPropertyItem) {
        return displayedPropertyItem.properties;
      }
      return undefined;
    });
  };

  const form = useForm<GraphPropertyForm>({
    defaultValues: {
      propertyGroups: getCurrentPropertyGroups(curTab),
    },
  });

  const handleConfirm = async (formValues: GraphPropertyForm) => {
    const { propertyGroups } = formValues;
    // const avaliableEntityTypes = entityTypes.filter(e => e.properties.length);
    const entityTypes = getEntityTypesByType(curTab);
    const displayedPropertyItems = propertyGroups.map((group, index) => {
      const entityType = entityTypes[index];
      return {
        type_name: entityType.type_name,
        properties: group,
      } as DisplayedPropertyItem;
    });
    // .filter((item) => item.properties && item.properties.length > 0);
    if (curTab === GraphEntityType.Node) {
      graphWorkspace.graph.updateNodeDisplayedPropertyItems(displayedPropertyItems);
    } else if (curTab === GraphEntityType.Edge) {
      graphWorkspace.graph.updateEdgeDisplayedPropertyItems(displayedPropertyItems);
    }
  };

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
        {t('viewProperty', { ns: 'explorer' })}
        <IconButton
          onClick={() => {
            updateActiveSiderKey(undefined);
          }}
        >
          <CloseFilled />
        </IconButton>
      </Typography>
      <Divider />
      <ButtonGroup sx={{ mt: 1.25 }} fullWidth size="small">
        {FunctionTabs.map((tab) => (
          <GroupButton
            key={tab.type}
            active={curTab === tab.type}
            onClick={() => {
              setCurTab(tab.type);
              // form.reset({propertyGroups: getCurrentPropertyGroups(tab.type)}, { keepDirtyValues: false });
              form.setValue('propertyGroups', getCurrentPropertyGroups(tab.type));
            }}
            variant={curTab === tab.type ? 'contained' : 'outlined'}
          >
            {tab.name}
          </GroupButton>
        ))}
      </ButtonGroup>
      <Box
        mt={2}
        maxHeight="calc(100% - 36px)"
        sx={{
          overflowY: 'auto',
        }}
      >
        <List sx={{ width: '100%' }} disablePadding component="nav">
          <FormContainer formContext={form}>
            {getEntityTypesByType(curTab).map((item, index) => (
              <CollapseItem
                title={item.type_name}
                key={item.type_name}
                defaultOpen
                slotProps={{
                  subItemSx: {
                    pl: 0,
                  },
                }}
              >
                <Box pl={0.5}>
                  {item.propertyInfos.length ? (
                    <CheckboxButtonGroup
                      name={`propertyGroups[${index}]`}
                      options={item.propertyInfos.map((property) => ({
                        id: property.property_name,
                        label: (
                          <Box display="flex" alignItems="center">
                            {property.property_name}
                            {item.entity_type === GraphEntityType.Node &&
                              isPropertyPrimaryKey(item.type_name, property.property_name) && (
                                <KeyVariant
                                  fontSize="small"
                                  sx={{
                                    ml: 1,
                                    color: (theme) => theme.palette.vesoft.v2.text3,
                                    fontSize: 14,
                                  }}
                                />
                              )}
                          </Box>
                        ),
                      }))}
                    />
                  ) : (
                    <Typography
                      width="100%"
                      textAlign="center"
                      fontSize={12}
                      sx={{ color: (theme) => theme.palette.vesoft.v2.text4 }}
                    >
                      {t('noProperty', { ns: 'explorer' })}
                    </Typography>
                  )}
                </Box>
                <Divider component="hr" sx={{ my: 1 }} />
              </CollapseItem>
            ))}
          </FormContainer>
        </List>
      </Box>
      <Button sx={{ mt: 2 }} variant="contained" fullWidth onClick={form.handleSubmit(handleConfirm)}>
        {t('confirm', { ns: 'explorer' })}
      </Button>
    </Box>
  );
});
