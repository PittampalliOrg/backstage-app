import React from 'react';
import { Header, Page, Content } from '@backstage/core-components';
import { Button } from '@material-ui/core';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';

export const GiteaPage = () => {
  const handleOpenFullscreen = () => {
    window.open('/api/proxy/gitea', '_blank');
  };

  return (
    <Page themeId="tool">
      <Header 
        title="Gitea" 
        subtitle="Git Repository Management"
      >
        <Button 
          variant="outlined" 
          color="primary"
          onClick={handleOpenFullscreen}
          startIcon={<OpenInNewIcon />}
        >
          Open in New Tab
        </Button>
      </Header>
      <Content noPadding>
        <iframe 
          src="/api/proxy/gitea"
          style={{ 
            width: '100%', 
            height: 'calc(100vh - 220px)', // Account for header and top nav
            border: 'none'
          }}
          title="Gitea Repository Management"
        />
      </Content>
    </Page>
  );
};