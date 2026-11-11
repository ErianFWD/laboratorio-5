const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });

const { createApp } = require('./app');
const { config } = require('./config/env');

const app = createApp();

app.listen(config.port, () => {
  console.log(`API disponible en http://localhost:${config.port}`);
});
