import React from 'react';
import { Header, Page, Content } from '@backstage/core-components';
import { EntityIFrameContent } from '@roadiehq/backstage-plugin-iframe';
import { Button } from '@material-ui/core';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';

export const HeadlampPage = () => {
  const handleOpenFullscreen = () => {
    window.open('/api/proxy/headlamp', '_blank');
  };

  return (
    <Page themeId="tool">
      <Header 
        title="Headlamp Dashboard" 
        subtitle="Kubernetes Dashboard"
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
        <div style={{ 
          height: 'calc(100vh - 220px)', // Account for header and top nav
          width: '100%',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <EntityIFrameContent 
            iframe={{
              src: "/api/proxy/headlamp",
              height: "100%",
              width: "100%"
            }}
            title="Kubernetes Dashboard"
          />
        </div>
      </Content>
    </Page>
  );
};