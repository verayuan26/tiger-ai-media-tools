import { RouterProvider } from 'react-router';
import { router } from './routes';

export default function App(): React.JSX.Element {
  return <RouterProvider router={router} />;
}
