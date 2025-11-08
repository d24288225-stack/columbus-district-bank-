const { exec } = require('child_process');
exec('node data/seed.js', (err, stdout, stderr) => {
  if (err) console.error('Seed failed:', err);
  else console.log('Users seeded on startup!');
});
