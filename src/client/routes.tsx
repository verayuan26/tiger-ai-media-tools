import { createBrowserRouter } from 'react-router';
import { RootLayout } from './layouts/RootLayout';
import {
  AssetDetailPage,
  LibraryPage,
  SettingsPage,
  SourcesPage,
  TagsPage,
  TaskQueuePage
} from './pages';

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
      { path: 'settings', Component: SettingsPage }
    ]
  }
]);
