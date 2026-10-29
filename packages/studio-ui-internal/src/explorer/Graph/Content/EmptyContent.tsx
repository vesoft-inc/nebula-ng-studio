import { Box, Button, Typography, useTheme } from '@mui/material';
import { observer } from 'mobx-react-lite';
import graphEmptyBgDark from '../../../assets/images/graph-empty-bg-dark.svg?url';
import graphEmptyBgLight from '../../../assets/images/graph-empty-bg-light.svg?url';
import { useTranslation } from 'react-i18next';
import type { GraphWorkspaceStore } from '../../../graph/stores/workspace';

const rectWidth = 320;
const rectHeight = 320;

const EmptyContent = ({ explorerItem }: { explorerItem: GraphWorkspaceStore }) => {
  const { t } = useTranslation(['explorer']);
  const theme = useTheme();
  const { graph } = explorerItem;
  const isDarkMode = theme.palette.mode === 'dark';
  const handleInitSubGraph = async () => {
    await graph.queryRandom();
  };

  return (
    <Box
      position="absolute"
      top={`calc(50% - ${rectHeight / 2}px - 60px)`}
      left={`calc(50% - ${rectWidth / 2}px)`}
      sx={{
        width: 340,
        height: 320,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      <Box
        component="img"
        src={isDarkMode ? graphEmptyBgDark : graphEmptyBgLight}
        sx={{
          width: '100%',
          height: '100%',
          position: 'absolute',
        }}
      />
      <Typography
        sx={{
          fontWeight: 500,
          fontSize: 24,
          color: (theme) => theme.palette.vesoft.v2.text2,
          marginBottom: 2,
          letterSpacing: 0.5,
          zIndex: 1,
        }}
      >
        {t('noData', { ns: 'explorer' })}
      </Typography>
      <Button
        variant="outlined"
        onClick={handleInitSubGraph}
        sx={{
          color: (theme) => theme.palette.vesoft.v2.text2,
          borderColor: (theme) => theme.palette.vesoft.v2.border1,
          borderRadius: 2,
          padding: '4px 16px',
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: 0.46,
          textTransform: 'none',
        }}
      >
        {t('showMeASubGraph', { ns: 'explorer' })}
      </Button>
    </Box>
  );
};

export default observer(EmptyContent);
