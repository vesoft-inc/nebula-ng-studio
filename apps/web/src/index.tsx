import '@vesoft-inc/ui-components/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { createStudioRouter } from './app/router';
import './tailwind.css';

const application = createStudioRouter();
const rootElement = document.getElementById('studioApp');
const root = import.meta.hot?.data?.root || createRoot(rootElement!);
import.meta.hot?.dispose(() => {
  application.dispose();
  import.meta.hot!.data.root = root;
});
root.render(
  <StrictMode>
    <App router={application.router} />
  </StrictMode>
);
