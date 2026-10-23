import { ReactNode } from 'react';
import { Box, CardProps } from '@mui/material';
import { CardTitle, CardInfoContainer, CardInfoItem, ListCardContainer } from './styles';

interface GridLayoutProps {
  xl?: number;
  xs?: number;
  sm?: number;
  md?: number;
}

export interface ListCardProps {
  title: ReactNode | string;
  icon?: ReactNode;
  infos: {
    label: ReactNode | string;
    value: ReactNode | string;
    layout?: GridLayoutProps;
  }[];
  defaultLayout?: GridLayoutProps;
  actions: ReactNode;
  slotProps?: Partial<{
    container: CardProps;
    // icon: SvgIconProps;
  }>;
  onClick?: () => void;
}

function ListCard(props: ListCardProps) {
  const { title, icon, infos, actions, defaultLayout = { xl: 4, xs: 6 } } = props;

  return (
    <ListCardContainer {...props.slotProps?.container} onClick={props.onClick}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <CardTitle>
          {icon && icon}
          {title}
        </CardTitle>
        <Box display="flex" alignItems="center">
          {actions}
        </Box>
      </Box>
      <CardInfoContainer container>
        {infos.map((info, index) => (
          <CardInfoItem size={defaultLayout} {...info.layout} key={`list_card_info_${title}_${index}`}>
            <Box>
              <Box>{info.label}</Box>
              <Box>{info.value}</Box>
            </Box>
          </CardInfoItem>
        ))}
      </CardInfoContainer>
    </ListCardContainer>
  );
}

export default ListCard;
