import { createBrowserRouter } from 'react-router';
import { RootLayout } from './layouts/RootLayout';
import { LibraryPage } from './pages/LibraryPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { SourcesPage } from './pages/SourcesPage';
import { TaskQueuePage } from './pages/TaskQueuePage';
import { TagsPage } from './pages/TagsPage';
import { SettingsPage } from './pages/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true, Component: LibraryPage },
      { path: 'asset/:assetId', Component: AssetDetailPage },
      { path: 'sources', Component: SourcesPage },
      { path: 'tasks', Component: TaskQueuePage },
      { path: 'tags', Component: TagsPage },
      { path: 'settings', Component: SettingsPage },
    ],
  },
]);
