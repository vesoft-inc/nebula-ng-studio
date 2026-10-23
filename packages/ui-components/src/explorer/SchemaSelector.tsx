import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ISchemaItem } from '../schema/types';
import { useExplorerStore } from './context';

interface ExplorerSchemaSelectorProps {
  onSchemaChanged?: (schema: ISchemaItem) => void | Promise<void>;
  onSwitchingChange?: (switching: boolean) => void;
}

function ExplorerSchemaSelector({ onSchemaChanged, onSwitchingChange }: ExplorerSchemaSelectorProps) {
  const explorerStore = useExplorerStore();
  const [switching, setSwitching] = useState(false);
  const switchingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const schemaStore = explorerStore.schemaStore;
  const { schemas, currentSchema } = schemaStore;
  const { t } = useTranslation('explorer');

  const refreshSchemas = async () => {
    setLoading(true);
    try {
      await explorerStore.getSchemaItems();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshSchemas();
  }, [explorerStore]);

  const handleChangeSchema = async (schema: ISchemaItem | null) => {
    if (switchingRef.current || schemaStore.switchingSchema) return;
    if (!schema || schema.path === currentSchema?.path) return;

    switchingRef.current = true;
    setSwitching(true);
    onSwitchingChange?.(true);
    try {
      const res = await schemaStore.switchSchema(schema.path);
      if (res.code !== 0) return;

      explorerStore.services.onSchemaChanged?.(schema.path);
      await onSchemaChanged?.(schema);
    } catch {
      // A failed or cancelled switch must not trigger schema navigation.
    } finally {
      switchingRef.current = false;
      setSwitching(false);
      onSwitchingChange?.(false);
    }
  };

  return (
    <Autocomplete
      size="small"
      disableClearable={!!currentSchema?.path}
      disabled={switching || schemaStore.switchingSchema}
      loading={loading}
      loadingText={t('loadingSchemas', { ns: 'explorer' })}
      noOptionsText={t('noMatchingSchemas', { ns: 'explorer' })}
      options={schemas.slice()}
      value={currentSchema?.path ? currentSchema : null}
      getOptionLabel={(schema) => schema.path}
      isOptionEqualToValue={(option, value) => option.path === value.path}
      onOpen={refreshSchemas}
      onChange={(_, schema) => handleChangeSchema(schema)}
      sx={{
        width: { xs: '100%', sm: 200 },
        maxWidth: '100%',
        '& .MuiAutocomplete-input': { textOverflow: 'ellipsis' },
      }}
      renderOption={(props, schema) => (
        <li {...props} key={schema.path} style={{ overflowWrap: 'anywhere' }}>
          {schema.path}
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          label="Schema"
          variant="outlined"
          placeholder={t('selectSchema', { ns: 'explorer' })}
          inputProps={{ ...params.inputProps, 'aria-label': 'Schema', title: currentSchema?.path }}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {(loading || switching) && (
                  <CircularProgress size={14} aria-label={t('loadingSchemas', { ns: 'explorer' })} />
                )}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}

export default observer(ExplorerSchemaSelector);
