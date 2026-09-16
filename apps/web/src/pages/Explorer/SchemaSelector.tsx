import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { runInAction } from 'mobx';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ISchemaItem } from '@studio/interfaces';
import { changeSchema } from '@studio/services';
import { useStore } from '@studio/stores';

interface ExplorerSchemaSelectorProps {
  onSchemaChanged?: (schema: ISchemaItem) => void | Promise<void>;
  onSwitchingChange?: (switching: boolean) => void;
}

function ExplorerSchemaSelector({ onSchemaChanged, onSwitchingChange }: ExplorerSchemaSelectorProps) {
  const { explorerStore, schemaStore, commonStore } = useStore();
  const [switching, setSwitching] = useState(false);
  const switchingRef = useRef(false);
  const [loading, setLoading] = useState(false);
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
    if (switchingRef.current) return;
    if (!schema || schema.path === currentSchema?.path) return;

    switchingRef.current = true;
    setSwitching(true);
    onSwitchingChange?.(true);
    try {
      const res = await changeSchema(schema.path);
      if (res.code !== 0) return;

      runInAction(() => {
        // Schema list refreshes also read the session's selected path.
        if (commonStore.userInfo) {
          commonStore.setUserInfo({ ...commonStore.userInfo, curSchemaPath: schema.path });
        }
        schemaStore.updateCurrentSchame(schema);
      });
      await onSchemaChanged?.(schema);
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
      disabled={switching}
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
