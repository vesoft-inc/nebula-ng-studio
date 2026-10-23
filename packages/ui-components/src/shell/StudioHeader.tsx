import { useState, type ReactNode, type MouseEvent } from 'react';
import {
  AppBar,
  Box,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  Toolbar,
  Typography,
  useTheme,
} from '@mui/material';
import { AccountCircleFilled, Logout, MoonWaxingCrescent, Web, WhiteBalanceSunny } from '@vesoft-inc/icons';
import { useTranslation } from 'react-i18next';
import TitleEllipsis from '../shared/TitleEllipsis';

export interface NavigationItem {
  key: string;
  label: ReactNode;
  href?: string;
}
export interface StudioNavigationProps {
  items: NavigationItem[];
  value?: string;
  onNavigate?: (key: string) => void;
  height?: number;
}
export function StudioNavigation({ items, value, onNavigate, height = 64 }: StudioNavigationProps) {
  return (
    <Tabs
      value={value ?? false}
      sx={{ ml: 2, height }}
      TabIndicatorProps={{ sx: { backgroundColor: (theme) => theme.palette.vesoft.themeColor1 } }}
    >
      {items.map((item) => (
        <Tab
          key={item.key}
          value={item.key}
          label={<Typography component="span">{item.label}</Typography>}
          component={item.href ? 'a' : 'button'}
          href={item.href}
          sx={{ fontWeight: 'bold', height }}
          onClick={(event: MouseEvent<HTMLElement>) => {
            if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
            if (onNavigate) {
              event.preventDefault();
              onNavigate(item.key);
            }
          }}
        />
      ))}
    </Tabs>
  );
}

export function LanguageSwitcher({
  onChange,
  languages = [
    { value: 'en_US', label: 'English' },
    { value: 'zh_CN', label: '中文' },
  ],
}: {
  onChange: (locale: string) => void;
  languages?: { value: string; label: string }[];
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <IconButton aria-label="Language" aria-haspopup="menu" onClick={(e) => setAnchor(e.currentTarget)}>
        <Web sx={{ fill: (theme) => theme.palette.vesoft.v2.text3, width: 24, height: 24 }} />
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {languages.map((language) => (
          <MenuItem
            key={language.value}
            onClick={() => {
              onChange(language.value);
              setAnchor(null);
            }}
          >
            {language.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

export function ThemeToggle({ onToggle }: { onToggle: () => void }) {
  const theme = useTheme();
  const Icon = theme.palette.mode === 'dark' ? WhiteBalanceSunny : MoonWaxingCrescent;
  return (
    <IconButton aria-label="Toggle theme" onClick={() => onToggle()}>
      <Icon sx={{ fill: theme.palette.vesoft.v2.text3, width: 22, height: 22 }} />
    </IconButton>
  );
}

export interface UserMenuProps {
  user?: { username?: string; address?: string };
  versions?: { label: string; value: string }[];
  onDisconnect?: () => void;
  disconnectLabel?: ReactNode;
  compact?: boolean;
}
export function UserMenu({ user, versions, onDisconnect, disconnectLabel, compact = false }: UserMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { t } = useTranslation('common');
  const rowStyle = { display: 'flex', '&:hover': { backgroundColor: 'transparent', cursor: 'initial' } };
  return (
    <>
      <IconButton aria-label={user?.username || 'Account'} onClick={(e) => setAnchor(e.currentTarget)}>
        <AccountCircleFilled color="primary" sx={{ width: 27, height: 27 }} />
      </IconButton>
      <Menu
        anchorEl={user ? anchor : null}
        open={!!anchor && !!user}
        onClose={() => setAnchor(null)}
        slotProps={{ list: { sx: compact ? { py: 0, minWidth: 200 } : { p: 2, pb: 1 } } }}
      >
        <MenuItem sx={{ ...rowStyle, py: compact ? 1.5 : 1, pl: compact ? undefined : 0 }}>
          <AccountCircleFilled fontSize="large" color="primary" />
          <Box ml={1} fontSize={12}>
            <Box fontWeight="bold">{user?.username}</Box>
            <Box display="flex" alignItems="center" mt={0.5}>
              Graphd:
              <TitleEllipsis title={user?.address} maxWidth={200} slotProps={{ fontSize: 12, fontWeight: 400 }} />
            </Box>
          </Box>
        </MenuItem>
        <Divider />
        {!!versions?.length && (
          <MenuItem sx={{ ...rowStyle, p: 1, pl: 0 }}>
            <Box fontSize={14} lineHeight={2}>
              {versions.map(({ label, value }) => (
                <Box key={label} display="flex" alignItems="center">
                  {label}:{' '}
                  <Box ml={1} fontWeight="bold">
                    {value}
                  </Box>
                </Box>
              ))}
            </Box>
          </MenuItem>
        )}
        {!!versions?.length && <Divider />}
        {onDisconnect && (
          <MenuItem
            onClick={() => {
              setAnchor(null);
              onDisconnect();
            }}
            sx={{
              py: 1,
              px: compact ? 2.5 : 0,
              fontSize: 14,
              '&:hover': { backgroundColor: 'transparent', color: (theme) => theme.palette.vesoft.themeColor1 },
            }}
          >
            {disconnectLabel ?? t('clearConnect')} <Logout sx={{ ml: 2 }} />
          </MenuItem>
        )}
      </Menu>
    </>
  );
}

export interface StudioHeaderProps extends UserMenuProps {
  logo: ReactNode;
  navigation?: StudioNavigationProps;
  height?: number;
  onLanguageChange?: (locale: string) => void;
  onToggleTheme?: () => void;
  actions?: ReactNode;
  connectionAction?: ReactNode;
  actionOrder?: 'language-theme' | 'theme-language';
}
export function StudioHeader({
  logo,
  navigation,
  height = 64,
  onLanguageChange,
  onToggleTheme,
  actions,
  connectionAction,
  actionOrder = 'language-theme',
  ...userMenu
}: StudioHeaderProps) {
  const language = onLanguageChange && <LanguageSwitcher onChange={onLanguageChange} />;
  const theme = onToggleTheme && <ThemeToggle onToggle={onToggleTheme} />;
  return (
    <AppBar
      position="static"
      sx={{
        height,
        flexShrink: 0,
        boxSizing: height === 64 ? 'content-box' : 'border-box',
        zIndex: 1,
        boxShadow: 'none',
        backgroundColor: (theme) => theme.palette.vesoft.bgColor,
        color: (theme) => theme.palette.vesoft.textColor2,
        borderBottom: (theme) => `1px solid ${theme.palette.vesoft.v2.divider1}`,
      }}
    >
      <Toolbar sx={{ pr: 2, height, minHeight: `${height}px !important` }}>
        {logo}
        <Box flex={1} height="100%" display="flex" alignItems="flex-end">
          {navigation && <StudioNavigation {...navigation} height={height} />}
        </Box>
        <Stack
          direction="row"
          alignItems="center"
          spacing={userMenu.compact ? 2 : 1}
          sx={userMenu.compact ? undefined : { '& > .MuiIconButton-root': { p: 0.75, minWidth: 36, minHeight: 36 } }}
        >
          {actions}
          {connectionAction ?? (
            <>
              {actionOrder === 'language-theme' ? (
                <>
                  {language}
                  {theme}
                </>
              ) : (
                <>
                  {theme}
                  {language}
                </>
              )}
              <UserMenu {...userMenu} />
            </>
          )}
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
