const Review = require('../models/reviewModel');
// const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

const getAllReviews = factory.getAll(Review);
// const getAllReviews = catchAsync(async (req, res, next) => {
//   let filter = {};
//   if (req.params.tourId) {
//     filter = { tour: req.params.tourId };
//   }
//   const reviews = await Review.find(filter);
//   res
//     .status(200)
//     .json({ status: 'success', results: reviews.length, data: { reviews } });
// });

const setTourUserIds = (req, res, next) => {
  // when will this middleware get called is defined in the reviewRoutes
  // allow nested routes
  if (!req.body.tour) {
    req.body.tour = req.params.tourId;
  }
  if (!req.body.user) {
    req.body.user = req.user.id;
  }
  next();
};
const createReview = factory.createOne(Review);
// const createReview = catchAsync(async (req, res, next) => {
//   const newReview = await Review.create(req.body); // anything in req.body but are not specified in Review's Schema will be ingored, so this is safe
//   res.status(201).json({ status: 'success', data: { review: newReview } });
// });

const deleteReview = factory.deleteOne(Review);
const updateReview = factory.updateOne(Review);
const getReview = factory.getOne(Review);

module.exports = {
  getAllReviews,
  createReview,
  deleteReview,
  updateReview,
  setTourUserIds,
  getReview,
};
