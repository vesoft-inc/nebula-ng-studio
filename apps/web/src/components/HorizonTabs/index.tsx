import { Box, SxProps, Tab, Tabs, Theme, useTheme } from '@mui/material';
import { ReactNode } from 'react';

export interface HorizonTabItem {
  key: string;
  label: ReactNode;
  icon: ReactNode;
  disabled?: boolean;
  sx?: SxProps<Theme>;
}

export const HorizonTabs = ({
  items,
  value,
  onMenuClick,
}: {
  items: HorizonTabItem[];
  value: string;
  onMenuClick: (key: string) => void;
}) => {
  const theme = useTheme();
  return (
    <Tabs
      value={value}
      onChange={(_, newValue) => onMenuClick(newValue)}
      variant="scrollable"
      scrollButtons="auto"
      sx={{
        '& .MuiTabs-indicator': {
          backgroundColor: theme.palette.vesoft.themeColor1,
        },
        '& .MuiTab-root': {
          textTransform: 'none',
          fontSize: '0.875rem',
          color: theme.palette.vesoft.textColor1,
          '&.Mui-selected': {
            color: theme.palette.vesoft.themeColor1,
          },
          padding: '12px',
        },
      }}
    >
      {items.map((item) => (
        <Tab
          key={item.key}
          value={item.key}
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {item.icon}
              {item.label}
            </Box>
          }
          disabled={item.disabled}
        />
      ))}
    </Tabs>
  );
};
