import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import List from '@mui/material/List';
import Collapse from '@mui/material/Collapse';
import { TransitionGroup } from 'react-transition-group';
import { ConsoleResult } from '../types';
import OutputBox from '../QueryResultCard/index';
import { GraphDataTable } from '../../graph/types/console';
import introLogoLight from '../../assets/intro_logo_light.svg';
import introLogoDark from '../../assets/intro_logo_dark.svg';
import { Box, Stack, useTheme } from '@mui/material';
import { AddFilled } from '@vesoft-inc/icons';

function Results({ results, emptyState }: { results: ConsoleResult<GraphDataTable>[]; emptyState?: ReactNode }) {
  const theme = useTheme();
  const { t } = useTranslation(['console']);
  const isDark = theme.palette.mode === 'dark';
  const introLogoUrl = isDark ? introLogoDark : introLogoLight;

  const Hotkey = ({ children }: { children: React.ReactNode }) => (
    <Stack
      sx={{
        minWidth: 32,
        height: 32,
        padding: '8px',
        justifyContent: 'center',
        alignItems: 'center',
        border: '1px solid',
        borderRadius: '4px',
        borderColor: (theme) => theme.palette.vesoft.v2.divider1,
        backgroundColor: (theme) => theme.palette.vesoft.v2.bg1,
        fontSize: '12px',
        fontWeight: 500,
      }}
    >
      {children}
    </Stack>
  );

  const IntroPage = () => (
    <Stack
      direction="row"
      sx={{
        flex: 'auto',
        pt: 0,
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        px: 4,
      }}
    >
      <Box
        component="img"
        src={introLogoUrl}
        sx={{
          width: '150px',
          height: '150px',
          objectFit: 'contain',
          flexShrink: 0,
        }}
      />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '24px',
          width: '100px',
          fontSize: '14px',
          fontWeight: 500,
          lineHeight: '20px',
          color: (theme) => theme.palette.vesoft.v2.text3,
          '& > *': {
            minHeight: '32px',
            lineHeight: '32px',
          },
        }}
      >
        <div>{t('focusEditor', { ns: 'console' })}</div>
        <div>{t('runGql', { ns: 'console' })}</div>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '24px',
          fontSize: '14px',
          fontWeight: 500,
          lineHeight: '20px',
          color: (theme) => theme.palette.vesoft.v2.text3,
        }}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Hotkey>/</Hotkey>
        </Stack>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Hotkey>⇧ Shift</Hotkey>
          <AddFilled sx={{ color: (theme) => theme.palette.vesoft.v2.text4 }} />
          <Hotkey>⏎ Enter</Hotkey>
        </Stack>
      </Box>
    </Stack>
  );

  return (
    <TransitionGroup
      component={List}
      sx={{
        flex: 'auto',
        pt: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {results.length <= 0 ? (
        <Collapse key="intro-page">{emptyState === undefined ? <IntroPage /> : emptyState}</Collapse>
      ) : (
        results.map((result) => (
          <Collapse key={result.id}>
            <OutputBox result={result as ConsoleResult<GraphDataTable>} />
          </Collapse>
        ))
      )}
    </TransitionGroup>
  );
}

const observedResults = observer(Results);

export default observedResults;
