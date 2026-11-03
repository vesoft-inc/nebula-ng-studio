import { Box, ButtonGroup, Container } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import BreadCrumbs from '../../shared/BreadCrumbs';
import GraphIndex from './GraphIndex';
import StatsInfo from './StatsInfo';
import GroupButton from '../../shared/SegmentButton/index';
import TitleEllipsis from '../../shared/TitleEllipsis/index';

enum GraphFunction {
  Index,
  Statistic,
  Overview,
}

export interface GraphInfoProps {
  graphName: string;
  onBack?: () => void;
}

function GraphInfo({ graphName, onBack }: GraphInfoProps) {
  const { t } = useTranslation(['graph', 'common']);
  const params = { graphName };
  const [curTab, setCurTab] = useState<GraphFunction>(GraphFunction.Index);
  const FunctionTabs = [
    // {
    //   name: t('overview', { ns: 'common' }),
    //   type: GraphFunction.Overview,
    // },
    {
      name: t('index', { ns: 'common' }),
      type: GraphFunction.Index,
    },
    {
      name: t('statistic', { ns: 'common' }),
      type: GraphFunction.Statistic,
    },
  ];

  const getBreadCrumbItems = () => {
    const items = [
      {
        title: t('graphList', { ns: 'route' }),
      },
      {
        title: (
          <TitleEllipsis
            title={params.graphName}
            maxWidth={500}
            slotProps={{
              component: 'span',
            }}
          />
        ),
      },
    ];
    return items;
  };

  return (
    <Container maxWidth="xl">
      <Box display="flex" alignItems="center">
        <BreadCrumbs
          onBack={() => {
            onBack?.();
          }}
          items={getBreadCrumbItems()}
        />
      </Box>
      <Box width="100%" height="100%" display="flex" justifyContent="center" mt={2}>
        <ButtonGroup>
          {FunctionTabs.map((tab) => (
            <GroupButton active={curTab === tab.type} key={tab.type} onClick={() => setCurTab(tab.type)}>
              {tab.name}
            </GroupButton>
          ))}
        </ButtonGroup>
      </Box>
      <Box mt={2}>
        {curTab === GraphFunction.Index && <GraphIndex graphName={graphName} />}
        {curTab === GraphFunction.Statistic && <StatsInfo graphName={graphName} />}
      </Box>
    </Container>
  );
}

export default GraphInfo;
