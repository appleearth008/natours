const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const alerts = (req, res, next) => {
  const { alert } = req.query;
  if (alert === 'booking')
    res.locals.alert =
      "Your booking was successful! Please check your email for a confirmation. If your booking doesn't show up here immediatly, please come back later.";
  next();
};

const getOverview = catchAsync(async (req, res, next) => {
  /// 1. get tour data from the collection
  const tours = await Tour.find();
  /// 2. build template
  /// 3. render that template using tour data from step 1
  res.status(200).render('overview', { title: 'All Tours', tours });
});

// when there is async function wrapped by catchAsync, we should always specify next param
const getTour = catchAsync(async (req, res, next) => {
  // 1.get the data, for the requested tour (including reviews and guides)
  const tour = await Tour.findOne({ slug: req.params.slug }).populate({
    path: 'reviews',
    fields: 'review rating user',
  });
  if (!tour) {
    return next(new AppError('There is no tour with that name', 404));
  }
  // 2. build the template
  // 3. render template using data from step 1
  res
    .status(200)
    //////////////////////////////////
    /// before stripe
    // .set(
    //   'Content-Security-Policy',
    //   'connect-src https://*.tiles.mapbox.com https://api.mapbox.com https://events.mapbox.com http://127.0.0.1:3000/api/v1/users/logout'
    // )
    ///////////////////////////////////////////////////////
    //////// in stripe
    .set(
      'Content-Security-Policy',
      "default-src 'self' https://*.mapbox.com https://*.stripe.com ;base-uri 'self';block-all-mixed-content;font-src 'self' https: data:;frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src https://cdnjs.cloudflare.com https://api.mapbox.com https://js.stripe.com/v3/ 'self' blob: ;script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests;"
    )
    .render('tour', { title: `${tour.name} Tour`, tour });
});

const getLoginForm = (req, res) => {
  res
    .status(200)
    .set(
      'Content-Security-Policy',
      "script-src 'self' https://cdnjs.cloudflare.com/ajax/libs/axios/0.21.4/axios.min.js 'unsafe-inline' 'unsafe-eval';"
    )
    .render('login', { title: 'Log into your account' });
};

const getAccount = (req, res) => {
  res.status(200).render('account', { title: 'Your account' });
};

const updateUserData = catchAsync(async (req, res, next) => {
  // data coming from forms are now in : req.body
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    {
      name: req.body.name,
      email: req.body.email,
    },
    { new: true, runValidators: true }
  );
  // render the account page again with the updatedUser
  res
    .status(200)
    .render('account', { title: 'Your account', user: updatedUser });
});

const getMyTours = catchAsync(async (req, res, next) => {
  // 1) Find all bookings
  const bookings = await Booking.find({ user: req.user.id });

  // 2) Find tours with the returned IDs
  const tourIDs = bookings.map((el) => el.tour);
  const tours = await Tour.find({ _id: { $in: tourIDs } });

  res.status(200).render('overview', {
    title: 'My Tours',
    tours,
  });
});

module.exports = {
  getOverview,
  getTour,
  getLoginForm,
  getAccount,
  updateUserData,
  getMyTours,
  alerts,
};
