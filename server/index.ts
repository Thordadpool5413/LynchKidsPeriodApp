import { app } from './app';
import { config } from './config';

app.listen(config.PORT, '0.0.0.0', () => {
  console.log(`Glitter API listening on http://0.0.0.0:${config.PORT}`);
});
