import { Box, Typography, LinearProgress, ButtonGroup, ListItem } from '@mui/material';
import { styled } from '@mui/material/styles';

// 耳朵控制器样式
export const DrawerToggle = styled(Box)(({ theme }) => ({
  position: 'absolute',
  left: -13,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 12,
  height: 40,
  backgroundColor: theme.palette.vesoft.v2.bg1,
  border: `1px solid ${theme.palette.vesoft.v2.divider1}`,
  borderRight: 'none',
  borderTopLeftRadius: 6,
  borderBottomLeftRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  zIndex: 11,
  // boxShadow: theme.shadows[4],
  '&:hover': {
    backgroundColor: theme.palette.vesoft.v2.bg2,
  },
  transition: 'background-color 0.2s ease',
}));

export const DrawerContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'collapsed',
})<{ collapsed: boolean }>(({ theme, collapsed }) => ({
  position: 'absolute',
  top: 0,
  right: collapsed ? -350 : 0,
  width: 350,
  height: '100%',
  backgroundColor: theme.palette.vesoft.v2.bg1,
  borderLeft: `1px solid ${theme.palette.vesoft.v2.divider1}`,
  // boxShadow: theme.shadows[8],
  zIndex: 10,
  overflow: 'visible',
  transition: 'right 0.3s ease-in-out',
}));

// 内容容器，处理滚动
export const DrawerContent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  height: '100%',
  overflow: 'auto', // 内容区域处理滚动
}));

export const DrawerHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
}));

export const SectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: 16,
  fontWeight: 600,
  color: theme.palette.vesoft.v2.text1,
  marginBottom: theme.spacing(2),
}));

export const StyledButtonGroup = styled(ButtonGroup)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

export const StatItem = styled(ListItem, {
  shouldForwardProp: (prop) => prop !== 'clickable',
})<{ clickable?: boolean }>(({ theme, clickable = false }) => ({
  padding: theme.spacing(1, 1),
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  borderRadius: theme.spacing(1),
  margin: theme.spacing(0.5, 0),
  cursor: clickable ? 'pointer' : 'default',
  transition: 'all 0.2s ease-in-out',
  border: '1px solid transparent',
  backgroundColor: 'transparent',

  ...(clickable && {
    '&:hover': {
      backgroundColor: theme.palette.vesoft.v2.bg2,
      border: `1px solid ${theme.palette.vesoft.v2.border2}`,
      transform: 'translateY(-1px)',
      '& .stat-node-name': {
        color: theme.palette.vesoft.v2.primary1,
      },
      '& .stat-value': {
        color: theme.palette.vesoft.v2.text1,
        fontWeight: 600,
      },
    },
    '&:active': {
      transform: 'translateY(0px)',
    },
  }),
}));

export const StatValue = styled(Typography)(({ theme }) => ({
  fontSize: 14,
  color: theme.palette.vesoft.v2.text1,
  fontWeight: 500,
  transition: 'all 0.2s ease-in-out',
}));

export const TimeBreakdownItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(1.5),
}));

export const TimeLabel = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

export const TimeIndicator = styled(Box)<{ color: string }>(({ color }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: color,
}));

export const TimeValue = styled(Typography)(({ theme }) => ({
  fontSize: 14,
  color: theme.palette.vesoft.v2.text1,
  fontWeight: 500,
}));

export const ProgressContainer = styled(Box)(({ theme }) => ({
  margin: theme.spacing(1, 0),
}));

export const CustomLinearProgress = styled(LinearProgress)(({ theme }) => ({
  height: 8,
  borderRadius: 4,
  backgroundColor: theme.palette.vesoft.v2.border2,
  '& .MuiLinearProgress-bar': {
    borderRadius: 4,
    background: `linear-gradient(90deg, 
      ${theme.palette.vesoft.v2.primary1} 0%, 
      ${theme.palette.vesoft.v2.primary2} 25%, 
      ${theme.palette.vesoft.v2.warning1} 50%, 
      ${theme.palette.vesoft.v2.error1} 75%, 
      ${theme.palette.vesoft.v2.success1} 100%)`,
  },
}));

// 信息项样式
export const InfoListItem = styled(ListItem)(({ theme }) => ({
  padding: theme.spacing(0.5, 0),
  justifyContent: 'space-between',
  alignItems: 'flex-start',
}));

export const InfoLabel = styled(Typography)(({ theme }) => ({
  fontSize: 14,
  color: theme.palette.vesoft.v2.text2,
  marginRight: 0.5,
}));

export const InfoValue = styled(Typography)(({ theme }) => ({
  fontSize: 14,
  color: theme.palette.vesoft.v2.text1,
  fontWeight: 500,
}));

export const InfoValueMonospace = styled(InfoValue)(() => ({
  fontFamily: 'monospace',
  textAlign: 'right',
  wordBreak: 'break-all',
}));
