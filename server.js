const dotenv = require('dotenv');
const mongoose = require('mongoose');

process.on('uncaughtException', (err) => {
  console.log('Uncaught Exceptions! Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });
const app = require('./app');

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);
mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
  })
  .then(() => {
    console.log('DB connection successful!');
  });

///// see all environment variables
// console.log(process.env);
//// 4) start server
const port = process.env.PORT || 3000;
// app.listen will return a server
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

///// handle async errors
process.on('unhandledRejection', (err) => {
  console.log('Unhandled Rejections! Shutting down...');
  //console.log(err.name, err.message)
  console.log(err.name);
  // give server the time to finish the requests that are still pending or being handled at the time, and only after then the server is closed
  // prefer the following way then just do process.exit(1)
  server.close(() => {
    process.exit(1);
  });
});

//// handle sync errors
///// example: like this undefined x: console.log(x);
// process.on('uncaughtException', (err) => {
//   console.log('Uncaught Exceptions! Shutting down...');
//   console.log(err.name, err.message);
//   server.close(() => {
//     process.exit(1);
//   });
// });

//  if you put this line before the process.on(uncaughtException) function,
// then since we haven't build a listener yet, we wouldn't see the message outputed by the uncaughtException listener
// console.log(x);
