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
import { BackIcon } from './styles';

export interface BreadCrumbItem extends Omit<LinkProps, 'title'> {
  key?: string;
  href?: string;
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
          const { key, title, href, ...rest } = item;
          return href ? (
            <Link
              underline="hover"
              color="inherit"
              href={href}
              key={key || index}
              sx={{
                ':hover': {
                  cursor: 'pointer',
                  color: (theme) => theme.palette.vesoft.themeColor1,
                },
              }}
              {...rest}
            >
              {title}
            </Link>
          ) : (
            <Typography
              component="div"
              key={index}
              sx={{ color: index === items.length - 1 ? (theme) => theme.palette.vesoft.v2.text1 : undefined }}
              {...slotProps?.breadCrumbsCommonTitle}
            >
              {title}
            </Typography>
          );
        })}
      </Breadcrumbs>
    </Box>
  );
}

export default BreadCurmbs;
