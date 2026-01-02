require('dotenv').config();

const server = require('./app');

const PORT = process.env.PORT || 5000;
const HOST = "127.0.0.1"
server.listen(PORT, HOST, () => {
  console.log(`CodeLeet API listening on port ${PORT}`);
});

