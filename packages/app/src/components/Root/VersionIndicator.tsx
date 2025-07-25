import React from 'react';
import { makeStyles, Chip } from '@material-ui/core';
import { configApiRef, useApi } from '@backstage/core-plugin-api';

const useStyles = makeStyles((theme) => ({
  versionChip: {
    position: 'fixed',
    bottom: theme.spacing(2),
    left: theme.spacing(2),
    zIndex: 1000,
    backgroundColor: theme.palette.type === 'dark' ? '#333' : '#f5f5f5',
    border: `1px solid ${theme.palette.type === 'dark' ? '#555' : '#ddd'}`,
    fontSize: '0.75rem',
    height: 24,
    '& .MuiChip-label': {
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    },
  },
}));

export const VersionIndicator = () => {
  const classes = useStyles();
  const config = useApi(configApiRef);
  
  // Try to get version from config, environment variable, or use a default
  const appVersion = config.getOptionalString('app.version') || 
                     process.env.APP_VERSION || 
                     process.env.REACT_APP_VERSION ||
                     process.env.IMAGE_TAG ||
                     'dev';
  
  // Extract run number if it's in the format "run-XXX"
  const displayVersion = appVersion.match(/run-(\d+)/) 
    ? `v${appVersion.match(/run-(\d+)/)[1]}`
    : appVersion;

  return (
    <Chip
      className={classes.versionChip}
      label={`Build: ${displayVersion}`}
      size="small"
      variant="outlined"
    />
  );
};