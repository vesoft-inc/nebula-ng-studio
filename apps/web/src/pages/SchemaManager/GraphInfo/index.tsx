import { Box, ButtonGroup, Container } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { BreadCrumbs } from '@vesoft-inc/ui-components';
import GraphIndex from './GraphIndex';
import StatsInfo from './StatsInfo';
import GroupButton from '@studio/components/GroupButton';
import TitleEllipsis from '@studio/components/TitleEllipsis';

enum GraphFunction {
  Index,
  Statistic,
  Overview,
}

function GraphInfo() {
  const navigate = useNavigate();
  const { t } = useTranslation(['graph', 'common']);
  const params = useParams<{ graphName: string }>();
  const [curTab, setCurTab] = useState<GraphFunction>(GraphFunction.Index);
  const pathnames = location.pathname.split('/');
  const graphsIndex = pathnames.indexOf('graphs');
  const basePaths = pathnames.slice(0, graphsIndex + 1);
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
        to: basePaths.join('/'),
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
            navigate(-1);
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
        {curTab === GraphFunction.Index && <GraphIndex />}
        {curTab === GraphFunction.Statistic && <StatsInfo />}
      </Box>
    </Container>
  );
}

export default GraphInfo;
