import { useState, lazy, Suspense } from 'react';
import { observer } from 'mobx-react-lite';
import { Box, FormControl, FormControlLabel, IconButton, Radio, RadioGroup } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { GraphEntityType } from '@vesoft-inc/utils';
import { NoopComponent } from '@studio/utils/explorer/helper';
import PageLoading from '@studio/components/GraphWorkbench/PageLoading';
// import { GroupButton } from '@vesoft-inc/ui-components';
import { ChevronRightFilled, ChevronLeftFilled } from '@vesoft-inc/icons';
import type TypeMode from './TypeMode';
import type LabelMode from './LabelMode';
import type { GraphWorkspaceStore } from '@studio/stores/graph/workspace';

enum SidePanelFunction {
  Label = 'Label',
  Data = 'Data',
  Type = 'Type',
}

const CompMap: {
  [k in SidePanelFunction]?: React.LazyExoticComponent<typeof TypeMode | typeof LabelMode>;
} = {
  [SidePanelFunction.Type]: lazy(() => import('./TypeMode')),
  [SidePanelFunction.Label]: lazy(() => import('./LabelMode')),
};

function RightSideTool({
  explorerItem,
  allowRemoteIconManagement = false,
}: {
  explorerItem: GraphWorkspaceStore;
  allowRemoteIconManagement?: boolean;
}) {
  const { t } = useTranslation(['explorer']);
  // const [curTab, setCurTab] = useState<SidePanelFunction>(SidePanelFunction.Type);
  const [curEntityType, setCurEntityType] = useState<GraphEntityType | 'all'>('all');
  // const FunctionTabs = [
  //   {
  //     name: t('type', { ns: 'explorer' }),
  //     type: SidePanelFunction.Type,
  //   },
  //   {
  //     name: t('label', { ns: 'explorer' }),
  //     type: SidePanelFunction.Label,
  //   },
  // ];

  const Comp = CompMap[SidePanelFunction.Type] || NoopComponent;

  return (
    <Box width="100%" height="100%" display="flex" flexDirection="column" alignItems="center">
      {/* <ButtonGroup fullWidth size="small">
        {FunctionTabs.map((tab) => (
          <GroupButton
            key={tab.type}
            active={curTab === tab.type}
            onClick={() => setCurTab(tab.type)}
            variant={curTab === tab.type ? 'contained' : 'outlined'}
          >
            {tab.name}
          </GroupButton>
        ))}
      </ButtonGroup> */}
      <FormControl>
        <RadioGroup
          row
          sx={{ marginY: 1 }}
          name="entityType"
          value={curEntityType}
          onChange={(e) => setCurEntityType(e.target.value as GraphEntityType | 'all')}
        >
          <FormControlLabel value={'all'} control={<Radio />} label={t('all', { ns: 'explorer' })} />
          <FormControlLabel
            value={GraphEntityType.Node}
            control={<Radio />}
            label={t('nodeType', { ns: 'explorer' })}
          />
          <FormControlLabel
            value={GraphEntityType.Edge}
            control={<Radio />}
            label={t('edgeType', { ns: 'explorer' })}
          />
        </RadioGroup>
      </FormControl>
      <Suspense fallback={<PageLoading />}>
        <Comp
          entityType={curEntityType}
          explorerItem={explorerItem}
          allowRemoteIconManagement={allowRemoteIconManagement}
        />
      </Suspense>
    </Box>
  );
}

const observedRightSideTool = observer(RightSideTool);

function Drawer({ explorerItem }: { explorerItem: GraphWorkspaceStore }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Toggle Button */}
      <IconButton
        onClick={toggleDrawer}
        sx={{
          position: 'absolute',
          top: '50%',
          right: 0,
          transform: `translateY(-50%) translateX(${isOpen ? '-348px' : '0'})`,
          zIndex: (theme) => theme.zIndex.drawer,
          backgroundColor: (theme) => theme.palette.vesoft.v2.bg1,
          border: (theme) => `1px solid ${theme.palette.vesoft.v2.divider2}`,
          borderRight: 'none',
          borderRadius: '6px 0 0 6px',
          width: 12,
          height: 40,
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            backgroundColor: (theme) => theme.palette.vesoft.v2.bg2,
          },
        }}
      >
        {isOpen ? (
          <ChevronRightFilled
            sx={{
              color: (theme) => theme.palette.vesoft.v2.text3,
              fontSize: 18,
            }}
          />
        ) : (
          <ChevronLeftFilled
            sx={{
              color: (theme) => theme.palette.vesoft.v2.text3,
              fontSize: 18,
            }}
          />
        )}
      </IconButton>

      {/* Drawer Panel */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 348,
          height: '100%',
          backgroundColor: (theme) => theme.palette.vesoft.v2.bg1,
          borderLeft: (theme) => `1px solid ${theme.palette.vesoft.v2.divider2}`,
          transform: `translateX(${isOpen ? '0' : '100%'})`,
          transition: 'transform 0.3s ease-in-out',
          zIndex: (theme) => theme.zIndex.drawer,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: '12px',
        }}
      >
        <RightSideTool explorerItem={explorerItem} />
      </Box>
    </>
  );
}

export const RightSideToolDrawer = observer(Drawer);

export default observedRightSideTool;
