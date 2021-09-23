const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
// const cors = require('cors');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const compression = require('compression');

const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const viewRouter = require('./routes/viewRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');

// start express app
const app = express();
// server-side rendering using pug
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

////// 1) middlewares
// app.use(
//   cors({
//     origin: 'http://127.0.0.1:3000',
//     credentials: true,
//   })
// );
/// global middlewares, we want to apply on all of our routes
//////// set security HTTP headers
/// helmet() will return a function, and this function will be called later.
// app.use(helmet());
/////////////////////////////////////////////////////////////////
///// before stripe
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'", 'https:', 'http:', 'data:', 'ws:'],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'http:', 'data:'],
      scriptSrc: ["'self'", 'https:', 'http:', 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:', 'http:'],
    },
  })
);
////////////////////////////////////////////////////////////
////////// after stripe
// app.use(
//   helmet({
//     contentSecurityPolicy: {
//       directives: {
//         defaultSrc: ["'self'", 'data:', 'blob:', 'https:', 'ws:'],
//         baseUri: ["'self'"],
//         fontSrc: ["'self'", 'https:', 'data:'],
//         scriptSrc: [
//           "'self'",
//           'https:',
//           'http:',
//           'blob:',
//           'https://*.mapbox.com',
//           'https://js.stripe.com',
//           'https://m.stripe.network',
//           'https://*.cloudflare.com',
//         ],
//         frameSrc: ["'self'", 'https://js.stripe.com'],
//         objectSrc: ["'none'"],
//         styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
//         workerSrc: [
//           "'self'",
//           'data:',
//           'blob:',
//           'https://*.tiles.mapbox.com',
//           'https://api.mapbox.com',
//           'https://events.mapbox.com',
//           'https://m.stripe.network',
//         ],
//         childSrc: ["'self'", 'blob:'],
//         imgSrc: ["'self'", 'data:', 'blob:'],
//         formAction: ["'self'"],
//         connectSrc: [
//           "'self'",
//           /// there may be a problem with this line
//           // "'unsafe-inline'",
//           'data:',
//           'blob:',
//           'https://*.stripe.com',
//           'https://*.mapbox.com',
//           'https://*.cloudflare.com/',
//           'https://bundle.js:*',
//           'ws://127.0.0.1:*/',
//         ],
//         // upgradeInsecureRequests: [],
//       },
//     },
//   })
// );
/////////////////////////////////////////////////////////
///// development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

/////// limit requests from same IP
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000, // this means allow 100 requests in 1 hour/60*60*1000 milliseconds
  message: 'Too many requests from this IP. Please try again in an hour.',
});
app.use('/api', limiter); // limiter is a middleware function

//// body parser, reading data from body in req.body
//// limiting the size in req.body
app.use(express.json({ limit: '10kb' }));
// for the form data
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
// cookie parser: parse any cookies from incoming requests
app.use(cookieParser());

//// data sanitization against NoSQL query injection.
//// what this means is when we login in using email as: {"$gt": ""}, which will alawys return true.
app.use(mongoSanitize());
//// data sanitization against XSS.
app.use(xss());

//// prevent parameter polution
/// this means for example, in get all tours, we ?sort=duration&sort=price
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'difficulty',
      'price',
      'maxGroupSize',
    ], // we can allow ?duration=5&duration=9
  })
);
//// serving static files
// app.use(express.static(`${__dirname}/public`));
app.use(express.static(path.join(__dirname, 'public')));

//
app.use(compression());

//// testing middleware
app.use((req, res, next) => {
  // add requestTime as an instance variable to the req object
  req.requestTime = new Date().toISOString();
  // console.log(req.cookies);
  next();
});
// app.get('/', (req, res) => {
//   res
//     .status(200)
//     .json({ message: 'Hello from the server side!', app: 'Natours' });
// });

//// 2) route handlers

// app.get('/api/v1/tours/', getAllTours);
// app.get('/api/v1/tours/:id', getTour);
// app.post('/api/v1/tours/', createTour);
// app.patch('/api/v1/tours/:id', updateTour);
// app.delete('/api/v1/tours/:id', deleteTour);

/////// 3) routes
app.use('/', viewRouter);

///// for '/api/v1/tours', we want to apply the tourRouter middleware
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter); // mount reviewRouter (this is bascically a middleware) on a new path
app.use('/api/v1/bookings', bookingRouter);

//// other routes that cannot be handled by all the above routers
//// which means these are invalid routes
app.all('*', (req, res, next) => {
  // res.status(404).json({
  //   status: 'fail',
  //   message: `Cannot find ${req.originalUrl} on this server!`,
  // });
  // next();
  // const err = new Error(`Cannot find ${req.originalUrl} on this server!`);
  // err.statusCode = 404;
  // err.status = 'fail';

  // this is the global error handling middleware, next(err) will directly jump to the global error middleware defined below.
  // next(err);
  next(new AppError(`Cannot find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);
//// connect to a server
module.exports = app;
