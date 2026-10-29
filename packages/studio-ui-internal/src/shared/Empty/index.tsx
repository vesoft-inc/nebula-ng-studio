import type { BoxProps, TypographyProps } from '@mui/material';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import emptyImg from '../../assets/images/default-empty.png?url';

interface IProps {
  description?: string;
  slotProps?: {
    contianer: BoxProps;
    emptyImg: BoxProps;
    description: TypographyProps;
  };
}

export default function Empty(props: IProps) {
  const { t } = useTranslation(['common']);
  const { description = t('emptyTip', { ns: 'common' }), slotProps } = props;
  return (
    <Box
      width="100%"
      height="100%"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      {...slotProps?.contianer}
    >
      <Box component="img" width={120} height={120} src={emptyImg} {...slotProps?.emptyImg} />
      <Typography
        mt={2.5}
        fontWeight={500}
        sx={{ color: (theme) => theme.palette.text.primary }}
        {...slotProps?.description}
      >
        {description}
      </Typography>
    </Box>
  );
}
