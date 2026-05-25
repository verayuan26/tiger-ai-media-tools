import { createApp } from './app';
import { loadConfig } from './config';

const config = loadConfig();
const app = createApp(config);

app.listen(config.port, '127.0.0.1', () => {
  console.log(`AI media library API: http://127.0.0.1:${config.port}`);
});
