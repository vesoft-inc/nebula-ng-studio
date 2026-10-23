import { styled } from '@mui/material/styles';
// import type { StyledComponent } from '@emotion/styled';
import { SvgIconProps, Breadcrumbs as MBreadcrumbs, type BreadcrumbsProps as MBreadcrumbsProps } from '@mui/material';
import { ArrowBackFilled } from '@vesoft-inc/icons';

// type StyledIcon = StyledComponent<SvgIconProps, {}, {}>;

export const BackIcon = styled(ArrowBackFilled)<SvgIconProps>`
  color: ${({ theme }) => theme.palette.vesoft.textColor1};
  margin-right: ${({ theme }) => theme.spacing(1)};
  font-size: ${({ theme }) => theme.spacing(2.5)};
  :hover {
    color: ${({ theme }) => theme.palette.vesoft.themeColor1};
    cursor: pointer;
  }
`;

// type StyledBreadcrumb = StyledComponent<MBreadcrumbsProps, {}, {}>;
export const Breadcrumbs = styled(MBreadcrumbs)<MBreadcrumbsProps>`
  display: flex;
  align-items: center;
`;
