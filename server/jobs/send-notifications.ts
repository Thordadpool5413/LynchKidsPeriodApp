import { sendDueNotifications } from '../services/push';

sendDueNotifications()
  .then((result) => {
    console.log(JSON.stringify({ ok: true, ...result }));
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'Notification job failed' }));
    process.exit(1);
  });
