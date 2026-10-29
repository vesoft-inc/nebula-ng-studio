import { ReactNode } from 'react';
import {
  Box,
  type BoxProps,
  type LinkProps,
  type SvgIconProps,
  type BreadcrumbsProps as MBreadcrumbsProps,
  Breadcrumbs,
  Link,
  Typography,
  type TypographyProps,
} from '@mui/material';
import { Link as RouterLink, LinkProps as RouterLinkProps, To } from 'react-router-dom';
import { BackIcon } from './styles';

export interface BreadCrumbItem extends Omit<LinkProps, 'title'> {
  key?: string;
  to?: To | number;
  title: ReactNode;
  slotProps?: Partial<{
    commonTitle: TypographyProps;
  }>;
}

export interface BreadCrumbsProps extends Omit<MBreadcrumbsProps, 'slotProps'> {
  showBack?: boolean;
  items: BreadCrumbItem[];
  onBack?: () => void;
  itemRender?: (item: BreadCrumbItem, items: BreadCrumbItem[]) => ReactNode;
  slotProps?: Partial<{
    container: BoxProps;
    backIcon: SvgIconProps;
    breadCrumb: MBreadcrumbsProps;
    breadCrumbsLink: LinkProps;
    breadCrumbsCommonTitle: TypographyProps;
  }>;
}

function BreadCurmbs(props: BreadCrumbsProps) {
  const { items, showBack = true, onBack, itemRender, slotProps } = props;

  return (
    <Box display="flex" alignItems="center" {...slotProps?.container}>
      {showBack && <BackIcon fontSize="medium" onClick={onBack} {...slotProps?.backIcon} />}
      <Breadcrumbs {...slotProps?.breadCrumb}>
        {items.map((item, index) => {
          if (itemRender) {
            return itemRender(item, items);
          }
          const { key, title, to, ...rest } = item as LinkProps & RouterLinkProps;
          return to ? (
            <Link
              component={RouterLink}
              underline="hover"
              color="inherit"
              to={to}
              key={key || index}
              sx={{
                ':hover': {
                  cursor: 'pointer',
                  color: (theme) => theme.palette.vesoft.themeColor1,
                },
              }}
              {...rest}
            >
              {item.title}
            </Link>
          ) : (
            <Typography
              key={index}
              sx={{ color: index === items.length - 1 ? (theme) => theme.palette.vesoft.v2.text1 : undefined }}
              {...slotProps?.breadCrumbsCommonTitle}
            >
              {item.title}
            </Typography>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
}

export default BreadCurmbs;
