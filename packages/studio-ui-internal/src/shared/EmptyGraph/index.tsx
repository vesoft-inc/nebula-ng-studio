import type { BoxProps, TypographyProps } from '@mui/material';
import { Box, Button, CircularProgress } from '@mui/material';

interface IProps {
  title: string;
  description?: string[];
  slotProps: {
    emptyImgSrc: string;
    contianer?: BoxProps;
    description?: TypographyProps;
  };
  buttonProps?: {
    okText: string;
    handleOk: () => void;
    cancelText?: string;
    handleCancel?: () => void;
    loading?: boolean;
  };
}

export default function EmptyGraph(props: IProps) {
  const { title, description, slotProps, buttonProps } = props;
  const loading = buttonProps?.loading ?? false;
  return (
    <Box width="100%" height="100%" display="flex" justifyContent="center" {...slotProps?.contianer}>
      <Box display="flex" width={720} height={180} mt={'20vh'}>
        <Box component="img" src={slotProps.emptyImgSrc} width={160} height={160} />
        <Box flex={1} ml={2}>
          <Box fontSize={24} fontWeight={600} mb={1} sx={{ color: (theme) => theme.palette.vesoft.v2.text1 }}>
            {title}
          </Box>

          {description?.map((item, index) => (
            <Box key={index} fontSize={14} fontWeight={400}>
              {item}
            </Box>
          ))}

          {buttonProps && (
            <Box mt={1.6}>
              {buttonProps.okText && (
                <Button sx={{ mr: 2 }} variant="contained" onClick={() => buttonProps.handleOk()}>
                  {buttonProps.okText}
                </Button>
              )}
              {buttonProps.cancelText && (
                <Button
                  variant="outlined"
                  onClick={() => buttonProps.handleCancel && buttonProps.handleCancel()}
                  sx={{ borderColor: (theme) => theme.palette.vesoft.v2.primary3 }}
                >
                  {buttonProps.cancelText}
                  {loading && <CircularProgress size={18} sx={{ ml: 2 }} color="inherit" />}
                </Button>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
