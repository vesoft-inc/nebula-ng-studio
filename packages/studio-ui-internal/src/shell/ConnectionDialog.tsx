import { useId, type ReactNode } from 'react';
import { Box, Button, IconButton, Modal, Typography } from '@mui/material';
import { CloseFilled } from '@vesoft-inc/icons';
import { ConnectionForm, type ConnectionFormProps } from './ConnectionForm';

export interface ConnectionDialogProps extends ConnectionFormProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  background?: string;
}
export function ConnectionDialog({
  open,
  onClose,
  title,
  description,
  background,
  labels,
  ...form
}: ConnectionDialogProps) {
  const titleId = useId();
  return (
    <Modal open={open} onClose={onClose} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box
        role="dialog"
        aria-labelledby={titleId}
        aria-modal="true"
        sx={{
          position: 'relative',
          width: 640,
          maxWidth: '100%',
          pb: 3,
          backgroundImage: background ? `url(${background})` : undefined,
          backgroundColor: (theme) => theme.palette.vesoft.v2.bg1,
          border: (theme) => `4px solid ${theme.palette.vesoft.v2.border2}`,
          borderRadius: '6px',
          backgroundPosition: '25px 20px',
          backgroundSize: '600px auto',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <IconButton aria-label="Close" onClick={onClose} sx={{ position: 'absolute', top: 12, right: 23 }}>
          <CloseFilled />
        </IconButton>
        <Box display="flex" flexDirection="column" alignItems="center">
          <Typography
            id={titleId}
            sx={{
              mt: '36px',
              color: (theme) => theme.palette.vesoft.v2.text1,
              fontSize: 20,
              lineHeight: '24px',
              fontWeight: 600,
            }}
          >
            {title}
          </Typography>
          <Typography sx={{ mt: '44px', mb: 3, color: (theme) => theme.palette.vesoft.v2.text3, fontSize: 14 }}>
            {description}
          </Typography>
          <Box width={432} maxWidth="100%">
            <ConnectionForm
              {...form}
              labels={labels}
              showAddress={false}
              submitAction={({ loading }) => (
                <Box textAlign="center">
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading}
                    sx={{ mt: '28px', width: 240, height: 32, borderRadius: '6px', fontSize: 12 }}
                  >
                    {loading ? 'Loading...' : labels?.submit}
                  </Button>
                </Box>
              )}
            />
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}
